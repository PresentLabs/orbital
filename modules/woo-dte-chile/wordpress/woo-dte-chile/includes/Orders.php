<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Orders {
    public static function receiver($order,int $type): array {
        $r=$order->get_meta('_wdt_receiver',true);
        if (!is_array($r)) $r=[];
        if ($type===39) $r+=['rut'=>'66666666-6','name'=>trim($order->get_billing_first_name().' '.$order->get_billing_last_name()) ?: 'Consumidor final','address'=>$order->get_billing_address_1(),'commune'=>$order->get_billing_city(),'giro'=>''];
        $r['rut']=Rules::rut($r['rut']??''); $r['name']=Rules::text($r['name']??'',100);
        foreach (['giro'=>40,'address'=>70,'commune'=>20] as $key=>$max) {
            if ($type===33 || !empty($r[$key])) $r[$key]=Rules::text($r[$key]??'',$max);
            else $r[$key]='';
        }
        return $r;
    }
    public static function lines($order,bool $refund=false): array {
        $raw=[];
        foreach ($order->get_items(['line_item','fee','shipping']) as $item) {
            $net=(float)$item->get_total(); $tax=(float)$item->get_total_tax();
            if ($refund) { $net=-$net; $tax=-$tax; }
            if ($net<0 || $tax<0) throw new Failure('Líneas negativas o devoluciones con signos inconsistentes requieren revisión.');
            if ($net+$tax<0.001) continue;
            $exempt=abs($tax)<0.001;
            if (!$exempt && abs($tax-$net*.19)>1.01) throw new Failure('Solo se admite IVA 19% o líneas exentas, sin impuestos adicionales.');
            $raw[]=['name'=>Rules::text($item->get_name(),80),'description'=>'Línea WooCommerce #'.$item->get_id().'; cantidad '.abs((float)($item->get_quantity()?:1)),'value'=>$net+$tax,'quantity'=>abs((float)($item->get_quantity()?:1)),'exempt'=>$exempt];
        }
        if (!$raw) return [];
        // Largest-remainder distribution preserves the order total without arbitrary extra lines.
        $target=Rules::pesos($refund ? (string)$order->get_amount() : (string)$order->get_total());
        $sum=array_sum(array_column($raw,'value'));
        if (abs($sum-$target)>1.01) throw new Failure('El detalle no coincide con el total del pedido/reembolso.');
        $lines=[]; $allocated=0;
        foreach ($raw as $i=>$l) { $amount=(int)floor($l['value']); $allocated+=$amount; $lines[$i]=['name'=>$l['name'],'description'=>$l['description'],'quantity'=>$l['quantity'],'amount'=>$amount,'exempt'=>$l['exempt']]; }
        $indices=array_keys($raw); usort($indices,fn($a,$b)=>($raw[$b]['value']-floor($raw[$b]['value']))<=>($raw[$a]['value']-floor($raw[$a]['value'])));
        $left=$target-$allocated;
        if ($left<0 || $left>count($lines)) throw new Failure('Redondeo del pedido no conciliable.');
        for ($i=0;$i<$left;$i++) $lines[$indices[$i]]['amount']++;
        return array_values(array_filter($lines,fn($l)=>$l['amount']>0));
    }
    public static function snapshot($order,int $type,array $c): array {
        if (!in_array($type,[33,39],true)) throw new Failure('Tipo base inválido.');
        if (!$order || !$order->get_date_paid() || (!$order->is_paid() && !$order->has_status('refunded'))) throw new Failure('La emisión requiere pago confirmado registrado por WooCommerce.');
        if ($order->get_currency()!=='CLP' || $order->get_billing_country()!=='CL') throw new Failure('Solo pedidos en CLP y Chile.');
        $lines=self::lines($order); $t=Rules::totals($lines);
        if ($t['net']<1) throw new Failure('El pedido completamente exento requiere otro tipo de DTE, fuera de este alcance.');
        return ['type'=>$type,'date'=>substr(Rules::now(),0,10),'issuer'=>$c,'receiver'=>self::receiver($order,$type),'lines'=>$lines,'totals'=>$t,'email'=>$order->get_billing_email()];
    }
}
