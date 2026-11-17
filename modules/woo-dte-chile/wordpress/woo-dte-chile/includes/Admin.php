<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Admin {
    public function __construct(private Service $service) {}
    public function hooks(): void {
        add_action('admin_menu',fn()=>add_submenu_page('woocommerce','Woo DTE Chile','Woo DTE Chile','manage_woocommerce','woo-dte-chile',[$this,'page']));
        add_action('admin_post_wdt_action',[$this,'action']);
        add_action('woocommerce_admin_order_data_after_billing_address',[$this,'order']);
        add_filter('woocommerce_order_actions',function($a){ if (Rest::manager()) $a['wdt_issue']='Emitir DTE Chile (pago confirmado)'; return $a; });
        add_action('woocommerce_order_action_wdt_issue',function($order) {
            if (!Rest::manager()) return;
            try { $this->service->issue((int)$order->get_id()); } catch (\Throwable $e) { $order->add_order_note('Woo DTE Chile: '.($e instanceof Failure?$e->getMessage():'Error interno.')); }
        });
    }
    private static function input(string $name,string $value='',string $type='text'): void { echo '<input class="regular-text" type="'.esc_attr($type).'" name="'.esc_attr($name).'" value="'.esc_attr($value).'" autocomplete="off">'; }
    private static function form(string $op): void {
        echo '<form method="post" enctype="multipart/form-data" action="'.esc_url(admin_url('admin-post.php')).'">';
        wp_nonce_field('wdt_action'); echo '<input type="hidden" name="action" value="wdt_action"><input type="hidden" name="op" value="'.esc_attr($op).'">';
    }
    private static function end(string $label): void { submit_button($label); echo '</form>'; }
    public function order($order): void {
        if (!Rest::manager()) return;
        echo '<p><strong>Woo DTE Chile</strong><br>';
        foreach ($this->service->store->list((int)$order->get_id()) as $d) echo '<a href="'.esc_url(admin_url('admin.php?page=woo-dte-chile&document='.(int)$d['id'])).'">DTE '.esc_html($d['type'].' / '.($d['folio']?:'sin folio').' — '.$d['state'].' — '.$d['environment']).'</a><br>';
        echo '</p>';
    }
    public function page(): void {
        if (!Rest::manager()) wp_die('Sin autorización.');
        $c=Config::get(); echo '<div class="wrap"><h1>Woo DTE Chile 0.2.0</h1><div class="notice notice-warning inline"><p>Implementación para certificación. No se han realizado pruebas oficiales SII con credenciales reales. Producción requiere autorización expresa en servidor y evidencia de certificación.</p></div>';
        if (isset($_GET['saved'])) echo '<div class="notice notice-success inline"><p>Operación registrada.</p></div>';
        $doc=absint($_GET['document']??0);
        if ($doc) { $this->detail($doc); echo '</div>'; return; }
        echo '<h2>Emisor y ambiente</h2>';
        if (current_user_can('manage_options')) {
            self::form('settings');
            echo '<p><label>Ambiente <select name="environment"><option value="certification" '.selected($c['environment'],'certification',false).'>Certificación</option><option value="production" '.selected($c['environment'],'production',false).'>Producción</option></select></label></p>';
            foreach (['rut'=>'RUT emisor','sender'=>'RUT firmante autorizado','name'=>'Razón social','giro'=>'Giro','activity'=>'Código actividad','address'=>'Dirección','commune'=>'Comuna','sii_office'=>'Unidad SII del emisor','resolution_date'=>'Fecha resolución (AAAA-MM-DD)','resolution_number'=>'Número resolución','production_confirmation'=>'Confirmación: ACTIVAR PRODUCCION RUT','evidence'=>'Evidencia de certificación (referencia de expediente)'] as $k=>$label) { echo '<p><label>'.esc_html($label).'<br>'; self::input($k,(string)$c[$k]); echo '</label></p>'; }
            echo '<p><label><input type="checkbox" name="auto" value="1" '.checked($c['auto'],true,false).'> Emitir al recibir woocommerce_payment_complete</label></p>'; echo '<p><label><input type="checkbox" name="auto_refunds" value="1" '.checked($c['auto_refunds'],true,false).'> Tratar reembolsos WooCommerce como devoluciones y generar NC automáticamente. Las correcciones de precio se gestionan por separado.</label></p>'; self::end('Guardar configuración');
            echo '<h2>Certificado digital</h2><p>Se cifra en base de datos; la contraseña no se guarda. Requiere WDT_SECRET_KEY en el servidor.</p>';
            self::form('certificate'); echo '<p>Archivo P12/PFX '; self::input('certificate','','file'); echo '</p><p>Contraseña '; self::input('password','','password'); echo '</p>'; self::end('Guardar certificado');
            echo '<h2>CAF del ambiente activo</h2><p>Solicite los folios en el SII e importe el archivo original. La firma exige una llave pública SII confiable configurada por ambiente/IDK. No se aceptan rangos superpuestos.</p>';
            self::form('caf'); self::input('caf','','file'); self::end('Importar CAF');
        }
        $rows=$this->service->store->db->get_results("SELECT id,environment,type,first_folio,last_folio,next_folio,expires FROM {$this->service->store->cafs} ORDER BY id DESC LIMIT 30",ARRAY_A);
        echo '<h2>Folios</h2>'; $this->table($rows);
        echo '<h2>Emisión manual</h2>'; self::form('issue'); echo '<p>ID pedido '; self::input('order_id','','number'); echo '</p><p>Tipo <select name="type"><option value="39">39 Boleta</option><option value="33">33 Factura</option></select></p>'; self::end('Crear operación de emisión');
        echo '<h2>Datos fiscales del pedido (antes de emitir)</h2>'; self::form('fiscal');
        foreach (['order_id'=>'ID pedido','type'=>'Tipo 33 o 39','rut'=>'RUT receptor','name'=>'Razón social o nombre','giro'=>'Giro receptor','address'=>'Dirección','commune'=>'Comuna'] as $k=>$label) { echo '<p>'.esc_html($label).' '; self::input($k); echo '</p>'; } self::end('Guardar datos fiscales');
        echo '<h2>Últimos documentos</h2>';
        $rows=$this->service->store->db->get_results("SELECT id,order_id,parent_id,refund_id,environment,type,folio,amount,state,email_state FROM {$this->service->store->docs} ORDER BY id DESC LIMIT 100",ARRAY_A); $this->table($rows,true);
        echo '<h2>Reembolsos pendientes de revisión</h2>';
        $jobs=$this->service->store->db->get_results("SELECT id,order_id,refund_id,state,attempts,next_run FROM {$this->service->store->jobs} WHERE state<>'done' ORDER BY id DESC LIMIT 50",ARRAY_A); $this->table($jobs);
        self::form('refund_retry'); echo 'ID de tarea de reembolso '; self::input('job_id','','number'); self::end('Revisar nuevamente el reembolso');
        echo '<h2>Registro reciente</h2>'; $this->events(0); echo '</div>';
    }
    private function table(array $rows,bool $links=false): void {
        if (!$rows) { echo '<p>Sin registros.</p>'; return; }
        echo '<table class="widefat striped"><thead><tr>'; foreach (array_keys($rows[0]) as $k) echo '<th>'.esc_html($k).'</th>'; echo '</tr></thead><tbody>';
        foreach ($rows as $row) { echo '<tr>'; foreach ($row as $k=>$v) echo '<td>'.($links && $k==='id'?'<a href="'.esc_url(admin_url('admin.php?page=woo-dte-chile&document='.(int)$v)).'">'.esc_html($v).'</a>':esc_html((string)$v)).'</td>'; echo '</tr>'; } echo '</tbody></table>';
    }
    private function events(int $doc): void {
        $sql=$doc?$this->service->store->db->prepare("SELECT * FROM {$this->service->store->events} WHERE document_id=%d ORDER BY id DESC LIMIT 50",$doc):"SELECT * FROM {$this->service->store->events} ORDER BY id DESC LIMIT 50";
        foreach ($this->service->store->db->get_results($sql,ARRAY_A) as $event) {
            echo '<details><summary>'.esc_html($event['created_at'].' | '.$event['code'].' | doc '.$event['document_id'].' | pedido '.$event['order_id'].' | usuario '.$event['actor']).'</summary><pre style="white-space:pre-wrap">';
            try { echo esc_html(Vault::decrypt($event['detail'])); } catch (\Throwable $e) { echo 'Registro cifrado no disponible.'; } echo '</pre></details>';
        }
    }
    private function detail(int $id): void {
        try { $d=$this->service->store->get($id); } catch (Failure $e) { echo '<p>Documento no encontrado.</p>'; return; }
        echo '<h2>Documento #'.(int)$id.'</h2>'; $this->table([Rest::publicDoc($d)]);
        echo '<p>El original y sus folios reservados se conservan siempre. Las NC pendientes o rechazadas mantienen su reserva de saldo hasta una revisión contable.</p>';
        foreach (['xml','pdf'] as $format) {
            $url=wp_nonce_url(admin_url('admin-post.php?action=wdt_action&op=download&id='.$id.'&format='.$format),'wdt_action');
            echo '<a class="button" href="'.esc_url($url).'">Descargar '.esc_html(strtoupper($format)).'</a> ';
        }
        echo '<h3>Ajustar documento</h3>'; self::form('adjust'); self::input('id',(string)$id,'hidden'); self::input('operation',wp_generate_uuid4(),'hidden');
        echo '<p>Tipo <select name="type"><option value="61">61 Nota de crédito</option><option value="56">56 Nota de débito</option></select></p><p>Monto CLP '; self::input('amount','','number'); echo '</p><p>Motivo '; self::input('reason'); echo '</p><p><label><input type="checkbox" name="cancel" value="1"> Anular con NC (total original); o ND que anula NC completa</label></p><p>Líneas JSON para devolución mixta, si corresponde: <textarea name="lines" rows="3" cols="80" placeholder="[]"></textarea></p>'; echo '<p>Clase de ajuste <select name="kind"><option value="return">Devolución</option><option value="amount_correction">Corrección de monto</option></select></p><p><label><input type="checkbox" name="no_vat_reduction" value="1"> NC sin derecho a rebaja del débito (IndNoRebaja)</label></p><p>ID reembolso WooCommerce, si corresponde '; self::input('refund_id','','number'); echo '</p>'; self::end('Crear ajuste relacionado');
        echo '<h3>Reintento o conciliación</h3>'; self::form('retry'); self::input('id',(string)$id,'hidden'); echo '<p>Un envío incierto solo se consulta; no se reenvía automáticamente. No se permite asignar manualmente un Track ID que no esté vinculado al XML enviado.</p>'; self::end('Reintentar / consultar');
        self::form('email'); self::input('id',(string)$id,'hidden'); self::end('Enviar nuevamente correo del documento aceptado');
        echo '<h3>Trazabilidad</h3>'; $this->events($id);
    }
    private function upload(string $field): string {
        $f=$_FILES[$field]??null;
        if (!$f || (int)$f['error']!==UPLOAD_ERR_OK || (int)$f['size']>2000000 || !is_uploaded_file($f['tmp_name'])) throw new Failure('Archivo inválido o mayor que 2 MB.');
        $bytes=file_get_contents($f['tmp_name']); if ($bytes===false) throw new Failure('No se pudo leer archivo.'); return $bytes;
    }
    public function action(): void {
        if (!Rest::manager()) wp_die('Sin autorización.',403);
        check_admin_referer('wdt_action');
        $op=sanitize_key($_REQUEST['op']??'');
        if ($op!=='download' && ($_SERVER['REQUEST_METHOD']??'')!=='POST') wp_die('Se requiere POST.',405);
        $p=wp_unslash($_POST);
        try {
            if (in_array($op,['settings','certificate','caf'],true) && !current_user_can('manage_options')) throw new Failure('Solo administradores pueden configurar emisor y secretos.');
            switch ($op) {
                case 'settings':
                    $c=Config::get(); foreach ($c as $k=>$v) $c[$k]=in_array($k,['auto','auto_refunds'],true)?isset($p[$k]):sanitize_text_field((string)($p[$k]??''));
                    $c=Config::validate($c); update_option('wdt_settings',$c,false); $this->service->store->event(0,0,'settings_changed',['environment'=>$c['environment']]); break;
                case 'certificate':
                    $cert=Certificate::fromP12($this->upload('certificate'),(string)($p['password']??''));
                    update_option('wdt_certificate',Vault::encrypt(wp_json_encode(['key'=>$cert->key,'cert'=>$cert->cert])),false); $this->service->store->event(0,0,'certificate_replaced'); break;
                case 'caf': $this->service->store->importCaf($this->upload('caf'),Config::validate(Config::get())); break;
                case 'issue': $this->service->issue(absint($p['order_id']??0),(int)($p['type']??39)); break;
                case 'fiscal': (new Rest($this->service))->fiscal(absint($p['order_id']??0),['type'=>(int)($p['type']??39),'receiver'=>$p]); break;
                case 'adjust':
                    $lines=trim($p['lines']??''); $lines=$lines===''?[]:json_decode($lines,true,32,JSON_THROW_ON_ERROR);
                    $d=$this->service->adjustment(absint($p['id']??0),(int)($p['type']??0),Rules::pesos($p['amount']??''),(string)($p['reason']??''),(string)($p['operation']??''),isset($p['cancel']),$lines,absint($p['refund_id']??0),sanitize_key($p['kind']??'return'),isset($p['no_vat_reduction']));
                    $this->service->schedule((int)$d['id']); break;
                case 'retry': $this->service->retry(absint($p['id']??0),sanitize_text_field($p['track_id']??'')); break;
                case 'refund_retry':
                    $this->service->store->update($this->service->store->jobs,['state'=>'pending','attempts'=>0,'next_run'=>gmdate('Y-m-d H:i:s')],absint($p['job_id']??0)); break;
                case 'email': Delivery::email($this->service->store,absint($p['id']??0),true); break;
                case 'download':
                    $d=$this->service->store->get(absint($_GET['id']??0)); $format=($_GET['format']??'')==='pdf'?'pdf':'xml';
                    $bytes=$format==='pdf'?Delivery::pdf($this->service->store,$d):Delivery::xml($this->service->store,$d);
                    nocache_headers(); header('X-Content-Type-Options: nosniff'); header('Content-Type: '.($format==='pdf'?'application/pdf':'application/xml')); header('Content-Disposition: attachment; filename="DTE-'.(int)$d['id'].'.'.$format.'"'); echo $bytes; exit;
                default: throw new Failure('Acción desconocida.');
            }
            wp_safe_redirect(admin_url('admin.php?page=woo-dte-chile&saved=1')); exit;
        } catch (\Throwable $e) { wp_die(esc_html($e instanceof Failure?$e->getMessage():'No se pudo completar la operación. Revise los datos y registros.'),'Woo DTE Chile',['response'=>422,'back_link'=>true]); }
    }
}
