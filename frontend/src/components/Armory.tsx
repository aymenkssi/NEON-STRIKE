import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { LOADOUT_SIZE, WEAPONS, onSale, onWeaponPricesChange, priceOf, weaponBars, type ArmoryState } from "../game/armory";
import type { UpgradeKey, UpgradeLevels } from "../game/progression";
import type { SkinState } from "../game/skins";
import { formatNumber, useT, type Key } from "@/src/i18n";
import Panel from "./Panel";
import WeaponPreview from "./WeaponPreview";
import { UpgradesGrid } from "./Arsenal";

type Props = {
  credits: number;
  armory: ArmoryState;
  skins: SkinState;
  upgrades: UpgradeLevels;
  onBuyWeapon: (key: string) => boolean;
  onToggleLoadout: (key: string) => boolean;
  onBuyUpgrade: (key: UpgradeKey) => boolean;
  onOpenShop: () => void;
  onClose: () => void;
};

type Tab = "weapons" | "upgrades";

const BARS: { key: "damage" | "rate" | "accuracy" | "ammo"; label: Key }[] = [
  { key: "damage", label: "armory.damage" },
  { key: "rate", label: "armory.rate" },
  { key: "accuracy", label: "armory.accuracy" },
  { key: "ammo", label: "armory.magazine" },
];

