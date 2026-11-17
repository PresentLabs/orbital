<?php
if (PHP_SAPI!=='cli') exit;
// Offline tests use synthetic keys only; never contact SII.
define('ABSPATH',__DIR__.'/'); define('WDT_DIR',dirname(__DIR__));
define('WDT_SECRET_KEY',base64_encode(str_repeat('x',32)));
foreach (['Domain','Crypto','Builder','Sii'] as $f) require_once WDT_DIR.'/includes/'.$f.'.php';
use WooDTEChile\{Rules,Xml,Caf,Certificate,Builder,Vault,Sii,Failure};
$count=0;
function check(bool $ok,string $name): void { global $count; if (!$ok) throw new RuntimeException($name); $count++; echo "PASS $name\n"; }
function rejects(callable $f,string $name): void { try { $f(); } catch (Throwable $e) { check(true,$name); return; } throw new RuntimeException('Expected rejection: '.$name); }
require __DIR__.'/fixtures.php';
check(Rules::rut('76.123.456-0')==='76123456-0','RUT normalization and checksum');
rejects(fn()=>Rules::rut('76123456-1'),'invalid RUT');
rejects(fn()=>Rules::pesos('-1'),'negative CLP'); rejects(fn()=>Rules::pesos('100.5'),'fractional CLP'); rejects(fn()=>Rules::pesos('1e5'),'scientific notation');
check(Rules::totals([['name'=>'A','amount'=>1190,'exempt'=>false],['name'=>'B','amount'=>50,'exempt'=>true]])===['net'=>1000,'vat'=>190,'exempt'=>50,'total'=>1240],'mixed totals');
Rules::credit(1000,400,600,false); check(true,'credit remaining balance');
rejects(fn()=>Rules::credit(1000,400,601,false),'overcredit'); rejects(fn()=>Rules::credit(1000,400,600,true),'cancellation after partial NC');
rejects(fn()=>Rules::environment('simulation'),'no simulation environment');
rejects(fn()=>\WooDTEChile\Config::gate(['environment'=>'production','rut'=>'76123456-0']),'production gate');
$sealed=Vault::encrypt('private key data'); check(Vault::decrypt($sealed)==='private key data','secret encryption roundtrip');
$bad=base64_decode($sealed); $bad[30]=chr(ord($bad[30])^1); rejects(fn()=>Vault::decrypt(base64_encode($bad)),'secret tamper detection');
rejects(fn()=>Xml::load('<!DOCTYPE a [<!ENTITY b SYSTEM "file:///etc/passwd">]><a>&b;</a>'),'XXE blocked');
$cert=fixtureCertificate(); $issuer=fixtureIssuer();
foreach ([33,39,56,61] as $type) {
    $caf=fixtureCaf($type,$issuer['rut']);
    $s=fixtureSnapshot($type,$issuer);
    $built=Builder::build($s,1,$caf,$cert);
    $d=Xml::load($built['xml']); Xml::validate($d,$type===39); check(true,"XSD DTE $type with official schemas");
    verifySignatures($d); check(true,"XML signatures DTE $type and envelope");
    $ted=Xml::load('<?xml version="1.0" encoding="ISO-8859-1"?>'.$built['ted']);
    $dd=$ted->getElementsByTagName('DD')->item(0);
    $private=openssl_pkey_get_private(Xml::value($caf->xml,'RSASK')); $public=openssl_pkey_get_details($private)['key'];
    check(openssl_verify(Xml::compact($dd),base64_decode(Xml::value($ted,'FRMT')),$public,OPENSSL_ALGO_SHA1)===1,"TED signature $type");
    if (getenv('WDT_FIXTURE_OUTPUT')) { file_put_contents(getenv('WDT_FIXTURE_OUTPUT').'/'.$type.'.xml',$built['xml']); }
}
$seed=Xml::load($cert->seed('030530912644')); verifySignatures($seed); check(true,'enveloped seed signature');
check(Sii::summary('REC',1,1,0,0)==='submitted','receipt is not acceptance');
check(Sii::summary('EPR',1,1,0,0)==='accepted','one accepted document');
check(Sii::summary('EPR',1,0,1,0)==='rejected','rejected document');
check(Sii::summary('EPR',2,2,0,0)==='submitted','unexpected batch not auto accepted');
check(Sii::summary('EPR',1,0,0,1)==='accepted_with_repair','repairs preserved');
check(Sii::summary('NEW_STATUS',1,1,0,0)==='submitted','unknown status not accepted');
echo "TOTAL $count tests passed\n";
