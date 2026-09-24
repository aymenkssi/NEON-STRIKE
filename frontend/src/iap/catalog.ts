// Credit packs sold through Google Play Billing (consumable in-app products).
// The list comes from the backend (admin page) when available; COIN_PACKS is the built-in
// fallback. Every product ID must also exist in Play Console > Monetize > In-app products.
// Prices are set in Play Console; the app shows the store's localized price and only falls
// back to `suggestedPrice` when the store is unavailable (web preview, Expo Go).

export type CoinPack = {
  sku: string;
  credits: number;
  suggestedPrice?: string;
  bonus?: string | null; // extra credits vs. the smallest pack
  tag?: string | null;
};

export const COIN_PACKS: CoinPack[] = [
  { sku: "coins_500", credits: 500, suggestedPrice: "0,99 €" },
  { sku: "coins_1200", credits: 1200, suggestedPrice: "1,99 €", bonus: "+20 %" },
  { sku: "coins_3500", credits: 3500, suggestedPrice: "4,99 €", bonus: "+40 %", tag: "POPULAIRE" },
  { sku: "coins_8000", credits: 8000, suggestedPrice: "9,99 €", bonus: "+60 %", tag: "MEILLEURE OFFRE" },
];

let packs: CoinPack[] = COIN_PACKS;
const listeners = new Set<() => void>();

export function getPacks(): CoinPack[] {
  return packs;
}

export function getPack(sku: string): CoinPack | undefined {
  return packs.find((p) => p.sku === sku) ?? COIN_PACKS.find((p) => p.sku === sku);
}

// Replaces the shop content with the packs configured on the server.
export function setRemotePacks(remote: { sku: string; credits: number; bonus: string | null; tag: string | null }[]) {
  if (!remote.length) return;
  packs = remote.map((r) => ({
    sku: r.sku,
    credits: r.credits,
    bonus: r.bonus,
    tag: r.tag,
    suggestedPrice: COIN_PACKS.find((p) => p.sku === r.sku)?.suggestedPrice,
  }));
  listeners.forEach((fn) => fn());
}

export function onPacksChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
