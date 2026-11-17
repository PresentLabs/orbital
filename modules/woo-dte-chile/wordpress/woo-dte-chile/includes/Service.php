<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Service {
    public function __construct(public Store $store) {}
    public static function key(array $c,string $op): string { return hash('sha256',$c['environment'].'|'.$c['rut'].'|'.$op); }
    public function schedule(int $id,int $delay=1): void {
        if (function_exists('as_schedule_single_action')) as_schedule_single_action(time()+$delay,'wdt_process',[$id],'woo-dte-chile',true);
        elseif (!wp_next_scheduled('wdt_process',[$id])) wp_schedule_single_event(time()+$delay,'wdt_process',[$id]);
    }
    private function create(string $key,int $order,int $refund,int $parent,array $s): array {
        $old=$this->store->operation($key);
        if ($old) {
            $previous=$this->store->snapshot($old);
            foreach (['type','totals','lines','reference'] as $field) if (($s[$field]??null)!==($previous[$field]??null)) throw new Failure('La clave de idempotencia ya existe con datos distintos.');
            return $old;
        }
        $t=gmdate('Y-m-d H:i:s');
        $id=$this->store->insert($this->store->docs,['op_key'=>$key,'order_id'=>$order,'refund_id'=>$refund,'parent_id'=>$parent,'environment'=>$s['issuer']['environment'],'issuer'=>$s['issuer']['rut'],'type'=>$s['type'],'amount'=>$s['totals']['total'],'snapshot'=>Vault::encrypt(wp_json_encode($s)),'state'=>'queued','next_run'=>$t,'created_at'=>$t,'updated_at'=>$t]);
        $this->store->event($id,$order,'created',['type'=>$s['type'],'parent'=>$parent,'refund'=>$refund]);
        return $this->store->get($id);
    }
    public function issue(int $orderId,?int $type=null): array {
        $c=Config::validate(Config::get());
        $key=self::key($c,'order:'.$orderId);
        $d=$this->store->lock('order:'.$orderId,function() use($orderId,$type,$c,$key) {
            $existing=$this->store->operation($key);
            if ($existing) {
                if ($type && (int)$existing['type']!==$type) throw new Failure('El pedido ya tiene otro tipo de documento.');
                return $existing;
            }
            $order=wc_get_order($orderId);
            if (!$order || $order instanceof \WC_Order_Refund) throw new Failure('Pedido no encontrado.');
            $type=$type ?: (int)($order->get_meta('_wdt_type',true) ?: 39);
            $s=Orders::snapshot($order,$type,$c);
            return $this->store->transaction(fn()=> $this->create($key,$orderId,0,0,$s));
        });
        $this->schedule((int)$d['id']); return $d;
    }
    public function adjustment(int $parent,int $type,int $amount,string $reason,string $operation,bool $cancel=false,array $lines=[],int $refund=0,string $kind='return',bool $noVatReduction=false): array {
        if (!in_array($type,[56,61],true) || !preg_match('/^[A-Za-z0-9:_-]{8,100}$/D',$operation)) throw new Failure('Tipo de ajuste o clave de operación inválidos.');
        $reason=Rules::text($reason,90); $original=$this->store->get($parent);
        if (!in_array($kind,['return','amount_correction'],true)) throw new Failure('Motivo tributario inválido.');
        if ($type===61 && (int)$original['type']===39 && !$cancel && $kind==='amount_correction') throw new Failure('La corrección de precio de boleta exige anular y emitir una boleta nueva; no se permite NC parcial por corrección de precio.');
        if ($noVatReduction && $type!==61) throw new Failure('IndNoRebaja corresponde solo a notas de crédito.');
        if ($refund) {
            $r=wc_get_order($refund);
            if (!$r instanceof \WC_Order_Refund || (int)$r->get_parent_id()!==(int)$original['order_id'] || Rules::pesos((string)$r->get_amount())!==$amount) throw new Failure('El ajuste no coincide con el reembolso indicado.');
            $operation='refund:'.$refund;
        }
        return $this->store->lock('order:'.$original['order_id'],function() use($parent,$type,$amount,$reason,$operation,$cancel,$lines,$refund,$kind,$noVatReduction) {
            return $this->store->transaction(function() use($parent,$type,$amount,$reason,$operation,$cancel,$lines,$refund,$kind,$noVatReduction) {
                $original=$this->store->get($parent); $s=$this->store->snapshot($original); $c=$s['issuer'];
                Config::gate($c); $current=Config::get();
                if ($c['environment']!==$current['environment'] || $c['rut']!==$current['rut']) throw new Failure('Cambie al ambiente y emisor del documento original antes de ajustarlo.');
                $key=self::key($c,'adjust:'.$original['order_id'].':'.$operation);
                $existing=$this->store->operation($key);
                if ($existing) {
                    $p=$this->store->snapshot($existing);
                    if ((int)$existing['parent_id']!==$parent || (int)$existing['type']!==$type || (int)$existing['amount']!==$amount || $p['reference']['reason']!==$reason || $p['reference']['code']!==($cancel?1:3) || ($p['no_vat_reduction']??false)!==$noVatReduction || ($p['reason_kind']??'return')!==$kind || ($lines && $p['lines']!==$lines)) throw new Failure('Conflicto de idempotencia en ajuste.');
                    return $existing;
                }
                if (!in_array($original['state'],['accepted','accepted_with_repair'],true)) throw new Retryable('El DTE original debe estar aceptado antes de emitir ajustes.');
                if ($type===61 && !in_array((int)$original['type'],[33,39,56],true)) throw new Failure('La NC requiere factura, boleta o ND como referencia.');
                if ($type===56 && !in_array((int)$original['type'],[33,61],true)) throw new Failure('ND: ajuste de factura o anulación completa de NC. Para aumentar una boleta emita otra por la diferencia.');
                $credited=(int)$this->store->db->get_var($this->store->db->prepare("SELECT COALESCE(SUM(amount),0) FROM {$this->store->docs} WHERE parent_id=%d AND type=61",$parent));
                if ($type===61) Rules::credit((int)$original['amount'],$credited,$amount,$cancel);
                if ($type===56 && (int)$original['type']===61) {
                    if (!$cancel || $amount!==(int)$original['amount']) throw new Failure('La ND que anula una NC debe cubrirla completamente.');
                    $n=(int)$this->store->db->get_var($this->store->db->prepare("SELECT COUNT(*) FROM {$this->store->docs} WHERE parent_id=%d AND type=56",$parent));
                    if ($n) throw new Failure('Esta NC ya tiene una ND asociada.');
                } elseif ($type===56 && ($cancel || $amount<1)) throw new Failure('La ND de factura debe corregir montos positivos (código 3).');
                if ($cancel) $lines=$s['lines'];
                elseif (!$lines) {
                    if ($s['totals']['exempt'] && $s['totals']['net']) throw new Failure('Ajuste mixto: indique líneas afectas/exentas, no solo un monto.');
                    $lines=[['name'=>$reason,'amount'=>$amount,'exempt'=>$s['totals']['net']===0]];
                }
                $totals=Rules::totals($lines);
                if ($totals['total']!==$amount) throw new Failure('Las líneas del ajuste no coinciden con su monto.');
                $s['reference']=['type'=>(int)$original['type'],'folio'=>(int)$original['folio'],'date'=>$s['date'],'code'=>$cancel?1:3,'reason'=>$reason];
                $s['no_vat_reduction']=$noVatReduction; $s['reason_kind']=$kind;
                $s['type']=$type; $s['date']=substr(Rules::now(),0,10); $s['lines']=$lines; $s['totals']=$totals;
                $d=$this->create($key,(int)$original['order_id'],$refund,$parent,$s);
                // The watchdog guarantees dispatch even if the process dies before scheduling.
                return $d;
            });
        });
    }
    public function refund(int $orderId,int $refundId): void {
        $c=Config::get(); $refund=wc_get_order($refundId);
        if (!$refund instanceof \WC_Order_Refund || (int)$refund->get_parent_id()!==$orderId) throw new Failure('Reembolso no corresponde al pedido.');
        $key=self::key($c,'refund:'.$refundId);
        $this->store->lock('refund:'.$refundId,function() use($key,$orderId,$refundId,$c) {
            if ($this->store->db->get_var($this->store->db->prepare("SELECT id FROM {$this->store->jobs} WHERE op_key=%s",$key))) return;
            $this->store->insert($this->store->jobs,['op_key'=>$key,'order_id'=>$orderId,'refund_id'=>$refundId,'payload'=>Vault::encrypt(wp_json_encode(['environment'=>$c['environment'],'rut'=>$c['rut']])),'next_run'=>gmdate('Y-m-d H:i:s')]);
            $this->store->event(0,$orderId,'refund_queued',['refund_id'=>$refundId]);
        });
    }
    public function refundJob(array $job): void {
        $this->store->lock('refund-job:'.$job['id'],function() use($job) {
            $current=$this->store->db->get_row($this->store->db->prepare("SELECT * FROM {$this->store->jobs} WHERE id=%d",$job['id']),ARRAY_A);
            if ($current['state']!=='pending') return;
            try {
                if (empty(Config::get()['auto_refunds'])) throw new Failure('NC automática desactivada: revise la naturaleza tributaria del reembolso y active la política de devoluciones o emita el ajuste con refund_id.');
                $c=json_decode(Vault::decrypt($current['payload']),true,512,JSON_THROW_ON_ERROR);
                $base=$this->store->operation(self::key($c,'order:'.$job['order_id']));
                if (!$base) throw new Retryable('Reembolso espera documento original; no se emite una venta nueva automáticamente.');
                $refund=wc_get_order($job['refund_id']);
                if (!$refund instanceof \WC_Order_Refund || (int)$refund->get_parent_id()!==(int)$job['order_id']) throw new Failure('Reembolso eliminado o inválido; revisión manual.');
                $amount=Rules::pesos((string)$refund->get_amount());
                $lines=Orders::lines($refund,true);
                $full=$amount===(int)$base['amount'];
                $doc=$this->adjustment((int)$base['id'],61,$amount,'Devolución WooCommerce #'.$job['refund_id'],'refund:'.$job['refund_id'],$full,$lines,(int)$job['refund_id']);
                $this->store->update($this->store->jobs,['state'=>'done'],(int)$job['id']); $this->schedule((int)$doc['id']);
            } catch (\Throwable $e) {
                $attempt=(int)$current['attempts']+1;
                $retry=$e instanceof Retryable && $attempt<16;
                $this->store->update($this->store->jobs,['state'=>$retry?'pending':'review','attempts'=>$attempt,'next_run'=>gmdate('Y-m-d H:i:s',time()+Rules::backoff($attempt))],(int)$job['id']);
                $this->store->event(0,(int)$job['order_id'],'refund_waiting',['refund'=>$job['refund_id'],'message'=>$e instanceof Failure?$e->getMessage():'Error interno.']);
            }
        });
    }
    public function process(int $id): void {
        try { $this->store->lock('document:'.$id,fn()=> $this->run($id)); }
        catch (Retryable $e) { $this->schedule($id,120); }
    }
    private function run(int $id): void {
        $d=$this->store->get($id);
        if (!in_array($d['state'],['queued','retry','signed','sending','submitted','uncertain','received_unconfirmed'],true)) return;
        if (strtotime($d['next_run'].' UTC')>time()) return;
        $attempt=(int)$d['attempts']+1;
        $this->store->update($this->store->docs,['attempts'=>$attempt],$id);
        try {
            $s=$this->store->snapshot($d); $c=$s['issuer'];
            Config::gate($c); $current=Config::get();
            if ($current['environment']!==$c['environment'] || $current['rut']!==$c['rut']) throw new Failure('Cola pausada: el ambiente/emisor activo cambió.');
            // Revoking the production confirmation immediately stops already queued sends too.
            Config::gate($current);
            $cert=Certificate::stored();
            if (!$d['xml']) {
                if (!$d['parent_id']) {
                    $order=wc_get_order($d['order_id']);
                    if (!$order || !$order->get_date_paid() || in_array($order->get_status(),['cancelled','failed','pending','on-hold'],true)) throw new Failure('Pedido sin pago confirmado o cancelado antes de emitir.');
                }
                $d=$this->store->reserve($d);
                $s=$this->store->snapshot($d);
                $caf=new Caf($this->store->caf((int)$d['caf_id']),$d['issuer']);
                $built=Builder::build($s,(int)$d['folio'],$caf,$cert);
                $this->store->state($id,'signed','XML_VALIDATED',['xml'=>Vault::encrypt($built['xml']),'xml_hash'=>hash('sha256',$built['xml']),'ted'=>Vault::encrypt($built['ted'])]);
                $d=$this->store->get($id);
            }
            $sii=new Sii($c,$cert); $token=$sii->token((int)$d['type']===39);
            if (in_array($d['state'],['sending','submitted','uncertain','received_unconfirmed'],true)) {
                $r=$sii->status($d,$s,$token);
                $this->store->event($id,(int)$d['order_id'],'sii_status',['response'=>$r['raw']]);
                $state=$r['state'];
                if (!in_array($state,['accepted','accepted_with_repair','rejected'],true) && $attempt>=16) $state='review';
                $this->store->state($id,$state,$r['code'],['next_run'=>gmdate('Y-m-d H:i:s',time()+Rules::backoff($attempt))]);
                if (in_array($state,['accepted','accepted_with_repair'],true)) Delivery::email($this->store,$id);
                else $this->schedule($id,Rules::backoff($attempt));
                return;
            }
            $xml=Vault::decrypt($d['xml']);
            if (!hash_equals($d['xml_hash'],hash('sha256',$xml))) throw new Failure('El XML almacenado no coincide con su huella.');
            $this->store->state($id,'sending','UPLOAD_STARTED',['next_run'=>gmdate('Y-m-d H:i:s',time()+180)]);
            $d=$this->store->get($id);
            $r=$sii->send($d,$xml,$token);
            $pollDelay=(int)$d['type']===39?600:60;
            $this->store->state($id,'submitted','REC',['track_id'=>$r['track'],'attempts'=>0,'next_run'=>gmdate('Y-m-d H:i:s',time()+$pollDelay)]);
            $this->store->event($id,(int)$d['order_id'],'sii_upload',['response'=>$r['raw']]);
            $this->schedule($id,$pollDelay);
        } catch (\Throwable $e) {
            $d=$this->store->get($id);
            if (in_array($d['state'],['accepted','accepted_with_repair'],true)) {
                $this->store->event($id,(int)$d['order_id'],'post_acceptance_error',['message'=>$e instanceof Failure?$e->getMessage():'Error de entrega.']);
                return; // Delivery failure must never downgrade fiscal acceptance.
            }
            // After upload started the outcome may be unknown. Never auto-resend.
            $ambiguous=in_array($d['state'],['sending','submitted','uncertain','received_unconfirmed'],true);
            $state=$ambiguous ? ($attempt>=16?'review':($d['track_id']?'submitted':'uncertain')) : ($e instanceof Retryable && $attempt<16?'retry':'blocked');
            $this->store->event($id,(int)$d['order_id'],'error',['message'=>$e instanceof Failure?$e->getMessage():'Error interno: '.get_class($e)]);
            $this->store->state($id,$state,'ACTION_REQUIRED',['next_run'=>gmdate('Y-m-d H:i:s',time()+Rules::backoff($attempt))]);
            if (!in_array($state,['blocked','review'],true)) $this->schedule($id,Rules::backoff($attempt));
        }
    }
    public function tick(): void {
        $now=gmdate('Y-m-d H:i:s');
        $ids=$this->store->db->get_col($this->store->db->prepare("SELECT id FROM {$this->store->docs} WHERE state IN ('queued','retry','signed','sending','submitted','uncertain','received_unconfirmed') AND next_run<=%s ORDER BY next_run LIMIT 10",$now));
        foreach ($ids as $id) $this->schedule((int)$id);
        $jobs=$this->store->db->get_results($this->store->db->prepare("SELECT * FROM {$this->store->jobs} WHERE state='pending' AND next_run<=%s ORDER BY next_run LIMIT 5",$now),ARRAY_A);
        foreach ($jobs as $job) { try { $this->refundJob($job); } catch (\Throwable $e) { /* Durable job stays pending. */ } }
        $ids=$this->store->db->get_col("SELECT id FROM {$this->store->docs} WHERE state IN ('accepted','accepted_with_repair') AND email_state='pending' LIMIT 5");
        foreach ($ids as $id) { try { Delivery::email($this->store,(int)$id); } catch (\Throwable $e) { /* Delivery records its own failure. */ } }
    }
    public function retry(int $id,string $track=''): void {
        $this->store->lock('document:'.$id,function() use($id,$track) {
            $d=$this->store->get($id);
            if (in_array($d['state'],['accepted','accepted_with_repair'],true)) throw new Failure('El documento ya fue aceptado.');
            if ($track!=='' && $track!==$d['track_id']) throw new Failure('No se puede asociar un Track ID sin comprobar que pertenece al XML original. La conciliación de un envío sin Track ID requiere revisión oficial.');
            if ($d['state']==='rejected') throw new Failure('Documento rechazado: no se regenera ni cambia su XML. Requiere diagnóstico tributario.');
            $state=$d['xml'] ? (($track || $d['track_id'])?'submitted':(in_array($d['state'],['review','uncertain','received_unconfirmed','sending'],true)?'uncertain':'signed')) : 'queued';
            $this->store->state($id,$state,'MANUAL_RETRY',['track_id'=>$track?:$d['track_id'],'attempts'=>0,'next_run'=>gmdate('Y-m-d H:i:s')]);
        }); $this->schedule($id);
    }
}
