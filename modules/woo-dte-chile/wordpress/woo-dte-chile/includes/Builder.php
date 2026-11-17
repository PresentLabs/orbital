<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Builder {
    public static function build(array $s, int $folio, Caf $caf, Certificate $cert): array {
        $boleta = $s['type'] === 39;
        $d = new \DOMDocument('1.0','ISO-8859-1');
        $env = Xml::add($d, $boleta ? 'EnvioBOLETA' : 'EnvioDTE'); $env->setAttribute('version','1.0');
        $set = Xml::add($env,'SetDTE'); $set->setAttribute('ID','SetDTE');
        $car = Xml::add($set,'Caratula'); $car->setAttribute('version','1.0');
        $c = $s['issuer'];
        foreach (['RutEmisor'=>$c['rut'],'RutEnvia'=>$c['sender'],'RutReceptor'=>'60803000-K','FchResol'=>$c['resolution_date'],'NroResol'=>$c['resolution_number'],'TmstFirmaEnv'=>Rules::now()] as $k=>$v) Xml::add($car,$k,$v);
        $sub = Xml::add($car,'SubTotDTE'); Xml::add($sub,'TpoDTE',$s['type']); Xml::add($sub,'NroDTE',1);
        $dte = Xml::add($set,'DTE'); $dte->setAttribute('version','1.0');
        $doc = Xml::add($dte,'Documento'); $doc->setAttribute('ID','T'.$s['type'].'F'.$folio);
        $head = Xml::add($doc,'Encabezado'); $id = Xml::add($head,'IdDoc');
        foreach (['TipoDTE'=>$s['type'],'Folio'=>$folio,'FchEmis'=>$s['date']] as $k=>$v) Xml::add($id,$k,$v);
        if (!empty($s['no_vat_reduction']) && $s['type']===61) Xml::add($id,'IndNoRebaja',1);
        if ($boleta) Xml::add($id,'IndServicio',3);
        else { Xml::add($id,'MntBruto',1); if ($s['type'] === 33) Xml::add($id,'FmaPago',1); }
        $em = Xml::add($head,'Emisor');
        foreach (['RUTEmisor'=>$c['rut'],($boleta?'RznSocEmisor':'RznSoc')=>$c['name'],($boleta?'GiroEmisor':'GiroEmis')=>$c['giro']] as $k=>$v) Xml::add($em,$k,$v);
        if (!$boleta) Xml::add($em,'Acteco',$c['activity']);
        Xml::add($em,'DirOrigen',$c['address']); Xml::add($em,'CmnaOrigen',$c['commune']);
        $r = $s['receiver']; $re = Xml::add($head,'Receptor');
        Xml::add($re,'RUTRecep',$r['rut']); Xml::add($re,'RznSocRecep',$r['name']);
        if (!$boleta && !empty($r['giro'])) Xml::add($re,'GiroRecep',$r['giro']);
        foreach (['DirRecep'=>'address','CmnaRecep'=>'commune'] as $k=>$v) if (!empty($r[$v])) Xml::add($re,$k,$r[$v]);
        $t = $s['totals']; $tot = Xml::add($head,'Totales');
        if ($t['net']) Xml::add($tot,'MntNeto',$t['net']);
        if ($t['exempt']) Xml::add($tot,'MntExe',$t['exempt']);
        if (!$boleta && $t['net']) Xml::add($tot,'TasaIVA',19);
        if ($t['net']) Xml::add($tot,'IVA',$t['vat']);
        Xml::add($tot,'MntTotal',$t['total']);
        foreach ($s['lines'] as $i=>$line) {
            $det = Xml::add($doc,'Detalle'); Xml::add($det,'NroLinDet',$i+1);
            if ($line['exempt']) Xml::add($det,'IndExe',1);
            Xml::add($det,'NmbItem',$line['name']);
            if (!empty($line['description'])) Xml::add($det,'DscItem',$line['description']);
            // Unit price after WooCommerce discounts; MontoItem retains the reconciled CLP total.
            $quantity=(float)($line['quantity']??1);
            Xml::add($det,'QtyItem',rtrim(rtrim(sprintf('%.6F',$quantity),'0'),'.')); Xml::add($det,'PrcItem',rtrim(rtrim(sprintf('%.6F',$line['amount']/$quantity),'0'),'.')); Xml::add($det,'MontoItem',$line['amount']);
        }
        if (isset($s['reference'])) {
            $ref = Xml::add($doc,'Referencia'); $r = $s['reference'];
            foreach (['NroLinRef'=>1,'TpoDocRef'=>$r['type'],'FolioRef'=>$r['folio'],'FchRef'=>$r['date'],'CodRef'=>$r['code'],'RazonRef'=>$r['reason']] as $k=>$v) Xml::add($ref,$k,$v);
        }
        $ted = $caf->ted($doc,$s,$folio); Xml::add($doc,'TmstFirma',Rules::now());
        $cert->sign($doc,$dte); $cert->sign($set,$env);
        $bytes = $d->saveXML(); $roundtrip = Xml::load($bytes); Xml::validate($roundtrip,$boleta);
        return ['xml'=>$bytes,'ted'=>$ted];
    }
}
