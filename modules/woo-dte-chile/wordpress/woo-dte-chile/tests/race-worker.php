<?php
if (PHP_SAPI!=='cli' || !getenv('WDT_TEST_WORDPRESS')) exit(2);
define('WDT_SECRET_KEY',base64_encode(str_repeat('x',32))); define('DISABLE_WP_CRON',true);
require getenv('WDT_TEST_WORDPRESS').'/wp-load.php';
if(DB_NAME!=='wdt_test' || home_url()!=='http://wdt.test') exit(3);
wp_set_current_user(1); $svc=new WooDTEChile\Service(new WooDTEChile\Store());
try {
 if (($argv[1]??'')==='credit') $r=$svc->adjustment((int)$argv[2],61,(int)$argv[3],'Race test',(string)$argv[4]);
 elseif (($argv[1]??'')==='reserve') $r=$svc->store->reserve($svc->store->get((int)$argv[2]));
 else $r=$svc->issue((int)$argv[2]);
 echo json_encode(['ok'=>true,'id'=>$r['id'],'folio'=>$r['folio']]);
} catch (Throwable $e) { echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); }
