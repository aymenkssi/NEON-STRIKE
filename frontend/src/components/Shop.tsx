import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from "react-native";
import * as Haptics from "@/src/utils/haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { getPacks, onPacksChange } from "../iap/catalog";
import { buyPack, getLocalizedPrice, getStoreStatus, onStoreChange, retryUnfinishedPurchases } from "../iap";
import Panel from "./Panel";
import { formatNumber, useLang, useT } from "@/src/i18n";

// Pack artwork grows with the amount (coin, stacks, pile, chest), so packs added later from the
// admin page get a matching picture without a new app version.
const PACK_ART = [
  { min: 6000, src: require("../../assets/images/packs/coins_8000.png") },
  { min: 2500, src: require("../../assets/images/packs/coins_3500.png") },
  { min: 800, src: require("../../assets/images/packs/coins_1200.png") },
  { min: 0, src: require("../../assets/images/packs/coins_500.png") },
];
const packArt = (credits: number) => (PACK_ART.find((a) => credits >= a.min) ?? PACK_ART[PACK_ART.length - 1]).src;

type Props = {
  credits: number;
  onClose: () => void;
};

type Notice = { tone: "ok" | "warn" | "error"; text: string } | null;

export default function Shop({ credits, onClose }: Props) {
  const [status, setStatus] = useState(getStoreStatus());
  const [buying, setBuying] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [packs, setPacks] = useState(getPacks());
  const t = useT();
  const lang = useLang();
  useEffect(() => onPacksChange(() => setPacks(getPacks())), []);

  useEffect(() => onStoreChange(() => setStatus(getStoreStatus())), []);
  // Opening the shop also retries purchases whose verification failed earlier.
  useEffect(() => {
    retryUnfinishedPurchases();
  }, []);

  const buy = async (sku: string) => {
    if (buying) return;
    setBuying(sku);
    setNotice(null);
    const res = await buyPack(sku);
    setBuying(null);
    if (res.kind === "granted") {
      setNotice({ tone: "ok", text: t("shop.granted", { n: formatNumber(res.credits) }) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (res.kind === "pending") {
      setNotice({ tone: "warn", text: t("shop.pending") });
    } else if (res.kind === "error") {
      setNotice({ tone: "error", text: res.message });
    }
  };

  const available = status === "ready";

  return (
    <Panel title={t("shop.title")} icon="cart" credits={credits} onClose={onClose} testID="shop">
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {packs.map((pack) => {
          const price = getLocalizedPrice(pack.sku);
          const canBuy = available && !!price && !buying;
          return (
            <View key={pack.sku} style={[styles.card, pack.tag && styles.cardFeatured]} testID={`pack-${pack.sku}`}>
              {pack.tag ? (
                <Text style={styles.tag}>{(lang === "en" && pack.tag_en) || pack.tag}</Text>
              ) : (
                <View style={styles.tagSpacer} />
              )}
              <Image source={packArt(pack.credits)} style={styles.art} resizeMode="contain" />
              <Text style={styles.amount}>{formatNumber(pack.credits)}</Text>
              <Text style={styles.unit}>{t("shop.credits")}</Text>
              <Text style={styles.bonus}>{pack.bonus ? t("shop.bonus", { b: pack.bonus }) : " "}</Text>
              <Pressable
                testID={`buy-${pack.sku}`}
                disabled={!canBuy}
                onPress={() => buy(pack.sku)}
                style={[styles.priceBtn, !canBuy && styles.priceBtnOff]}
              >
                {buying === pack.sku ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={[styles.priceText, !canBuy && { color: colors.onSurfaceTertiary }]}>
                    {price ?? pack.suggestedPrice ?? "—"}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {notice ? (
        <Text
          style={[
            styles.notice,
            { color: notice.tone === "ok" ? colors.brand : notice.tone === "warn" ? colors.warning : colors.error },
          ]}
          testID="shop-notice"
        >
          {notice.text}
        </Text>
      ) : (
        <Text style={styles.footer}>
          {status === "unavailable"
            ? t("shop.unavailable")
            : status === "connecting"
              ? t("shop.connecting")
              : status === "error"
                ? t("shop.error")
                : t("shop.secure")}
        </Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  card: {
    width: 160,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  cardFeatured: { borderColor: "rgba(255,176,0,0.6)" },
  tag: {
    alignSelf: "stretch",
    textAlign: "center",
    backgroundColor: colors.warning,
    color: colors.onWarning,
    fontFamily: fonts.display,
    fontSize: 11,
    letterSpacing: 1.5,
    marginHorizontal: -spacing.sm,
    paddingVertical: 2,
    borderTopLeftRadius: radius.md - 2,
    borderTopRightRadius: radius.md - 2,
    marginBottom: 6,
  },
  tagSpacer: { height: 25 },
  art: { width: 72, height: 72, marginVertical: -4 },
  amount: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26, lineHeight: 28, fontVariant: ["tabular-nums"] },
  unit: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 2 },
  bonus: { color: colors.brand, fontFamily: fonts.displaySemi, fontSize: 13, minHeight: 18 },
  priceBtn: {
    alignSelf: "stretch",
    height: 40,
    marginTop: 4,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  priceBtnOff: { backgroundColor: colors.surfaceTertiary },
  priceText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 17, letterSpacing: 1 },
  notice: { fontFamily: fonts.textMed, fontSize: 14, textAlign: "center", marginTop: spacing.sm },
  footer: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
});
