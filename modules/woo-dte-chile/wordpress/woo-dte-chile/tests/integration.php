<?php
if (PHP_SAPI!=='cli' || !getenv('WDT_TEST_WORDPRESS') || getenv('WDT_TEST_RESET')!=='YES') die("Requires isolated WordPress at WDT_TEST_WORDPRESS and WDT_TEST_RESET=YES\n");
define('WDT_SECRET_KEY',base64_encode(str_repeat('x',32)));
define('DISABLE_WP_CRON',true);
require getenv('WDT_TEST_WORDPRESS').'/wp-load.php';
if (DB_NAME!=='wdt_test' || home_url()!=='http://wdt.test') die('Wrong test database/site');
require __DIR__.'/fixtures.php';
use WooDTEChile\{Rules,Xml,Caf,Certificate,Config,Store,Service,Delivery,Rest,Failure};
$checks=0;
function ok($v,$label) { global $checks; if (!$v) throw new RuntimeException('FAIL '.$label); $checks++; echo "PASS $label\n"; }
function no(callable $f,$label) { try { $f(); } catch (Failure $e) { ok(true,$label); return; } throw new RuntimeException('Expected failure: '.$label); }
$store=new Store(); $svc=new Service($store);
foreach ([$store->docs,$store->cafs,$store->events,$store->jobs] as $table) $wpdb->query("TRUNCATE TABLE $table");
$rootKey=openssl_pkey_new(['private_key_bits'=>1024]); openssl_pkey_export($rootKey,$rootPem); $rootPublic=openssl_pkey_get_details($rootKey)['key']; define('WDT_SII_CAF_KEYS',['certification'=>['999'=>$rootPublic]]);
$cert=fixtureCertificate(); update_option('wdt_certificate',WooDTEChile\Vault::encrypt(wp_json_encode(['key'=>$cert->key,'cert'=>$cert->cert])),false);
$c=fixtureIssuer()+['auto'=>true,'auto_refunds'=>true,'production_confirmation'=>'','evidence'=>'']; update_option('wdt_settings',$c,false);
wp_set_current_user(1);
foreach ([33,39,56,61] as $type) {
    $caf=fixtureCaf($type,$c['rut']); $da=$caf->xml->getElementsByTagName('DA')->item(0);
    openssl_sign(Xml::compact($da),$sig,$rootPem,OPENSSL_ALGO_SHA1);
    $caf->xml->getElementsByTagName('FRMA')->item(0)->nodeValue=base64_encode($sig);
    $xml=$caf->xml->saveXML(); $store->importCaf($xml,$c);
    no(fn()=> $store->importCaf($xml,$c),'overlapping CAF '.$type);
    $bad=str_replace('<TD>'.$type.'</TD>','<TD>33</TD>',$xml);
    if ($type!==33) no(fn()=>new Caf($bad,$c['rut'],$rootPublic),'tampered CAF '.$type);
}
$mails=0; $failMail=false; $mailTargets=[]; add_filter('pre_wp_mail',function($pre,$atts) use(&$mails,&$failMail,&$mailTargets) { if (str_contains($atts['subject'],'Documento tributario')) { $mails++; $mailTargets[]=$atts['to']; return !$failMail; } return true; },10,2);
$uploads=0; $timeout=false;
add_filter('pre_http_request',function($pre,$args,$url) use(&$uploads,&$timeout) {
    $body='';
    if (str_contains($url,'boleta.electronica.semilla') || str_contains($url,'CrSeed.jws')) $body='<RESPUESTA><SEMILLA>1234567</SEMILLA></RESPUESTA>';
    elseif (str_contains($url,'boleta.electronica.token') || str_contains($url,'GetTokenFromSeed.jws')) $body='<RESPUESTA><TOKEN>TESTTOKEN123</TOKEN></RESPUESTA>';
    elseif (str_contains($url,'boleta.electronica.envio') && $args['method']==='POST') { $uploads++; if ($timeout) return new WP_Error('timeout','Synthetic timeout'); $body=wp_json_encode(['rut_emisor'=>'76123456-0','trackid'=>1234,'estado'=>'REC']); }
    elseif (str_contains($url,'DTEUpload')) { $uploads++; $body='<RECEPCIONDTE><STATUS>0</STATUS><TRACKID>1234</TRACKID></RECEPCIONDTE>'; }
    elseif (str_contains($url,'boleta.electronica.envio/')) $body=wp_json_encode(['rut_emisor'=>'76123456-0','trackid'=>1234,'estado'=>'EPR','estadistica'=>[['tipo'=>39,'informados'=>1,'aceptados'=>1,'rechazados'=>0,'reparos'=>0]]]);
    elseif (str_contains($url,'/estado?')) $body=wp_json_encode(['codigo'=>'FAU']);
    elseif (str_contains($url,'QueryEstUp')) $body='<RESPUESTA><ESTADO>EPR</ESTADO><INFORMADOS>1</INFORMADOS><ACEPTADOS>1</ACEPTADOS><RECHAZADOS>0</RECHAZADOS><REPAROS>0</REPAROS></RESPUESTA>';
    else return new WP_Error('external_blocked','Tests never access external services.');
    if (str_contains($url,'.jws')) {
        $method=str_contains($url,'CrSeed')?'getSeed':(str_contains($url,'GetTokenFromSeed')?'getToken':'getEstUp');
        $body='<Envelope><Body><'.$method.'Return>'.htmlspecialchars($body,ENT_XML1,'UTF-8').'</'.$method.'Return></Body></Envelope>';
    }
    return ['headers'=>[],'body'=>$body,'response'=>['code'=>200,'message'=>'OK'],'cookies'=>[]];
},10,3);
function orderFixture(int $type=39): WC_Order {
    $o=wc_create_order(); $o->set_currency('CLP'); $o->set_billing_country('CL'); $o->set_billing_first_name('Cliente'); $o->set_billing_last_name('Prueba'); $o->set_billing_address_1('Calle 123'); $o->set_billing_city('Santiago'); $o->set_billing_email('client@example.invalid');
    $i=new WC_Order_Item_Product(); $i->set_name('Producto Prueba'); $i->set_quantity(2); $i->set_subtotal(10000); $i->set_total(10000); $i->set_taxes(['total'=>[1=>1900],'subtotal'=>[1=>1900]]); $o->add_item($i); $o->update_taxes(); $o->calculate_totals(false);
    $o->update_meta_data('_wdt_type',$type); if ($type===33) $o->update_meta_data('_wdt_receiver',['rut'=>'76123456-0','name'=>'Empresa Prueba','giro'=>'Comercio','address'=>'Calle 123','commune'=>'Santiago']); $o->save(); return $o;
}
function processNow(Service $svc,Store $s,int $id) { $s->update($s->docs,['next_run'=>gmdate('Y-m-d H:i:s',time()-1)],$id); $svc->process($id); }
foreach ([false,true] as $hpos) {
    $sync=wc_get_container()->get(\Automattic\WooCommerce\Internal\DataStores\Orders\DataSynchronizer::class);
    $sync->create_database_tables();
    while ($batch=$sync->get_next_batch_to_process(100)) $sync->process_batch($batch);
    update_option('woocommerce_custom_orders_table_enabled',$hpos?'yes':'no');
    $o=orderFixture(); no(fn()=> $svc->issue($o->get_id()),'unpaid order blocked '.($hpos?'HPOS':'legacy'));
    $o->payment_complete('SYNTHETIC'); $docs=$store->list($o->get_id()); ok(count($docs)===1,'automatic payment emission '.($hpos?'HPOS':'legacy'));
    $d=$docs[0]; $id=(int)$d['id'];
    ok((int)$d['amount']===11900,'WooCommerce totals preserved');
    $again=$svc->issue($o->get_id()); ok((int)$again['id']===$id,'order idempotency');
    no(fn()=> $svc->issue($o->get_id(),33),'cannot issue second type for same order');
    processNow($svc,$store,$id); ok($store->get($id)['state']==='submitted','signed and uploaded');
    processNow($svc,$store,$id); ok($store->get($id)['state']==='accepted','mock SII accepted');
    $pdf=Delivery::pdf($store,$store->get($id)); ok(str_starts_with($pdf,'%PDF-'),'PDF created with TED');
    if (getenv('WDT_TEST_ARTIFACTS')) { file_put_contents(getenv('WDT_TEST_ARTIFACTS').'/sample-'.$hpos.'.pdf',$pdf); file_put_contents(getenv('WDT_TEST_ARTIFACTS').'/sample-'.$hpos.'.ted',WooDTEChile\Vault::decrypt($store->get($id)['ted'])); }
    $xml=Delivery::xml($store,$store->get($id)); verifySignatures(Xml::load($xml)); ok(true,'download preserves signed XML bytes');
    $refund=wc_create_refund(['order_id'=>$o->get_id(),'amount'=>1900,'reason'=>'Devolución','refund_payment'=>false,'restock_items'=>false]);
    if (is_wp_error($refund)) throw new RuntimeException($refund->get_error_message());
    $job=$wpdb->get_row($wpdb->prepare("SELECT * FROM {$store->jobs} WHERE refund_id=%d",$refund->get_id()),ARRAY_A); ok((bool)$job,'refund webhook persisted'); $svc->refundJob($job);
    $chain=$store->list($o->get_id()); ok(count($chain)===2 && (int)$chain[1]['type']===61 && (int)$chain[1]['parent_id']===$id,'partial refund related NC');
    $svc->refund($o->get_id(),$refund->get_id()); $svc->refundJob($job); ok(count($store->list($o->get_id()))===2,'refund replay idempotency');
    $nc=$svc->adjustment($id,61,10000,'Saldo devuelto','manual:remaining:'.$id); ok((int)$nc['amount']===10000,'remaining credit permitted');
    no(fn()=> $svc->adjustment($id,61,1,'Exceso','manual:excess:'.$id),'accumulated NC cap including queued');
    no(fn()=> $svc->adjustment($id,61,11900,'Anular','manual:cancel:'.$id,true),'full cancellation after partial blocked');
    ok($store->get($id)['state']==='accepted','original preserved after credits');
    no(fn()=> (new Rest($svc))->fiscal($o->get_id(),['type'=>39]),'fiscal snapshot immutable');
    processNow($svc,$store,(int)$chain[1]['id']); processNow($svc,$store,(int)$chain[1]['id']); ok($store->get((int)$chain[1]['id'])['state']==='accepted','NC SOAP path');
}
$o=orderFixture(33); $o->payment_complete('SYNTHETIC'); $base=$store->list($o->get_id())[0]; processNow($svc,$store,(int)$base['id']); processNow($svc,$store,(int)$base['id']);
$nd=$svc->adjustment((int)$base['id'],56,1190,'Recargo acordado','manual:debit:001'); processNow($svc,$store,(int)$nd['id']); processNow($svc,$store,(int)$nd['id']); ok($store->get((int)$nd['id'])['state']==='accepted','invoice and debit workflow');
$cancel=$svc->adjustment((int)$base['id'],61,11900,'Anulación completa','manual:cancel:001',true); ok($store->snapshot($cancel)['reference']['code']===1,'full cancellation CodRef 1');
$repeat=$svc->adjustment((int)$base['id'],61,11900,'Anulación completa','manual:cancel:001',true); ok($repeat['id']===$cancel['id'],'manual cancellation idempotency');
no(fn()=> $svc->adjustment((int)$base['id'],61,100,'Otro','manual:cancel:001',true),'idempotency payload conflict');
$o=orderFixture(); $o->payment_complete('SYNTHETIC'); $d=$store->list($o->get_id())[0]; $timeout=true; $before=$uploads;
processNow($svc,$store,(int)$d['id']); ok($store->get((int)$d['id'])['state']==='uncertain','upload timeout marked uncertain');
$folio=$store->get((int)$d['id'])['folio']; processNow($svc,$store,(int)$d['id']); ok($uploads===$before+1 && $store->get((int)$d['id'])['folio']===$folio,'uncertain never resent or refoliated'); $timeout=false;
wp_set_current_user(0); $request=new WP_REST_Request('GET','/woo-dte-chile/v1/orders/'.$o->get_id().'/documents'); $response=rest_do_request($request); ok($response->get_status()===401,'REST anonymous denied');
$uid=wp_create_user('wdt_customer_'.time(),'test-password','customer'.time().'@example.invalid'); wp_set_current_user($uid);
$response=rest_do_request($request); ok($response->get_status()===403,'REST different customer denied');
$o->set_customer_id($uid); $o->save(); $response=rest_do_request($request); ok($response->get_status()===200,'REST owner sees status');
$request=new WP_REST_Request('POST','/woo-dte-chile/v1/orders/'.$o->get_id().'/issue'); ok(rest_do_request($request)->get_status()===403,'customer cannot issue');
$request=new WP_REST_Request('GET','/woo-dte-chile/v1/documents/'.$d['id'].'/file'); ok(rest_do_request($request)->get_status()===403,'certification files hidden from customers');
wp_set_current_user(1); $request=new WP_REST_Request('GET','/woo-dte-chile/v1/documents/'.$d['id'].'/file'); $r=rest_do_request($request); ok($r->get_status()===200 && isset($r->get_data()['base64']),'admin authenticated XML download');
ok($mails>=5,'mail transport invoked for accepted docs only');
function race(array $tasks): array {
    $children=[];
    foreach ($tasks as $args) {
        $pipes=[]; $command=array_merge([PHP_BINARY,'-d','error_reporting=22527',__DIR__.'/race-worker.php'],$args);
        $p=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
        if (!is_resource($p)) throw new RuntimeException('Cannot start race worker');
        fclose($pipes[0]); $children[]=[$p,$pipes];
    }
    $results=[];
    foreach ($children as [$p,$pipes]) { $out=stream_get_contents($pipes[1]); $err=stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p); $r=json_decode($out,true); if (!is_array($r)) throw new RuntimeException('Invalid worker result '.$out.' '.$err); $results[]=$r; }
    return $results;
}
$o=orderFixture(); $o->payment_complete('SYNTHETIC'); $base=$store->list($o->get_id())[0]; processNow($svc,$store,(int)$base['id']); processNow($svc,$store,(int)$base['id']);
$tasks=[]; for($i=0;$i<8;$i++) $tasks[]=['credit',(string)$base['id'],'3000','race:credit:'.$i];
$r=race($tasks); $success=array_filter($r,fn($x)=>$x['ok']); ok(count($success)===3,'8 concurrent NC requests cannot exceed original total');
$o=orderFixture(); $o->payment_complete('SYNTHETIC'); $base=$store->list($o->get_id())[0]; processNow($svc,$store,(int)$base['id']); processNow($svc,$store,(int)$base['id']);
$r=race(array_fill(0,8,['credit',(string)$base['id'],'1000','race:one-operation']));
ok(count(array_filter($r,fn($x)=>$x['ok']))===8 && count(array_unique(array_column($r,'id')))===1,'8 concurrent identical operations produce one NC');
$tasks=[]; for($i=0;$i<8;$i++) { $o=orderFixture(); $o->payment_complete('SYNTHETIC'); $d=$store->list($o->get_id())[0]; $tasks[]=['reserve',(string)$d['id']]; }
$r=race($tasks); ok(count(array_filter($r,fn($x)=>$x['ok']))===8 && count(array_unique(array_column($r,'folio')))===8,'8 concurrent folio reservations are unique');
ok(count(array_filter($mailTargets,fn($target)=>$target!==get_option('admin_email')))===0,'certification email goes only to administrator');
$o=orderFixture(); $o->payment_complete('SYNTHETIC'); $d=$store->list($o->get_id())[0]; processNow($svc,$store,(int)$d['id']); $failMail=true; processNow($svc,$store,(int)$d['id']); $failMail=false;
ok($store->get((int)$d['id'])['state']==='accepted' && $store->get((int)$d['id'])['email_state']==='failed','mail failure does not downgrade SII acceptance');
no(fn()=> $svc->retry((int)$d['id'],'999999'),'accepted document cannot be retried with another track');
echo 'VERSIONS WP '.get_bloginfo('version').' WC '.WC_VERSION.' PHP '.PHP_VERSION.' DB '.$wpdb->db_version()."\n";
echo "TOTAL $checks integration tests passed (SII and email transport mocked)\n";
