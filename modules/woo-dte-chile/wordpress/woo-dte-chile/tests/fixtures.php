<?php
use WooDTEChile\{Rules,Xml,Caf,Certificate};
function fixtureIssuer(): array { return ['environment'=>'certification','rut'=>'76123456-0','sender'=>'76123456-0','name'=>'Pruebas Álvarez & Cía','giro'=>'Venta de artículos','activity'=>'479100','address'=>'Calle Prueba 123','commune'=>'Santiago','sii_office'=>'Santiago Centro','resolution_date'=>'2020-01-01','resolution_number'=>'0']; }
function fixtureCertificate(): Certificate {
    $k=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
    $csr=openssl_csr_new(['commonName'=>'SYNTHETIC TEST ONLY','countryName'=>'CL'],$k,['digest_alg'=>'sha256']);
    $x=openssl_csr_sign($csr,null,$k,2,['digest_alg'=>'sha256']);
    openssl_pkey_export($k,$pem); openssl_x509_export($x,$cert); return new Certificate($pem,$cert);
}
function fixtureCaf(int $type,string $rut,?string $trusted=null): Caf {
    $k=openssl_pkey_new(['private_key_bits'=>1024,'private_key_type'=>OPENSSL_KEYTYPE_RSA]); openssl_pkey_export($k,$pem); $pub=openssl_pkey_get_details($k);
    $date=substr(Rules::now(),0,10);
    $xml='<AUTORIZACION><CAF version="1.0"><DA><RE>'.$rut.'</RE><RS>Pruebas</RS><TD>'.$type.'</TD><RNG><D>1</D><H>1000</H></RNG><FA>'.$date.'</FA><RSAPK><M>'.base64_encode($pub['rsa']['n']).'</M><E>'.base64_encode($pub['rsa']['e']).'</E></RSAPK><IDK>999</IDK></DA><FRMA algoritmo="SHA1withRSA">'.base64_encode(str_repeat('a',128)).'</FRMA></CAF><RSASK>'.$pem.'</RSASK></AUTORIZACION>';
    return new Caf($xml,$rut,$trusted);
}
function fixtureSnapshot(int $type,array $issuer): array {
    $lines=[['name'=>'Producto Á & ñ','amount'=>1190,'exempt'=>false],['name'=>'Producto exento','amount'=>500,'exempt'=>true]];
    $s=['type'=>$type,'date'=>substr(Rules::now(),0,10),'issuer'=>$issuer,'receiver'=>['rut'=>'66666666-6','name'=>'Consumidor final','giro'=>'Comercio','address'=>'Calle 123','commune'=>'Santiago'],'lines'=>$lines,'totals'=>Rules::totals($lines),'email'=>'test@example.invalid'];
    if (in_array($type,[56,61],true)) $s['reference']=['type'=>33,'folio'=>10,'date'=>$s['date'],'code'=>3,'reason'=>'Devolución de producto']; return $s;
}
function verifySignatures(DOMDocument $d): void {
    $xp=new DOMXPath($d); $xp->registerNamespace('ds','http://www.w3.org/2000/09/xmldsig#');
    foreach ($xp->query('//ds:Signature') as $sig) {
        $si=$xp->query('ds:SignedInfo',$sig)->item(0); $ref=$xp->query('ds:Reference',$si)->item(0); $uri=$ref->getAttribute('URI');
        if ($uri==='') { $clone=Xml::load($d->saveXML()); $s=$clone->getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','Signature')->item(0); $s->parentNode->removeChild($s); $target=$clone->documentElement; }
        else $target=$xp->query('//*[@ID="'.substr($uri,1).'"]')->item(0);
        $expected=trim($xp->evaluate('string(ds:DigestValue)',$ref));
        if (base64_encode(sha1($target->C14N(),true))!==$expected) throw new RuntimeException('Digest mismatch '.$uri);
        $cert="-----BEGIN CERTIFICATE-----\n".chunk_split(trim($xp->evaluate('string(ds:KeyInfo/ds:X509Data/ds:X509Certificate)',$sig)),64,"\n")."-----END CERTIFICATE-----\n";
        $signature=base64_decode(trim($xp->evaluate('string(ds:SignatureValue)',$sig)));
        if (openssl_verify($si->C14N(),$signature,$cert,OPENSSL_ALGO_SHA1)!==1) throw new RuntimeException('Signature verification failed');
    }
}
