<?php
// Isolated REST metadata contract; no network, database, or SII credentials.
define('ABSPATH', __DIR__);
$routes=[]; $manager=false; $environment='certification';
function register_rest_route($ns,$path,$args){global $routes;$routes[$path]=$args;}
function current_user_can($cap){global $manager;assert($cap==='manage_woocommerce');return $manager;}
function get_option($key,$default=[]){global $environment;return ['environment'=>$environment,'auto'=>true,'auto_refunds'=>true];}
class WP_REST_Response {
 public $data; public $headers=[];
 function __construct($data){$this->data=$data;}
 function header($key,$value){$this->headers[$key]=$value;}
}
require __DIR__.'/wordpress/woo-dte-chile/includes/Domain.php';
require __DIR__.'/wordpress/woo-dte-chile/includes/Service.php';
require __DIR__.'/wordpress/woo-dte-chile/includes/Rest.php';
$service=(new ReflectionClass(WooDTEChile\Service::class))->newInstanceWithoutConstructor();
(new WooDTEChile\Rest($service))->routes();
$route=$routes['/capabilities'];
assert(($route['permission_callback'])()===false);
$manager=true;assert(($route['permission_callback'])()===true);
$response=($route['callback'])();
assert($response->data['version']==='0.2.1');assert($response->data['apiVersion']===1);
assert($response->data['productionUnlocked']===false);
assert($response->data['siiCertificationVerified']===false);
assert($response->headers['Cache-Control']==='private, no-store');
assert(!isset($response->data['rut']) && !isset($response->data['credentials']));
$environment='production';assert(($route['callback'])()->data['productionUnlocked']===false);
echo "Capabilities: 9 assertions OK (production remains locked)\n";
