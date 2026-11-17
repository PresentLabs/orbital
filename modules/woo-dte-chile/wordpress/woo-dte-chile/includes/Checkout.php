<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Checkout {
    public static function hooks(): void {
        add_filter('woocommerce_checkout_fields',function($fields) {
            $fields['billing']['billing_wdt_type']=['type'=>'select','label'=>'Documento tributario','options'=>['39'=>'Boleta electrónica','33'=>'Factura electrónica'],'required'=>true,'priority'=>120];
            $fields['billing']['billing_wdt_rut']=['type'=>'text','label'=>'RUT (obligatorio para factura)','required'=>false,'priority'=>121];
            $fields['billing']['billing_wdt_giro']=['type'=>'text','label'=>'Giro (obligatorio para factura)','required'=>false,'priority'=>122];
            return $fields;
        });
        add_action('woocommerce_after_checkout_validation',function($data,$errors) {
            try { self::data((int)($data['billing_wdt_type']??39),$data['billing_wdt_rut']??'',$data['billing_wdt_giro']??'',$data['billing_company']??'',$data['billing_address_1']??'',$data['billing_city']??''); }
            catch (Failure $e) { $errors->add('wdt_fiscal',$e->getMessage()); }
        },10,2);
        add_action('woocommerce_checkout_create_order',function($order,$data) {
            $type=(int)($data['billing_wdt_type']??39);
            $receiver=self::data($type,$data['billing_wdt_rut']??'',$data['billing_wdt_giro']??'',$data['billing_company']??'',$data['billing_address_1']??'',$data['billing_city']??'');
            $order->update_meta_data('_wdt_type',$type); if ($receiver) $order->update_meta_data('_wdt_receiver',$receiver);
        },10,2);
        add_action('woocommerce_init',function() {
            if (!function_exists('woocommerce_register_additional_checkout_field')) return;
            woocommerce_register_additional_checkout_field(['id'=>'woo-dte-chile/type','label'=>'Documento tributario','location'=>'order','type'=>'select','required'=>true,'options'=>[['value'=>'39','label'=>'Boleta electrónica'],['value'=>'33','label'=>'Factura electrónica']]]);
            foreach (['rut'=>'RUT para factura','giro'=>'Giro para factura'] as $key=>$label) woocommerce_register_additional_checkout_field(['id'=>'woo-dte-chile/'.$key,'label'=>$label,'location'=>'order','type'=>'text','required'=>false,'sanitize_callback'=>'sanitize_text_field']);
        });
        add_action('woocommerce_store_api_checkout_order_processed',function($order) {
            $type=(int)($order->get_meta('_wc_other/woo-dte-chile/type',true)?:39);
            try { $r=self::data($type,(string)$order->get_meta('_wc_other/woo-dte-chile/rut',true),(string)$order->get_meta('_wc_other/woo-dte-chile/giro',true),$order->get_billing_company(),$order->get_billing_address_1(),$order->get_billing_city()); }
            catch (Failure $e) { throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException('wdt_fiscal',$e->getMessage(),400); }
            $order->update_meta_data('_wdt_type',$type); if ($r) $order->update_meta_data('_wdt_receiver',$r); $order->save();
        });
    }
    private static function data(int $type,string $rut,string $giro,string $name,string $address,string $commune): array {
        if (!in_array($type,[33,39],true)) throw new Failure('Seleccione boleta o factura.');
        if ($type===39) return [];
        return ['rut'=>Rules::rut($rut),'name'=>Rules::text($name,100),'giro'=>Rules::text($giro,40),'address'=>Rules::text($address,70),'commune'=>Rules::text($commune,20)];
    }
}