// Armory: buy real weapons with credits (prices set in the admin page), choose the 4 carried
// in game, and upgrade damage / armour / magazine / reload.
export default function Armory({ credits, armory, skins, upgrades, onBuyWeapon, onToggleLoadout, onBuyUpgrade, onOpenShop, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("weapons");
  const [selected, setSelected] = useState(armory.loadout[0] ?? "shotgun");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [, setPricesVersion] = useState(0);
  useEffect(() => onWeaponPricesChange(() => setPricesVersion((v) => v + 1)), []);

  const w = WEAPONS.find((x) => x.key === selected) ?? WEAPONS[0];
  const owned = armory.owned.includes(w.key);
  const slot = armory.loadout.indexOf(w.key);
  const price = priceOf(w.key);
  const forSale = onSale(w.key);
  const bars = weaponBars(w);
  const name = (key: string) => t(`weapon.${key}` as Key);

  const act = () => {
    setNotice(null);
    if (!owned) {
      if (onBuyWeapon(w.key)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setNotice({ ok: true, text: t("armory.bought", { name: name(w.key) }) });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setNotice({ ok: false, text: t("skins.poor") });
      }
      return;
    }
    if (!onToggleLoadout(w.key)) {
      setNotice({ ok: false, text: slot >= 0 ? t("armory.keepOne") : t("armory.full", { n: LOADOUT_SIZE }) });
      return;
    }
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Panel title={t("armory.title")} icon="pistol" credits={credits} onCreditsPress={onOpenShop} onClose={onClose} testID="armory">
      <View style={styles.tabs}>
        {(["weapons", "upgrades"] as Tab[]).map((k) => (
          <Pressable key={k} testID={`armory-tab-${k}`} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
            <MaterialCommunityIcons name={k === "weapons" ? "pistol" : "arrow-up-bold-circle"} size={16} color={tab === k ? colors.onBrand : colors.onSurfaceSecondary} />
            <Text style={[styles.tabText, tab === k && { color: colors.onBrand }]}>{t(k === "weapons" ? "armory.weapons" : "armory.upgrades")}</Text>
          </Pressable>
        ))}
        {tab === "weapons" && (
          <View style={styles.loadout} testID="loadout">
            <Text style={styles.loadoutLabel}>{t("armory.loadout")}</Text>
            {Array.from({ length: LOADOUT_SIZE }, (_, i) => {
              const k = armory.loadout[i];
              return (
                <Pressable key={i} onPress={() => k && setSelected(k)} style={[styles.slot, k && styles.slotOn]} testID={`slot-${i}`}>
                  <Text style={[styles.slotText, k && { color: colors.brandSecondary }]}>{k ? WEAPONS.find((x) => x.key === k)?.short : "—"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {tab === "upgrades" ? (
        <UpgradesGrid credits={credits} upgrades={upgrades} onBuy={onBuyUpgrade} />
      ) : (
        <View style={styles.body}>
          <View style={styles.left}>
            <View style={styles.preview}>
              <WeaponPreview weapon={w.key} weaponSkin={skins.weapon} outfit={skins.outfit} withHand={false} />
            </View>
            <Text style={styles.name} testID="armory-name">{name(w.key)}</Text>
            <Text style={styles.desc} numberOfLines={2}>{t(`armory.desc.${w.key}` as Key)}</Text>
            {BARS.map((b) => (
              <View key={b.key} style={styles.barRow}>
                <Text style={styles.barLabel}>{t(b.label)}</Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(bars[b.key] * 100)}%` }]} />
                </View>
              </View>
            ))}
            <Pressable
              testID="armory-action"
              onPress={act}
              disabled={!owned && !forSale}
              style={[styles.action, !owned ? (forSale ? styles.actionBuy : styles.actionOff) : slot >= 0 ? styles.actionIn : styles.actionEquip]}
            >
              {!owned ? (
                forSale ? (
                  <>
                    <MaterialCommunityIcons name="circle-multiple" size={18} color={colors.onWarning} />
                    <Text style={[styles.actionText, { color: colors.onWarning }]}>{price === 0 ? t("skins.free") : formatNumber(price)}</Text>
                  </>
                ) : (
                  <Text style={[styles.actionText, { color: colors.onSurfaceTertiary }]}>{t("armory.notForSale")}</Text>
                )
              ) : slot >= 0 ? (
                <>
                  <MaterialCommunityIcons name="check" size={18} color={colors.brand} />
                  <Text style={[styles.actionText, { color: colors.brand }]}>{t("armory.inLoadout", { n: slot + 1 })}</Text>
                </>
              ) : (
                <Text style={[styles.actionText, { color: colors.onBrand }]}>{t("armory.equip")}</Text>
              )}
            </Pressable>
            {notice && (
              <Text style={[styles.notice, { color: notice.ok ? colors.brand : colors.warning }]} testID="armory-notice">
                {notice.text}
              </Text>
            )}
          </View>

          <ScrollView style={styles.right} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {WEAPONS.filter((x) => armory.owned.includes(x.key) || onSale(x.key)).map((x) => {
              const mine = armory.owned.includes(x.key);
              const inSlot = armory.loadout.indexOf(x.key);
              return (
                <Pressable
                  key={x.key}
                  testID={`weapon-card-${x.key}`}
                  onPress={() => {
                    setSelected(x.key);
                    setNotice(null);
                  }}
                  style={[styles.card, selected === x.key && styles.cardSelected]}
                >
                  <Text style={styles.cardShort}>{x.short}</Text>
                  <Text style={styles.cardName} numberOfLines={1}>{name(x.key)}</Text>
                  {inSlot >= 0 ? (
                    <Text style={styles.cardIn}>{t("armory.slot", { n: inSlot + 1 })}</Text>
                  ) : mine ? (
                    <Text style={styles.cardOwned}>{t("armory.owned")}</Text>
                  ) : (
                    <View style={styles.priceRow}>
                      <MaterialCommunityIcons name="circle-multiple" size={12} color={colors.warning} />
                      <Text style={styles.price}>{priceOf(x.key) === 0 ? t("skins.free") : formatNumber(priceOf(x.key))}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  tabOn: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  loadout: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto" },
  loadoutLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 1 },
  slot: { minWidth: 44, height: 30, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  slotOn: { borderStyle: "solid", borderColor: colors.brandSecondary, backgroundColor: "rgba(0,255,255,0.08)" },
  slotText: { color: colors.onSurfaceTertiary, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
  body: { flexDirection: "row", gap: spacing.md, flexShrink: 1 },
  left: { width: 270, gap: 3 },
  preview: { height: 104, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  name: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5 },
  desc: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, lineHeight: 13 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 70, color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 0.5 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.brandSecondary },
  action: { height: 36, borderRadius: radius.md, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 2, marginTop: 4 },
  actionBuy: { backgroundColor: colors.warning, borderColor: colors.warning },
  actionEquip: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionIn: { borderColor: colors.brand },
  actionOff: { borderColor: colors.border },
  actionText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.5 },
  notice: { fontFamily: fonts.textMed, fontSize: 12, textAlign: "center" },
  right: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.sm },
  card: {
    width: 112,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  cardSelected: { borderColor: colors.brandSecondary, backgroundColor: "rgba(0,255,255,0.07)" },
  cardShort: { color: colors.brandSecondary, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5 },
  cardName: { color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 12 },
  cardIn: { color: colors.brand, fontFamily: fonts.display, fontSize: 11, letterSpacing: 1 },
  cardOwned: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 11, letterSpacing: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  price: { color: colors.warning, fontFamily: fonts.display, fontSize: 13 },
});
