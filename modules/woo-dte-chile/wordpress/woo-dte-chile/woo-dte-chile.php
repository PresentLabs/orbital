<?php
/**
 * Plugin Name: Woo DTE Chile
 * Description: Emisión independiente DTE 33, 39, 56 y 61. Requiere certificación oficial antes de producción.
 * Version: 0.2.1
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 * WC requires at least: 9.0
 * Author: Woo DTE Chile
 * License: GPL-3.0-or-later
 * Text Domain: woo-dte-chile
 */
defined('ABSPATH') || exit;
define('WDT_DIR',__DIR__);
foreach (['Domain','Crypto','Builder','Store','Sii','Orders','Barcode','Delivery','Service','Rest','Admin','Checkout'] as $wdt_class) require_once WDT_DIR.'/includes/'.$wdt_class.'.php';

register_activation_hook(__FILE__,function($network) {
    if ($network) wp_die('Active Woo DTE Chile por sitio, no en toda la red.');
    foreach (['dom','openssl','mbstring','sodium','mysqli'] as $ext) if (!extension_loaded($ext)) wp_die('Extensión PHP requerida: '.esc_html($ext));
    if (!class_exists('WooCommerce')) wp_die('Active WooCommerce primero.');
    try { (new \WooDTEChile\Store())->install(); } catch (\Throwable $e) { wp_die(esc_html($e->getMessage())); }
});
add_action('before_woocommerce_init',function() {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables',__FILE__,true);
});
add_filter('cron_schedules',function($s) { $s['wdt_minute']=['interval'=>60,'display'=>'Woo DTE cada minuto']; return $s; });
add_action('plugins_loaded',function() {
    if (!class_exists('WooCommerce')) return;
    foreach (['dom','openssl','mbstring','sodium','mysqli'] as $ext) if (!extension_loaded($ext)) {
        add_action('admin_notices',fn()=>print('<div class="notice notice-error"><p>Woo DTE Chile: faltan extensiones PHP requeridas; revise la instalación.</p></div>')); return;
    }
    $store=new \WooDTEChile\Store();
    if (get_option('wdt_version')!=='0.2.1') { try { $store->install(); } catch (\Throwable $e) { return; } }
    $service=new \WooDTEChile\Service($store); $GLOBALS['wdt_service']=$service;
    (new \WooDTEChile\Admin($service))->hooks(); \WooDTEChile\Checkout::hooks();
    add_action('rest_api_init',[(new \WooDTEChile\Rest($service)),'routes']);
    add_action('wdt_process',[$service,'process']); add_action('wdt_watchdog',[$service,'tick']);
    if (!wp_next_scheduled('wdt_watchdog')) wp_schedule_event(time()+60,'wdt_minute','wdt_watchdog');
    add_action('woocommerce_payment_complete',function($order) use($service) {
        if (empty(\WooDTEChile\Config::get()['auto'])) return;
        try { $service->issue((int)$order); }
        catch (\Throwable $e) {
            $o=wc_get_order($order); if ($o) { $o->update_meta_data('_wdt_attention','payment_issue_failed'); $o->save(); $o->add_order_note('Woo DTE Chile: emisión pendiente de revisión. '.($e instanceof \WooDTEChile\Failure?$e->getMessage():'Error interno.')); }
            try { $service->store->event(0,(int)$order,'payment_issue_failed',['message'=>$e instanceof \WooDTEChile\Failure?$e->getMessage():'Error interno.']); } catch (\Throwable $ignored) {}
        }
    });
    add_action('woocommerce_order_refunded',function($order,$refund) use($service) {
        try { $service->refund((int)$order,(int)$refund); }
        catch (\Throwable $e) { $o=wc_get_order($order); if ($o) { $o->update_meta_data('_wdt_attention','refund_issue_failed'); $o->save(); $o->add_order_note('Woo DTE Chile: no se pudo registrar la NC del reembolso #'.(int)$refund.'. Revise el documento tributario.'); } }
    },10,2);
});
register_deactivation_hook(__FILE__,function() {
    wp_clear_scheduled_hook('wdt_watchdog');
    if (function_exists('as_unschedule_all_actions')) as_unschedule_all_actions('wdt_process',null,'woo-dte-chile');
});
// No uninstall deletion: fiscal documents, CAF reservations and audit history are retained.
