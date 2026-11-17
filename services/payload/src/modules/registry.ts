/** Only reviewed, bundled adapters can be installed. Never executes uploaded code. */
export const moduleCatalog = [{
  id: 'woo-dte-chile', name: 'Facturación propia · Chile', version: '0.2.1',
  description: 'Boletas, facturas y notas de crédito/débito con WooCommerce.',
  requires: ['woocommerce'], documents: [39, 33, 61, 56],
  installer: '/modules/woo-dte-chile-0.2.1.zip',
  certification: 'Requiere validación con credenciales, CAF y certificado en el SII. No certificado para producción.',
}] as const;
export const moduleById = (id: unknown) => moduleCatalog.find(module => module.id === id);
