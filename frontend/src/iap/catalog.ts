// Credit packs sold through Google Play Billing (consumable in-app products).
// The product IDs must match the ones created in Play Console > Monetize > In-app products.
// Prices are set in Play Console; the app always shows the store's localized price and only
// falls back to `suggestedPrice` when the store is unavailable (web preview, Expo Go).

export type CoinPack = {
  sku: string;
  credits: number;
  suggestedPrice: string;
  bonus?: string; // extra credits vs. the smallest pack, per euro
  tag?: string;
};

export const COIN_PACKS: CoinPack[] = [
  { sku: "coins_500", credits: 500, suggestedPrice: "0,99 €" },
  { sku: "coins_1200", credits: 1200, suggestedPrice: "1,99 €", bonus: "+20 %" },
  { sku: "coins_3500", credits: 3500, suggestedPrice: "4,99 €", bonus: "+40 %", tag: "POPULAIRE" },
  { sku: "coins_8000", credits: 8000, suggestedPrice: "9,99 €", bonus: "+60 %", tag: "MEILLEURE OFFRE" },
];

export const PACK_BY_SKU: Record<string, CoinPack> = Object.fromEntries(COIN_PACKS.map((p) => [p.sku, p]));
