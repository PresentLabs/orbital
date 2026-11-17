<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Delivery {
    public static function xml(Store $store,array $d): string {
        if (!$d['xml']) throw new Failure('XML todavía no generado.');
        $xml=Vault::decrypt($d['xml']);
        if (!hash_equals($d['xml_hash'],hash('sha256',$xml))) throw new Failure('Huella XML inválida.');
        return $xml; // Export the exact signed envelope; never reserialize signed content.
    }
    public static function pdf(Store $store,array $d): string {
        if (!$d['ted']) throw new Failure('Timbre todavía no generado.');
        require_once WDT_DIR.'/vendor/autoload.php';
        $s=$store->snapshot($d);
        $pdf=new class('P','mm','A4',true,'UTF-8',false) extends \TCPDF { public function Error($msg) { throw new Failure('No se pudo generar PDF: '.$msg); } }; $pdf->setPrintHeader(false); $pdf->setPrintFooter(false);
        $pdf->SetMargins(18,16,18); $pdf->SetAutoPageBreak(true,18); $pdf->SetCreator('Woo DTE Chile 0.2.0'); $pdf->AddPage();
        $c=$s['issuer']; $r=$s['receiver'];
        $label=[33=>'FACTURA ELECTRÓNICA',39=>'BOLETA ELECTRÓNICA',61=>'NOTA DE CRÉDITO ELECTRÓNICA',56=>'NOTA DE DÉBITO ELECTRÓNICA'][(int)$d['type']];
        $pdf->SetFont('helvetica','',9);
        if ($d['environment']==='certification') { $pdf->SetTextColor(170,0,0); $pdf->MultiCell(0,6,'CERTIFICACIÓN — DOCUMENTO DE PRUEBA, SIN VALIDEZ TRIBUTARIA',0,'L'); $pdf->SetTextColor(0,0,0); }
        $top=$pdf->GetY()+4;
        $pdf->SetFont('helvetica','B',12); $pdf->SetXY(18,$top); $pdf->MultiCell(90,6,$c['name'],0,'L');
        $pdf->SetFont('helvetica','',10); $pdf->MultiCell(90,6,$c['giro']."\n".$c['address'].', '.$c['commune'],0,'L');
        $pdf->SetLineWidth(.6); $pdf->Rect(117,$top,75,32); $pdf->SetXY(119,$top+2); $pdf->SetFont('helvetica','B',10);
        $pdf->MultiCell(71,6,'R.U.T.: '.$c['rut']."\n".$label."\nNº ".$d['folio'],0,'C');
        $pdf->SetXY(117,$top+34); $pdf->SetFont('helvetica','',9); $pdf->MultiCell(75,5,'S.I.I. — '.$c['sii_office'],0,'C');
        $pdf->SetY(max($top+43,$pdf->GetY()+5)); $pdf->SetFont('helvetica','',10);
        $pdf->MultiCell(0,6,'Fecha: '.$s['date']."\nReceptor: ".$r['name'].' | RUT '.$r['rut']."\n".($r['giro']?:'')."\n".$r['address'].', '.$r['commune'],0,'L');
        if (!in_array($d['state'],['accepted','accepted_with_repair'],true)) $pdf->MultiCell(0,6,'Estado SII pendiente o no aceptado: '.$d['state'],0,'L');
        $pdf->Ln(4);
        $pdf->SetFont('helvetica','B',10); $pdf->Cell(132,8,'Detalle (montos brutos CLP)',0,0); $pdf->Cell(40,8,'Monto',0,1,'R'); $pdf->SetFont('helvetica','',10);
        foreach ($s['lines'] as $l) {
            if ($pdf->GetY()>235) $pdf->AddPage();
            $y=$pdf->GetY(); $pdf->MultiCell(132,6,$l['name'].($l['exempt']?' (exento)':'').' — Cantidad: '.($l['quantity']??1),0,'L'); $height=max(7,$pdf->GetY()-$y);
            $pdf->SetXY(150,$y); $pdf->Cell(42,$height,number_format($l['amount'],0,',','.'),0,1,'R');
        }
        $pdf->Ln(4);
        foreach (['net'=>'Neto','exempt'=>'Exento','vat'=>'IVA 19%','total'=>'TOTAL CLP'] as $k=>$name) $pdf->MultiCell(0,6,$name.': '.number_format($s['totals'][$k],0,',','.'),0,'R');
        if (isset($s['reference'])) { $r=$s['reference']; $pdf->MultiCell(0,6,'Referencia: DTE '.$r['type'].' Nº '.$r['folio'].' del '.$r['date']."\nCódigo ".$r['code'].': '.$r['reason'],0,'L'); }
        $matrix=Barcode::matrix(Vault::decrypt($d['ted']));
        $module=max(.18,50/$matrix['num_cols'],20/$matrix['num_rows']);
        $width=$module*$matrix['num_cols']; $height=$module*$matrix['num_rows'];
        if ($width>90 || $height>40) throw new Failure('Dimensiones del timbre fuera de límites de impresión.');
        $needed=$height+43+((int)$d['type']===33?28:0);
        if ($pdf->GetY()+$needed>279) $pdf->AddPage();
        $y=max($pdf->GetY()+7,279-$needed);
        $raw=implode(',',array_map(static fn($row)=>implode('',$row),$matrix['bcode']));
        $pdf->write2DBarcode($raw,'RAW',26.35,$y,$width,$height,['border'=>false,'padding'=>0,'fgcolor'=>[0,0,0],'bgcolor'=>[255,255,255]],'N');
        $pdf->SetY($y+$height+6.35); $pdf->SetFont('helvetica','',8);
        $pdf->MultiCell(0,5,'Timbre Electrónico SII. Resolución '.$c['resolution_number'].' del '.$c['resolution_date']."\nVerifique documento en www.sii.cl\nEstado registrado: ".$d['state'].($d['type']==61?"\nEsta nota de crédito reduce el saldo del documento de referencia.":''),0,'L');
        if ((int)$d['type']===33) $pdf->MultiCell(0,5,"Nombre: __________________ RUT: ______________ Fecha: __________\nRecinto: __________________ Firma: ____________________________\nEl acuse de recibo que se declara en este acto, de acuerdo a lo dispuesto en la letra b) del Art. 4º, y la letra c) del Art. 5º de la Ley 19.983, acredita que la entrega de mercaderías o servicio(s) prestado(s) ha(n) sido recibido(s).",0,'L');
        return $pdf->Output('dte.pdf','S');
    }
    public static function email(Store $store,int $id,bool $resend=false): void {
        $store->lock('email:'.$id,function() use($store,$id,$resend) {
            $d=$store->get($id);
            if (!in_array($d['state'],['accepted','accepted_with_repair'],true)) throw new Failure('Solo se envían documentos aceptados.');
            if (!$resend && $d['email_state']!=='pending') return;
            $s=$store->snapshot($d); $target=$d['environment']==='production'?$s['email']:get_option('admin_email');
            if (!is_email($target)) { $store->update($store->docs,['email_state'=>'failed'],$id); $store->event($id,(int)$d['order_id'],'mail_invalid_recipient'); throw new Failure('Correo destinatario inválido.'); }
            $store->update($store->docs,['email_state'=>'sending'],$id);
            $files=[]; $dir=rtrim(sys_get_temp_dir(),'/').'/wdt-'.bin2hex(random_bytes(16));
            try {
                if (!mkdir($dir,0700)) throw new Failure('No se pudo crear carpeta temporal privada.');
                foreach (['xml'=>self::xml($store,$d),'pdf'=>self::pdf($store,$d)] as $ext=>$content) {
                    $file=$dir.'/DTE-'.$d['type'].'-'.$d['folio'].'.'.$ext;
                    if (file_put_contents($file,$content)===false) throw new Failure('No se pudo crear adjunto.');
                    chmod($file,0600); $files[]=$file;
                }
                $ok=wp_mail($target,($d['environment']==='certification'?'[PRUEBA SII] ':'').'Documento tributario '.$d['type'].' Nº '.$d['folio'],'Adjuntamos el XML y la representación PDF del documento. Estado SII: '.$d['state'].'.',[],$files);
                $store->update($store->docs,['email_state'=>$ok?'sent':'failed'],$id);
                $store->event($id,(int)$d['order_id'],$ok?'mail_accepted_by_transport':'mail_failed');
            } catch (\Throwable $e) {
                $store->update($store->docs,['email_state'=>'failed'],$id); $store->event($id,(int)$d['order_id'],'mail_failed'); throw $e;
            } finally { foreach ($files as $file) @unlink($file); if (is_dir($dir)) @rmdir($dir); }
        });
    }
}
