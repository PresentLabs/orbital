<?php
// Entirely synthetic credentials, created only for isolated local tests.
define('ABSPATH',__DIR__.'/');define('WDT_DIR',dirname(__DIR__,2).'/woo-dte-chile/wordpress/woo-dte-chile');
require WDT_DIR.'/includes/Domain.php';require WDT_DIR.'/includes/Crypto.php';require WDT_DIR.'/tests/fixtures.php';
$c=fixtureCertificate();openssl_pkcs12_export($c->cert,$p12,$c->key,'test-only');
$trust=openssl_pkey_new(['private_key_bits'=>1024,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);$public=openssl_pkey_get_details($trust)['key'];$cafs=[];
foreach([33,39,56,61] as $type){$caf=fixtureCaf($type,fixtureIssuer()['rut']);$da=$caf->xml->getElementsByTagName('DA')->item(0);openssl_sign(WooDTEChile\Xml::compact($da),$sig,$trust,OPENSSL_ALGO_SHA1);$caf->xml->getElementsByTagName('FRMA')->item(0)->nodeValue=base64_encode($sig);$cafs[$type]=$caf->xml->saveXML();}
echo json_encode(['issuer'=>fixtureIssuer(),'certificate'=>base64_encode($p12),'password'=>'test-only','cafs'=>$cafs,'public'=>$public]);
