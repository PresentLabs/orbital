<?php
namespace WooDTEChile;
defined('ABSPATH') || exit;

final class Barcode {
    public static function matrix(string $ted): array {
        require_once WDT_DIR.'/vendor/tecnickcom/tcpdf/include/barcodes/pdf417.php';
        $barcode=new class($ted,5,3) extends \PDF417 {
            protected function getInputSequences($code) { return [[strlen($code)%6===0?924:901,$code]]; }
            protected function getErrorCorrectionLevel($ecl,$numcw) {
                if ($numcw>863) throw new Failure('TED excede capacidad PDF417 con corrección de errores nivel 5.');
                return 5;
            }
        };
        $matrix=$barcode->getBarcodeArray();
        if (empty($matrix['bcode'])) throw new Failure('No se pudo construir timbre PDF417.');
        return $matrix;
    }
}
