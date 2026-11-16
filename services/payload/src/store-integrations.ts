export const storeProviders = ['woo', 'shopify', 'payload'] as const;
export type StoreProvider = typeof storeProviders[number];
export const storeNames: Record<StoreProvider, string> = {woo:'WooCommerce',shopify:'Shopify',payload:'Payload CMS'};
export const isStoreProvider = (value: unknown): value is StoreProvider =>
  typeof value === 'string' && storeProviders.includes(value as StoreProvider);
export function blockedStore(provider: unknown, connected: string[]) {
  return isStoreProvider(provider) ? connected.find((p): p is StoreProvider => isStoreProvider(p) && p !== provider) : undefined;
}
export const storeConflictMessage = (provider: StoreProvider) =>
  `Desconecta ${storeNames[provider]} antes de conectar otra plataforma de tienda.`;
