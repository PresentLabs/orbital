<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Store {
    public $db;
    public string $docs; public string $cafs; public string $events; public string $jobs;
    public function __construct($db = null) {
        $this->db = $db ?: $GLOBALS['wpdb'];
        foreach (['docs','cafs','events','jobs'] as $name) $this->$name = $this->db->prefix.'wdt_'.$name;
    }
    public function install(): void {
        require_once ABSPATH.'wp-admin/includes/upgrade.php';
        $cc = $this->db->get_charset_collate();
        dbDelta("CREATE TABLE {$this->docs} (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 op_key varchar(64) NOT NULL,
 order_id bigint unsigned NOT NULL,
 refund_id bigint unsigned NOT NULL DEFAULT 0,
 parent_id bigint unsigned NOT NULL DEFAULT 0,
 environment varchar(16) NOT NULL,
 issuer varchar(12) NOT NULL,
 type smallint unsigned NOT NULL,
 folio bigint unsigned DEFAULT NULL,
 caf_id bigint unsigned DEFAULT NULL,
 amount bigint unsigned NOT NULL,
 snapshot longtext NOT NULL,
 state varchar(24) NOT NULL,
 xml longtext DEFAULT NULL,
 xml_hash varchar(64) NOT NULL DEFAULT '',
 ted longtext DEFAULT NULL,
 track_id varchar(32) NOT NULL DEFAULT '',
 attempts int unsigned NOT NULL DEFAULT 0,
 next_run datetime NOT NULL,
 last_code varchar(64) NOT NULL DEFAULT '',
 email_state varchar(16) NOT NULL DEFAULT 'pending',
 created_at datetime NOT NULL,
 updated_at datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY operation (op_key),
 UNIQUE KEY folio (environment,issuer,type,folio),
 KEY order_lookup (order_id),
 KEY parent_lookup (parent_id),
 KEY queue (state,next_run)
) ENGINE=InnoDB $cc;");
        dbDelta("CREATE TABLE {$this->cafs} (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 environment varchar(16) NOT NULL,
 issuer varchar(12) NOT NULL,
 type smallint unsigned NOT NULL,
 first_folio bigint unsigned NOT NULL,
 last_folio bigint unsigned NOT NULL,
 next_folio bigint unsigned NOT NULL,
 expires date NOT NULL,
 fingerprint varchar(64) NOT NULL,
 secret longtext NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY fingerprint (environment,fingerprint),
 KEY allocate (environment,issuer,type)
) ENGINE=InnoDB $cc;");
        dbDelta("CREATE TABLE {$this->events} (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 document_id bigint unsigned NOT NULL DEFAULT 0,
 order_id bigint unsigned NOT NULL DEFAULT 0,
 actor bigint unsigned NOT NULL DEFAULT 0,
 code varchar(64) NOT NULL,
 detail longtext NOT NULL,
 created_at datetime NOT NULL,
 PRIMARY KEY  (id),
 KEY document_lookup (document_id)
) ENGINE=InnoDB $cc;");
        dbDelta("CREATE TABLE {$this->jobs} (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 op_key varchar(64) NOT NULL,
 order_id bigint unsigned NOT NULL,
 refund_id bigint unsigned NOT NULL,
 payload longtext NOT NULL,
 state varchar(16) NOT NULL DEFAULT 'pending',
 attempts int unsigned NOT NULL DEFAULT 0,
 next_run datetime NOT NULL,
 PRIMARY KEY  (id),
 UNIQUE KEY operation (op_key),
 KEY queue (state,next_run)
) ENGINE=InnoDB $cc;");
        foreach ([$this->docs,$this->cafs,$this->events,$this->jobs] as $table) {
            $engine = $this->db->get_var($this->db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s',$table));
            if (strtolower((string)$engine) !== 'innodb') throw new Failure('Se requiere InnoDB en todas las tablas DTE.');
        }
        update_option('wdt_version','0.2.1',false);
    }
    public function query(string $sql) { $r=$this->db->query($sql); if ($r === false) throw new Retryable('Error de almacenamiento.'); return $r; }
    public function insert(string $table,array $data): int {
        if ($this->db->insert($table,$data) === false) throw new Retryable('No se pudo guardar el registro.');
        return (int)$this->db->insert_id;
    }
    public function update(string $table,array $data,int $id): void {
        if ($this->db->update($table,$data,['id'=>$id]) === false) throw new Retryable('No se pudo actualizar el registro.');
    }
    public function lock(string $name, callable $fn) {
        $key = 'wdt_'.substr(hash('sha256',$this->docs.':'.$name),0,56);
        if ((int)$this->db->get_var($this->db->prepare('SELECT GET_LOCK(%s, 3)',$key)) !== 1) throw new Retryable('Operación en curso. Reintente.');
        try { return $fn(); } finally { $this->db->get_var($this->db->prepare('SELECT RELEASE_LOCK(%s)',$key)); }
    }
    public function transaction(callable $fn) {
        $this->query('START TRANSACTION');
        try { $r=$fn(); $this->query('COMMIT'); return $r; } catch (\Throwable $e) { $this->db->query('ROLLBACK'); throw $e; }
    }
    public function get(int $id): array {
        $r=$this->db->get_row($this->db->prepare("SELECT * FROM {$this->docs} WHERE id=%d",$id),ARRAY_A);
        if (!$r) throw new Failure('Documento no encontrado.'); return $r;
    }
    public function operation(string $key): ?array { return $this->db->get_row($this->db->prepare("SELECT * FROM {$this->docs} WHERE op_key=%s",$key),ARRAY_A); }
    public function list(int $order): array { return $this->db->get_results($this->db->prepare("SELECT * FROM {$this->docs} WHERE order_id=%d ORDER BY id",$order),ARRAY_A); }
    public function snapshot(array $d): array { return json_decode(Vault::decrypt($d['snapshot']),true,512,JSON_THROW_ON_ERROR); }
    public function event(int $doc,int $order,string $code,array $detail=[]): void {
        $this->insert($this->events,['document_id'=>$doc,'order_id'=>$order,'actor'=>get_current_user_id(),'code'=>$code,'detail'=>Vault::encrypt(wp_json_encode($detail)),'created_at'=>gmdate('Y-m-d H:i:s')]);
    }
    public function state(int $id,string $state,string $code='',array $extra=[]): void {
        $d=$this->get($id);
        $this->transaction(function() use($id,$state,$code,$extra,$d) {
            $this->update($this->docs,array_merge($extra,['state'=>$state,'last_code'=>$code,'updated_at'=>gmdate('Y-m-d H:i:s')]),$id);
            $this->event($id,(int)$d['order_id'],$state,['code'=>$code]);
        });
        $order=wc_get_order($d['order_id']);
        if ($order && $d['state'] !== $state) $order->add_order_note(sprintf('Woo DTE Chile: documento #%d, %s → %s (%s).',$id,$d['state'],$state,$code));
    }
    public function importCaf(string $xml,array $c): int {
        $caf=new Caf($xml,$c['rut']);
        $keys=defined('WDT_SII_CAF_KEYS') ? WDT_SII_CAF_KEYS : [];
        $pem=$keys[$c['environment']][$caf->data['idk']] ?? '';
        if (!$pem) throw new Failure('Configure la llave pública oficial SII para este ambiente/IDK en WDT_SII_CAF_KEYS.');
        $caf=new Caf($xml,$c['rut'],$pem);
        if ($caf->expiry() < substr(Rules::now(),0,10)) throw new Failure('CAF vencido.');
        return $this->lock('caf-import',fn()=> $this->transaction(function() use($caf,$xml,$c) {
            $n=$this->db->get_var($this->db->prepare("SELECT COUNT(*) FROM {$this->cafs} WHERE environment=%s AND issuer=%s AND type=%d AND first_folio<=%d AND last_folio>=%d",$c['environment'],$c['rut'],$caf->data['type'],$caf->data['end'],$caf->data['start']));
            if ((int)$n) throw new Failure('El rango CAF se superpone con uno existente.');
            $id=$this->insert($this->cafs,['environment'=>$c['environment'],'issuer'=>$c['rut'],'type'=>$caf->data['type'],'first_folio'=>$caf->data['start'],'last_folio'=>$caf->data['end'],'next_folio'=>$caf->data['start'],'expires'=>$caf->expiry(),'fingerprint'=>hash('sha256',Xml::compact($caf->xml->getElementsByTagName('CAF')->item(0))),'secret'=>Vault::encrypt($xml)]);
            $this->event(0,0,'caf_imported',['caf_id'=>$id]); return $id;
        }));
    }
    public function reserve(array $d): array {
        return $this->transaction(function() use($d) {
            $row=$this->db->get_row($this->db->prepare("SELECT * FROM {$this->docs} WHERE id=%d FOR UPDATE",$d['id']),ARRAY_A);
            if ($row['folio']) return $row;
            $caf=$this->db->get_row($this->db->prepare("SELECT * FROM {$this->cafs} WHERE environment=%s AND issuer=%s AND type=%d AND next_folio<=last_folio AND expires>=%s ORDER BY expires,id LIMIT 1 FOR UPDATE",$d['environment'],$d['issuer'],$d['type'],substr(Rules::now(),0,10)),ARRAY_A);
            if (!$caf) throw new Failure('No hay CAF vigente con folios disponibles.');
            $this->update($this->cafs,['next_folio'=>(int)$caf['next_folio']+1],(int)$caf['id']);
            $snapshot=$this->snapshot($row);
            $snapshot['requested_date']=$snapshot['date']; $snapshot['date']=substr(Rules::now(),0,10);
            $this->update($this->docs,['folio'=>$caf['next_folio'],'caf_id'=>$caf['id'],'snapshot'=>Vault::encrypt(wp_json_encode($snapshot))],(int)$d['id']);
            $this->event((int)$d['id'],(int)$d['order_id'],'folio_reserved',['folio'=>$caf['next_folio'],'caf_id'=>$caf['id']]);
            return $this->get((int)$d['id']);
        });
    }
    public function caf(int $id): string { return Vault::decrypt((string)$this->db->get_var($this->db->prepare("SELECT secret FROM {$this->cafs} WHERE id=%d",$id))); }
}
