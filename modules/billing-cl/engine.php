<?php
// Private CLI bridge. Secrets arrive over stdin, never argv or a public HTTP route.
namespace WooDTEChile {
 final class Store { public function snapshot(array $d): array {return $GLOBALS['input']['snapshot'];} }
}
namespace {
 if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
 ini_set('display_errors','0');
 define('ABSPATH',__DIR__.'/');define('WDT_DIR',dirname(__DIR__).'/woo-dte-chile/wordpress/woo-dte-chile');
 define('WDT_SECRET_KEY',base64_encode(random_bytes(32)));
 function get_option($name,$default=[]){return $name==='wdt_settings'?($GLOBALS['input']['issuer']??[]):$default;}
 function home_url(){return getenv('SAAS_PUBLIC_URL')?:'';}
 function wp_remote_request($url,$args){
  $ch=curl_init($url);$content='';$tooLarge=false;
  curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$args['method'],CURLOPT_HTTPHEADER=>array_map(fn($k,$v)=>$k.': '.$v,array_keys($args['headers']),array_values($args['headers'])),CURLOPT_POSTFIELDS=>$args['body'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_TIMEOUT=>45,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_WRITEFUNCTION=>function($ch,$bytes)use(&$content,&$tooLarge){if(strlen($content)+strlen($bytes)>5000000){$tooLarge=true;return 0;}$content.=$bytes;return strlen($bytes);}]);
  $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);return ['error'=>$ok===false||$tooLarge,'status'=>$status,'body'=>$content];
 }
 function is_wp_error($r){return $r['error'];}function wp_remote_retrieve_response_code($r){return $r['status'];}function wp_remote_retrieve_body($r){return $r['body'];}
 foreach(['Domain','Crypto','Builder','Barcode','Delivery','Sii'] as $class)require WDT_DIR.'/includes/'.$class.'.php';
 try{
  $raw=stream_get_contents(STDIN,16000000);$input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$GLOBALS['input']=$input;
  $auth=json_decode(getenv('BILLING_PRODUCTION_AUTHORIZATIONS')?:'{}',true)[$input['tenant']??'']??null;
  if(is_array($auth)&&($auth['origin']??'')===home_url()){define('WDT_PRODUCTION_ORIGIN',$auth['origin']);define('WDT_ENABLE_PRODUCTION',$auth['rut']);}
  $action=$input['action'];$issuer=$action==='pdf'?$input['issuer']:\WooDTEChile\Config::validate($input['issuer']);
  if($action==='validate'){
   if(!empty($input['certificate']))\WooDTEChile\Certificate::fromP12(base64_decode($input['certificate'],true),$input['password']);
   $result=['issuer'=>$issuer];
  }elseif($action==='snapshot'){
   $s=$input['snapshot'];$type=(int)$s['type'];if(!in_array($type,[33,39,56,61],true))throw new \WooDTEChile\Failure('Tipo DTE inválido.');
   $r=$s['receiver'];if($type===39)$r+=['rut'=>'66666666-6','name'=>'Consumidor final','giro'=>'','address'=>'','commune'=>''];
   $r['rut']=\WooDTEChile\Rules::rut($r['rut']??'');$r['name']=\WooDTEChile\Rules::text($r['name']??'',100);
   foreach(['giro'=>40,'address'=>70,'commune'=>20] as $field=>$max)$r[$field]=($type===33||!empty($r[$field]))?\WooDTEChile\Rules::text($r[$field]??'',$max):'';
   $s['receiver']=$r;if(isset($s['reference'])){$s['reference']['reason']=\WooDTEChile\Rules::text($s['reference']['reason']??'',90);\WooDTEChile\Rules::date($s['reference']['date']);}
   $s['totals']=\WooDTEChile\Rules::totals($s['lines']);if($type===33||$type===39)if($s['totals']['net']<1)throw new \WooDTEChile\Failure('DTE completamente exento fuera de alcance.');
   $s['issuer']=$issuer;$s['date']=substr(\WooDTEChile\Rules::now(),0,10);$result=$s;
  }elseif($action==='caf'){
   // Public trust anchors are provisioned by the operator, never accepted from browser input.
   $xml=$input['xml'];$caf=new \WooDTEChile\Caf($xml,$issuer['rut']);
   $keys=json_decode(getenv('BILLING_SII_CAF_KEYS')?:'{}',true);$key=$keys[$issuer['environment']][$caf->data['idk']]??null;
   if(!$key)throw new \WooDTEChile\Failure('Configure la llave pública oficial SII para el ambiente/IDK.');
   $caf=new \WooDTEChile\Caf($xml,$issuer['rut'],$key);if($caf->expiry()<substr(\WooDTEChile\Rules::now(),0,10))throw new \WooDTEChile\Failure('CAF vencido.');
   $result=$caf->data+['expires'=>$caf->expiry()];
  }elseif($action==='pdf'){
   $d=$input['document'];$d['ted']=\WooDTEChile\Vault::encrypt(base64_decode($input['ted'],true));$result=['base64'=>base64_encode(\WooDTEChile\Delivery::pdf(new \WooDTEChile\Store(),$d))];
  }else{
   $cert=\WooDTEChile\Certificate::fromP12(base64_decode($input['certificate'],true),$input['password']);
   if($action==='build'){
    $s=$input['snapshot'];$s['date']=substr(\WooDTEChile\Rules::now(),0,10);$caf=new \WooDTEChile\Caf($input['caf'],$issuer['rut']);
    $built=\WooDTEChile\Builder::build($s,(int)$input['folio'],$caf,$cert);$result=['xml'=>base64_encode($built['xml']),'ted'=>base64_encode($built['ted']),'date'=>$s['date']];
   }else{
    $sii=new \WooDTEChile\Sii($issuer,$cert);$d=$input['document'];$token=$sii->token((int)$d['type']===39);
    if($action==='send')$result=$sii->send($d,base64_decode($input['xml'],true),$token);
    elseif($action==='status')$result=$sii->status($d,$input['snapshot'],$token);
    else throw new \WooDTEChile\Failure('Operación inválida.');
   }
  }
  echo json_encode(['ok'=>true,'result'=>$result],JSON_THROW_ON_ERROR);
 }catch(\Throwable $e){echo json_encode(['ok'=>false,'retryable'=>$e instanceof \WooDTEChile\Retryable,'error'=>$e instanceof \WooDTEChile\Failure?$e->getMessage():'Error interno del motor fiscal.']);exit(1);}
}
