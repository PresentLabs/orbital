<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Sii {
    private string $host; private string $api; private string $upload;
    public function __construct(private array $c,private Certificate $cert) {
        Config::gate($c);
        $prod=$c['environment']==='production';
        $this->host=$prod?'https://palena.sii.cl':'https://maullin.sii.cl';
        $this->api=$prod?'https://api.sii.cl/recursos/v1':'https://apicert.sii.cl/recursos/v1';
        $this->upload=$prod?'https://rahue.sii.cl/recursos/v1':'https://pangal.sii.cl/recursos/v1';
    }
    private function request(string $url,string $method='GET',string $body='',array $headers=[]): string {
        $r=wp_remote_request($url,['method'=>$method,'body'=>$body,'headers'=>$headers+['User-Agent'=>'Woo-DTE-Chile/0.2.0','Accept'=>'application/xml, application/json'],'timeout'=>45,'redirection'=>0,'sslverify'=>true,'limit_response_size'=>5000000]);
        if (is_wp_error($r)) throw new Retryable('SII_TRANSPORT');
        $code=wp_remote_retrieve_response_code($r);
        if ($code<200 || $code>=300) throw new Retryable('SII_HTTP_'.$code);
        return wp_remote_retrieve_body($r);
    }
    private function soap(string $service,string $method,array $args): \DOMDocument {
        $url=$this->host.'/DTEWS/'.$service.'.jws';
        $d=new \DOMDocument('1.0','UTF-8');
        $env=Xml::add($d,'soap:Envelope',null,'http://schemas.xmlsoap.org/soap/envelope/');
        $env->setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:xsi','http://www.w3.org/2001/XMLSchema-instance');
        $env->setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:xsd','http://www.w3.org/2001/XMLSchema');
        $body=Xml::add($env,'soap:Body',null,'http://schemas.xmlsoap.org/soap/envelope/');
        $call=Xml::add($body,'m:'.$method,null,$url);
        $call->setAttributeNS('http://schemas.xmlsoap.org/soap/envelope/','soap:encodingStyle','http://schemas.xmlsoap.org/soap/encoding/');
        foreach ($args as $k=>$v) { $node=Xml::add($call,$k,$v,null); $node->setAttributeNS('http://www.w3.org/2001/XMLSchema-instance','xsi:type','xsd:string'); }
        $r=Xml::load($this->request($url,'POST',$d->saveXML(),['Content-Type'=>'text/xml; charset=UTF-8','SOAPAction'=>'""']));
        $inner=Xml::value($r,$method.'Return');
        if (!$inner) throw new Retryable('SII_SOAP_RESPONSE');
        return Xml::load($inner);
    }
    public function token(bool $boleta): string {
        if ($boleta) {
            $seed=Xml::load($this->request($this->api.'/boleta.electronica.semilla'));
            $response=Xml::load($this->request($this->api.'/boleta.electronica.token','POST',$this->cert->seed(Xml::value($seed,'SEMILLA')),['Content-Type'=>'application/xml']));
        } else {
            $seed=$this->soap('CrSeed','getSeed',[]);
            $response=$this->soap('GetTokenFromSeed','getToken',['pszXml'=>$this->cert->seed(Xml::value($seed,'SEMILLA'))]);
        }
        $token=Xml::value($response,'TOKEN');
        if (!preg_match('/^[A-Za-z0-9]{5,100}$/D',$token)) throw new Retryable('SII_AUTH');
        return $token;
    }
    public function send(array $d,string $xml,string $token): array {
        [$rut,$dv]=explode('-',$d['issuer']); [$sender,$sdv]=explode('-',$this->c['sender']);
        $boundary='wdt'.bin2hex(random_bytes(18)); $body='';
        foreach (['rutSender'=>$sender,'dvSender'=>$sdv,'rutCompany'=>$rut,'dvCompany'=>$dv] as $k=>$v) $body.="--$boundary\r\nContent-Disposition: form-data; name=\"$k\"\r\n\r\n$v\r\n";
        $body.="--$boundary\r\nContent-Disposition: form-data; name=\"archivo\"; filename=\"dte.xml\"\r\nContent-Type: text/xml\r\n\r\n$xml\r\n--$boundary--\r\n";
        $boleta=(int)$d['type']===39;
        $raw=$this->request($boleta?$this->upload.'/boleta.electronica.envio':$this->host.'/cgi_dte/UPL/DTEUpload','POST',$body,['Cookie'=>'TOKEN='.$token,'Content-Type'=>'multipart/form-data; boundary='.$boundary]);
        if ($boleta) { $r=json_decode($raw,true,512,JSON_THROW_ON_ERROR); $track=(string)($r['trackid']??''); $code=(string)($r['estado']??''); if (($r['rut_emisor']??'')!==$d['issuer']) throw new Retryable('SII_ISSUER_MISMATCH'); }
        else { $r=Xml::load($raw); $track=Xml::value($r,'TRACKID'); $code=Xml::value($r,'STATUS'); }
        if (!in_array($code,['REC','0'],true) || !preg_match('/^[1-9][0-9]{0,30}$/D',$track)) throw new Retryable('SII_UPLOAD_UNCONFIRMED');
        return ['track'=>$track,'raw'=>$raw];
    }
    public static function summary(string $code,int $informed,int $accepted,int $rejected,int $repairs): string {
        if (in_array($code,['RSC','RFR','RCT','RCH'],true)) return 'rejected';
        if ($code !== 'EPR' || $informed !== 1) return 'submitted';
        if ($rejected===1 && $accepted===0) return 'rejected';
        if ($repairs>0) return 'accepted_with_repair';
        if ($accepted===1 && $rejected===0) return 'accepted';
        return 'submitted';
    }
    public function status(array $d,array $s,string $token): array {
        $boleta=(int)$d['type']===39;
        [$rut,$dv]=explode('-',$d['issuer']);
        if ($d['track_id']) {
            if ($boleta) {
                $raw=$this->request($this->api.'/boleta.electronica.envio/'.$rut.'-'.$dv.'-'.$d['track_id'],'GET','',['Cookie'=>'TOKEN='.$token]);
                $r=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
                if (($r['rut_emisor']??'') !== $d['issuer'] || (string)($r['trackid']??'') !== (string)$d['track_id']) throw new Retryable('SII_TRACK_MISMATCH');
                $stat=[]; foreach (($r['estadistica']??[]) as $st) if ((int)$st['tipo']===(int)$d['type']) $stat=$st;
                $code=(string)($r['estado']??'');
                $state=self::summary($code,(int)($stat['informados']??0),(int)($stat['aceptados']??0),(int)($stat['rechazados']??0),(int)($stat['reparos']??0));
            } else {
                $r=$this->soap('QueryEstUp','getEstUp',['RutCompania'=>$rut,'DvCompania'=>$dv,'TrackId'=>$d['track_id'],'Token'=>$token]);
                $raw=$r->saveXML(); $code=Xml::value($r,'ESTADO');
                $state=self::summary($code,(int)Xml::value($r,'INFORMADOS'),(int)Xml::value($r,'ACEPTADOS'),(int)Xml::value($r,'RECHAZADOS'),(int)Xml::value($r,'REPAROS'));
            }
            return ['state'=>$state,'code'=>$code,'raw'=>$raw];
        }
        [$rr,$rdv]=explode('-',$s['receiver']['rut']);
        $date=(new \DateTimeImmutable($s['date']))->format($boleta?'d-m-Y':'dmY');
        if ($boleta) {
            $url=$this->api.'/boleta.electronica/'.$rut.'-'.$dv.'-'.$d['type'].'-'.$d['folio'].'/estado?'.http_build_query(['rut_receptor'=>$rr,'dv_receptor'=>$rdv,'monto'=>$d['amount'],'fechaEmision'=>$date]);
            $raw=$this->request($url,'GET','',['Cookie'=>'TOKEN='.$token]); $r=json_decode($raw,true,512,JSON_THROW_ON_ERROR); $code=(string)($r['codigo']??'');
        } else {
            [$sender,$sdv]=explode('-',$this->c['sender']);
            $r=$this->soap('QueryEstDte','getEstDte',['RutConsultante'=>$sender,'DvConsultante'=>$sdv,'RutCompania'=>$rut,'DvCompania'=>$dv,'RutReceptor'=>$rr,'DvReceptor'=>$rdv,'TipoDte'=>$d['type'],'FolioDte'=>$d['folio'],'FechaEmisionDte'=>$date,'MontoDte'=>$d['amount'],'Token'=>$token]);
            $raw=$r->saveXML(); $code=Xml::value($r,'ESTADO');
        }
        // DOK establishes receipt and matching data, not the full validation result of the upload.
        return ['state'=>$code==='DOK'?'received_unconfirmed':'uncertain','code'=>$code,'raw'=>$raw];
    }
}
