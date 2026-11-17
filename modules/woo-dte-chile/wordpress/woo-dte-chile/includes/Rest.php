<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Rest {
    public function __construct(private Service $service) {}
    public static function manager(): bool { return current_user_can('manage_woocommerce'); }
    public static function owner(int $order): bool {
        if (self::manager()) return true;
        $o=wc_get_order($order); $uid=get_current_user_id();
        return $uid>0 && $o && (int)$o->get_customer_id()===$uid;
    }
    public static function publicDoc(array $d): array {
        return array_intersect_key($d,array_flip(['id','order_id','refund_id','parent_id','environment','type','folio','amount','state','track_id','last_code','email_state','created_at','updated_at']));
    }
    private function respond(callable $fn) {
        try { return rest_ensure_response($fn()); }
        catch (Failure $e) { return new \WP_Error('wdt_error',$e->getMessage(),['status'=>$e instanceof Retryable?409:422]); }
        catch (\Throwable $e) { return new \WP_Error('wdt_internal','Error interno. Consulte el registro privado.',['status'=>500]); }
    }
    public function routes(): void {
        $manager=[self::class,'manager'];
        register_rest_route('woo-dte-chile/v1','/capabilities',['methods'=>'GET','permission_callback'=>$manager,'callback'=>function() {
            $c=Config::get(); $unlocked=false;
            if ($c['environment']==='production') { try { Config::gate($c); $unlocked=true; } catch (\Throwable $ignored) {} }
            $r=new \WP_REST_Response(['module'=>'woo-dte-chile','version'=>'0.2.1','apiVersion'=>1,'environment'=>$c['environment'],'documents'=>[33,39,56,61],'automaticIssue'=>(bool)$c['auto'],'automaticRefunds'=>(bool)$c['auto_refunds'],'productionUnlocked'=>$unlocked,'siiCertificationVerified'=>false]);
            $r->header('Cache-Control','private, no-store'); return $r;
        }]);
        register_rest_route('woo-dte-chile/v1','/orders/(?P<id>\d+)/documents',['methods'=>'GET','permission_callback'=>fn($r)=>self::owner((int)$r['id']),'callback'=>fn($r)=>$this->respond(fn()=>array_map([self::class,'publicDoc'],$this->service->store->list((int)$r['id'])))]);
        register_rest_route('woo-dte-chile/v1','/orders/(?P<id>\d+)/issue',['methods'=>'POST','permission_callback'=>$manager,'callback'=>fn($r)=>$this->respond(fn()=>self::publicDoc($this->service->issue((int)$r['id'],$r->get_param('type')===null?null:(int)$r['type'])))]);
        register_rest_route('woo-dte-chile/v1','/orders/(?P<id>\d+)/fiscal',['methods'=>'PUT','permission_callback'=>$manager,'callback'=>fn($r)=>$this->respond(fn()=> $this->fiscal((int)$r['id'],$r->get_json_params() ?: []))]);
        register_rest_route('woo-dte-chile/v1','/documents/(?P<id>\d+)/adjust',['methods'=>'POST','permission_callback'=>$manager,'callback'=>fn($r)=>$this->respond(function() use($r) {
            $d=$this->service->adjustment((int)$r['id'],(int)$r['type'],Rules::pesos($r['amount']),(string)$r['reason'],(string)$r->get_header('Idempotency-Key'),(bool)$r->get_param('cancel'),$r->get_param('lines') ?: [],(int)$r->get_param('refund_id'),(string)($r->get_param('kind')?:'return'),(bool)$r->get_param('no_vat_reduction'));
            $this->service->schedule((int)$d['id']); return self::publicDoc($d);
        })]);
        register_rest_route('woo-dte-chile/v1','/documents/(?P<id>\d+)/retry',['methods'=>'POST','permission_callback'=>$manager,'callback'=>fn($r)=>$this->respond(function() use($r) { $this->service->retry((int)$r['id'],(string)$r->get_param('track_id')); return ['scheduled'=>true]; })]);
        register_rest_route('woo-dte-chile/v1','/documents/(?P<id>\d+)/email',['methods'=>'POST','permission_callback'=>$manager,'callback'=>fn($r)=>$this->respond(function() use($r) { Delivery::email($this->service->store,(int)$r['id'],true); return ['requested'=>true]; })]);
        register_rest_route('woo-dte-chile/v1','/documents/(?P<id>\d+)/file',['methods'=>'GET','permission_callback'=>function($r) {
            try { $d=$this->service->store->get((int)$r['id']); return self::owner((int)$d['order_id']) && (self::manager() || ($d['environment']==='production' && in_array($d['state'],['accepted','accepted_with_repair'],true))); } catch (\Throwable $e) { return false; }
        },'callback'=>fn($r)=>$this->respond(function() use($r) {
            $d=$this->service->store->get((int)$r['id']); $format=$r->get_param('format')==='pdf'?'pdf':'xml';
            $bytes=$format==='pdf'?Delivery::pdf($this->service->store,$d):Delivery::xml($this->service->store,$d);
            $response=new \WP_REST_Response(['filename'=>'DTE-'.$d['type'].'-'.$d['folio'].'.'.$format,'mime'=>$format==='pdf'?'application/pdf':'application/xml','base64'=>base64_encode($bytes)]);
            $response->header('Cache-Control','private, no-store'); return $response;
        })]);
    }
    public function fiscal(int $id,array $data): array {
        return $this->service->store->lock('order:'.$id,function() use($id,$data) {
            if ($this->service->store->list($id)) throw new Failure('Los datos tributarios quedan congelados al crear el primer documento.');
            $order=wc_get_order($id);
            if (!$order || $order instanceof \WC_Order_Refund) throw new Failure('Pedido no encontrado.');
            $type=(int)($data['type']??39);
            if (!in_array($type,[33,39],true)) throw new Failure('Tipo inválido.');
            $receiver=$data['receiver']??[]; $clean=[];
            foreach (['rut','name','giro','address','commune'] as $key) $clean[$key]=sanitize_text_field((string)($receiver[$key]??''));
            $order->update_meta_data('_wdt_receiver',$clean); $order->update_meta_data('_wdt_type',$type);
            Orders::receiver($order,$type); $order->save();
            return ['saved'=>true];
        });
    }
}
