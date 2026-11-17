<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

class Failure extends \RuntimeException {}
class Retryable extends Failure {}

final class Rules {
    public static function rut(string $s): string {
        $s = strtoupper(str_replace(['.', ' '], '', trim($s)));
        if (!preg_match('/^([1-9][0-9]{0,7})-([0-9K])$/D', $s, $m)) throw new Failure('RUT inválido.');
        $sum = 0; $factor = 2;
        foreach (str_split(strrev($m[1])) as $digit) { $sum += (int)$digit * $factor; $factor = $factor === 7 ? 2 : $factor + 1; }
        $dv = 11 - $sum % 11;
        if (($dv === 11 ? '0' : ($dv === 10 ? 'K' : (string)$dv)) !== $m[2]) throw new Failure('Dígito verificador inválido.');
        return $s;
    }
    public static function pesos($v): int {
        if (!is_scalar($v) || !preg_match('/^\d+(?:\.0+)?$/D', (string)$v) || (float)$v > 999999999999) throw new Failure('Se requieren pesos CLP enteros positivos.');
        return (int)$v;
    }
    public static function text(string $s, int $max): string {
        $s = trim(strip_tags($s));
        if ($s === '' || mb_strlen($s) > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $s) || !mb_check_encoding($s, 'UTF-8') || mb_convert_encoding(mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8'), 'UTF-8', 'ISO-8859-1') !== $s) throw new Failure('Texto vacío, demasiado largo o no representable en ISO-8859-1.');
        return $s;
    }
    public static function date(string $s): string {
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $s);
        if (!$d || $d->format('Y-m-d') !== $s) throw new Failure('Fecha inválida.');
        return $s;
    }
    public static function environment(string $s): string {
        if (!in_array($s, ['certification','production'], true)) throw new Failure('Ambiente inválido.');
        return $s;
    }
    public static function credit(int $original, int $reserved, int $amount, bool $cancel): void {
        if ($amount <= 0 || $reserved < 0 || $amount > $original - $reserved) throw new Failure('La NC supera el saldo disponible o tiene monto inválido.');
        if ($cancel && ($reserved !== 0 || $amount !== $original)) throw new Failure('Anular con NC requiere el total original sin NC previas. Use NC por saldo con código 3.');
    }
    public static function totals(array $lines): array {
        if (!$lines || count($lines) > 60) throw new Failure('Se requieren entre 1 y 60 líneas.');
        $gross = 0; $exempt = 0;
        foreach ($lines as $l) {
            self::text($l['name'], 80);
            $q=$l['quantity']??1; if (!is_numeric($q) || (float)$q<=0 || (float)$q>999999999 || !is_finite((float)$q)) throw new Failure('Cantidad inválida.');
            if (!empty($l['description'])) self::text($l['description'],1000);
            $amount = self::pesos($l['amount']);
            if ($amount < 1) throw new Failure('Las líneas deben tener monto mayor que cero.');
            if (!is_bool($l['exempt'])) throw new Failure('Indicador de exención inválido.');
            if ($l['exempt']) $exempt += $amount; else $gross += $amount;
        }
        self::pesos((string)($gross+$exempt));
        $net = intdiv($gross * 100 + 59, 119);
        return ['net'=>$net, 'vat'=>$gross-$net, 'exempt'=>$exempt, 'total'=>$gross+$exempt];
    }
    public static function backoff(int $attempt): int { return min(21600, 60 * (2 ** min(9, max(0, $attempt - 1)))); }
    public static function now(): string { return (new \DateTimeImmutable('now', new \DateTimeZone('America/Santiago')))->format('Y-m-d\TH:i:s'); }
}

final class Vault {
    private static function key(): string {
        $k = defined('WDT_SECRET_KEY') ? base64_decode(WDT_SECRET_KEY, true) : false;
        if ($k === false || strlen($k) !== SODIUM_CRYPTO_SECRETBOX_KEYBYTES) throw new Failure('Configure WDT_SECRET_KEY (32 bytes aleatorios en base64) en wp-config.php.');
        return $k;
    }
    public static function encrypt(string $s): string {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return base64_encode($nonce . sodium_crypto_secretbox($s, $nonce, self::key()));
    }
    public static function decrypt(string $s): string {
        $b = base64_decode($s, true);
        if (!$b || strlen($b) < 40) throw new Failure('Secreto cifrado inválido.');
        $p = sodium_crypto_secretbox_open(substr($b, 24), substr($b, 0, 24), self::key());
        if ($p === false) throw new Failure('No se pudo descifrar. Compruebe la clave de respaldo.');
        return $p;
    }
}

final class Config {
    public static function get(): array { return get_option('wdt_settings', []) + ['environment'=>'certification','auto'=>false,'auto_refunds'=>false,'rut'=>'','sender'=>'','name'=>'','giro'=>'','activity'=>'','address'=>'','commune'=>'','sii_office'=>'','resolution_date'=>'','resolution_number'=>'0','production_confirmation'=>'','evidence'=>'']; }
    public static function validate(array $c): array {
        $c['environment'] = Rules::environment($c['environment']);
        foreach (['rut','sender'] as $k) $c[$k] = Rules::rut($c[$k]);
        foreach (['name'=>100,'giro'=>80,'address'=>70,'commune'=>20,'sii_office'=>40] as $k=>$len) $c[$k] = Rules::text($c[$k], $len);
        if (!preg_match('/^[0-9]{6}$/D', $c['activity'])) throw new Failure('Código de actividad debe tener 6 dígitos.');
        Rules::date($c['resolution_date']); Rules::pesos($c['resolution_number']);
        self::gate($c);
        return $c;
    }
    public static function gate(array $c): void {
        Rules::environment($c['environment']);
        if ($c['environment'] === 'production' && (!defined('WDT_PRODUCTION_ORIGIN') || !function_exists('home_url') || WDT_PRODUCTION_ORIGIN !== rtrim(home_url(), '/') || !str_starts_with(WDT_PRODUCTION_ORIGIN, 'https://') || !defined('WDT_ENABLE_PRODUCTION') || WDT_ENABLE_PRODUCTION !== $c['rut'] || ($c['production_confirmation'] ?? '') !== 'ACTIVAR PRODUCCION '.$c['rut'] || strlen($c['evidence'] ?? '') < 20)) throw new Failure('Producción bloqueada: requiere autorización en servidor, confirmación por RUT y registro de evidencia de certificación.');
    }
}
