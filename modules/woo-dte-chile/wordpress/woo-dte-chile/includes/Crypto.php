<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Xml {
    public const NS = 'http://www.sii.cl/SiiDte';
    public static function load(string $xml): \DOMDocument {
        if (strlen($xml) > 5000000 || preg_match('/<!DOCTYPE|<!ENTITY/i', $xml)) throw new Failure('XML inseguro o demasiado grande.');
        $prev = libxml_use_internal_errors(true);
        try {
            $d = new \DOMDocument(); $d->preserveWhiteSpace = true;
            if (!$d->loadXML($xml, LIBXML_NONET) || $d->doctype) throw new Failure('XML inválido.');
            return $d;
        } finally { libxml_clear_errors(); libxml_use_internal_errors($prev); }
    }
    public static function value(\DOMNode $d, string $name): string {
        $xp = new \DOMXPath($d instanceof \DOMDocument ? $d : $d->ownerDocument);
        return trim($xp->evaluate('string(.//*[local-name()="'.$name.'"][1])', $d));
    }
    public static function add(\DOMNode $p, string $name, $value = null, ?string $ns = self::NS): \DOMElement {
        $d = $p instanceof \DOMDocument ? $p : $p->ownerDocument;
        $e = $d->createElementNS($ns, $name); $p->appendChild($e);
        if ($value !== null) $e->appendChild($d->createTextNode((string)$value));
        return $e;
    }
    public static function latin(string $s): string { return mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8'); }
    public static function compact(\DOMNode $node): string {
        $copy = new \DOMDocument('1.0','ISO-8859-1'); $copy->appendChild($copy->importNode($node, true));
        $xp = new \DOMXPath($copy);
        foreach ($xp->query('//text()[normalize-space(.)=""]') as $n) $n->parentNode->removeChild($n);
        return self::latin($copy->saveXML($copy->documentElement));
    }
    public static function validate(\DOMDocument $d, bool $boleta): void {
        $file = WDT_DIR.'/schemas/'.($boleta ? 'boleta/EnvioBOLETA_v11.xsd' : 'dte/EnvioDTE_v10.xsd');
        $prev = libxml_use_internal_errors(true);
        try {
            if (!$d->schemaValidate($file)) {
                $errs = array_map(static fn($e)=>trim($e->message), libxml_get_errors());
                throw new Failure('XSD: '.implode(' | ', array_slice($errs, 0, 3)));
            }
        } finally { libxml_clear_errors(); libxml_use_internal_errors($prev); }
    }
}

final class Certificate {
    public function __construct(public string $key, public string $cert) {
        $p = openssl_x509_parse($cert);
        if (!$p || $p['validFrom_time_t'] > time() || $p['validTo_time_t'] <= time() || !openssl_x509_check_private_key($cert, $key)) throw new Failure('Certificado vencido, no vigente o no coincide con su clave.');
        $details = openssl_pkey_get_details(openssl_pkey_get_private($key));
        if ($details['type'] !== OPENSSL_KEYTYPE_RSA || $details['bits'] < 2048) throw new Failure('Se requiere certificado RSA de al menos 2048 bits.');
    }
    public static function fromP12(string $bytes, string $password): self {
        if (!openssl_pkcs12_read($bytes, $p, $password)) throw new Failure('Certificado PKCS#12 o contraseña inválidos.');
        return new self($p['pkey'], $p['cert']);
    }
    public static function stored(): self {
        $p = json_decode(Vault::decrypt(get_option('wdt_certificate','')), true, 512, JSON_THROW_ON_ERROR);
        return new self($p['key'], $p['cert']);
    }
    public function sign(\DOMElement $target, \DOMElement $parent, bool $enveloped = false): void {
        $ns = 'http://www.w3.org/2000/09/xmldsig#';
        $c14 = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
        $digest = base64_encode(sha1($target->C14N(), true));
        $sig = Xml::add($parent,'Signature',null,$ns);
        $si = Xml::add($sig,'SignedInfo',null,$ns);
        Xml::add($si,'CanonicalizationMethod',null,$ns)->setAttribute('Algorithm',$c14);
        Xml::add($si,'SignatureMethod',null,$ns)->setAttribute('Algorithm',$ns.'rsa-sha1');
        $ref = Xml::add($si,'Reference',null,$ns); $ref->setAttribute('URI',$enveloped ? '' : '#'.$target->getAttribute('ID'));
        $transforms = Xml::add($ref,'Transforms',null,$ns);
        Xml::add($transforms,'Transform',null,$ns)->setAttribute('Algorithm',$enveloped ? $ns.'enveloped-signature' : $c14);
        Xml::add($ref,'DigestMethod',null,$ns)->setAttribute('Algorithm',$ns.'sha1');
        Xml::add($ref,'DigestValue',$digest,$ns);
        if (!openssl_sign($si->C14N(), $signature, $this->key, OPENSSL_ALGO_SHA1)) throw new Failure('No se pudo firmar XML.');
        Xml::add($sig,'SignatureValue',base64_encode($signature),$ns);
        $ki = Xml::add($sig,'KeyInfo',null,$ns);
        $kv = Xml::add(Xml::add($ki,'KeyValue',null,$ns),'RSAKeyValue',null,$ns);
        $p = openssl_pkey_get_details(openssl_pkey_get_private($this->key));
        Xml::add($kv,'Modulus',base64_encode($p['rsa']['n']),$ns); Xml::add($kv,'Exponent',base64_encode($p['rsa']['e']),$ns);
        Xml::add(Xml::add($ki,'X509Data',null,$ns),'X509Certificate',preg_replace('/-----[^-]+-----|\s+/', '', $this->cert),$ns);
    }
    public function seed(string $seed): string {
        if (!preg_match('/^\d+$/D',$seed)) throw new Failure('Semilla inválida.');
        $d = Xml::load('<?xml version="1.0" encoding="UTF-8"?><getToken><item><Semilla>'.$seed.'</Semilla></item></getToken>');
        $this->sign($d->documentElement,$d->documentElement,true);
        return rtrim($d->saveXML());
    }
}

final class Caf {
    public \DOMDocument $xml;
    public array $data;
    public function __construct(string $xml, string $rut, ?string $trustedKey = null) {
        $this->xml = Xml::load($xml);
        $xp = new \DOMXPath($this->xml);
        if ($xp->query('/AUTORIZACION/CAF')->length !== 1) throw new Failure('Estructura CAF inválida.');
        $caf = $xp->query('/AUTORIZACION/CAF')->item(0); $da = $xp->query('DA',$caf)->item(0);
        if (!$da) throw new Failure('CAF sin datos.');
        $type = (int)Xml::value($da,'TD');
        $this->data = ['rut'=>Rules::rut(Xml::value($da,'RE')),'type'=>$type,'start'=>(int)Xml::value($da,'D'),'end'=>(int)Xml::value($da,'H'),'date'=>Rules::date(Xml::value($da,'FA')),'idk'=>Xml::value($da,'IDK')];
        if ($this->data['rut'] !== $rut || !in_array($type,[33,39,56,61],true) || $this->data['start'] < 1 || $this->data['end'] < $this->data['start']) throw new Failure('CAF no corresponde al emisor, tipo o rango.');
        $private = openssl_pkey_get_private(Xml::value($this->xml,'RSASK'));
        if (!$private) throw new Failure('CAF sin clave privada válida.');
        $details = openssl_pkey_get_details($private);
        if (!isset($details['rsa']) || ltrim(base64_decode(Xml::value($da,'M'),true) ?: '', "\0") !== ltrim($details['rsa']['n'],"\0") || (base64_decode(Xml::value($da,'E'),true) ?: '') !== $details['rsa']['e']) throw new Failure('Clave privada CAF no coincide con RSAPK.');
        if ($trustedKey !== null) {
            $frma = $xp->query('FRMA',$caf)->item(0);
            if (!$frma || $frma->getAttribute('algoritmo') !== 'SHA1withRSA' || openssl_verify(Xml::compact($da),base64_decode(trim($frma->textContent),true) ?: '',$trustedKey,OPENSSL_ALGO_SHA1) !== 1) throw new Failure('Firma SII del CAF no válida con la llave pública configurada.');
        }
    }
    public function expiry(): string {
        $date = new \DateTimeImmutable($this->data['date']);
        // Conservative six-month cap; never silently extend CAF validity.
        $month = $date->modify('first day of this month')->modify('+6 months');
        $day = min((int)$date->format('d'), (int)$month->format('t'));
        return $month->setDate((int)$month->format('Y'), (int)$month->format('m'), $day)->format('Y-m-d');
    }
    public function ted(\DOMElement $document, array $s, int $folio): string {
        if ($folio < $this->data['start'] || $folio > $this->data['end'] || $s['date'] < $this->data['date'] || $s['date'] > $this->expiry()) throw new Failure('Folio o fecha fuera de autorización CAF.');
        $d = Xml::load('<TED version="1.0"><DD/></TED>'); $dd = $d->documentElement->firstChild;
        foreach (['RE'=>$s['issuer']['rut'],'TD'=>$s['type'],'F'=>$folio,'FE'=>$s['date'],'RR'=>$s['receiver']['rut'],'RSR'=>mb_substr($s['receiver']['name'],0,40),'MNT'=>$s['totals']['total'],'IT1'=>mb_substr($s['lines'][0]['name'],0,40)] as $k=>$v) Xml::add($dd,$k,$v,null);
        $caf = $this->xml->getElementsByTagName('CAF')->item(0);
        $dd->appendChild($d->importNode($caf,true));
        Xml::add($dd,'TSTED',Rules::now(),null);
        $bytes = Xml::compact($dd);
        if (!openssl_sign($bytes,$signature,Xml::value($this->xml,'RSASK'),OPENSSL_ALGO_SHA1)) throw new Failure('No se pudo firmar TED.');
        Xml::add($d->documentElement,'FRMT',base64_encode($signature),null)->setAttribute('algoritmo','SHA1withRSA');
        $ted = Xml::compact($d->documentElement);
        // Parse inside the SII namespace; the TED signature itself is on standalone DD bytes.
        $fragment = Xml::load('<?xml version="1.0" encoding="ISO-8859-1"?><root xmlns="'.Xml::NS.'">'.$ted.'</root>');
        $document->appendChild($document->ownerDocument->importNode($fragment->documentElement->firstChild,true));
        return $ted;
    }
}
