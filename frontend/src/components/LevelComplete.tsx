import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { showRewarded } from "../ads";
import { MAX_LEVEL, WEAPON_UNLOCK_LEVEL, levelReward, type LevelResult } from "../game/progression";

type Props = {
  result: LevelResult;
  onDoubleCredits: (extra: number) => void;
  onNext: () => void;
  onExit: () => void;
};

const WEAPON_NAMES: Record<string, string> = { smg: "SMG", rifle: "ASSAULT RIFLE" };

export default function LevelComplete({ result, onDoubleCredits, onNext, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const reward = levelReward(result);
  const [doubled, setDoubled] = useState(false);
  const [doubling, setDoubling] = useState(false);
  const isLast = result.level >= MAX_LEVEL;
  const newWeapon = Object.keys(WEAPON_UNLOCK_LEVEL).find((k) => WEAPON_UNLOCK_LEVEL[k] === result.level + 1);

  const criteria = [
    { label: "Niveau terminé", ok: true },
    { label: "Finir avec 50 % de santé ou plus", ok: result.health >= result.maxHealth * 0.5 },
    { label: "30 % de tirs à la tête ou plus", ok: result.kills > 0 && result.headshots / result.kills >= 0.3 },
  ];

  const double = () => {
    if (doubled || doubling) return;
    setDoubling(true);
    showRewarded(
      () => {
        onDoubleCredits(reward.total);
        setDoubled(true);
      },
      () => setDoubling(false)
    );
  };

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} testID="level-complete-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{isLast ? "CAMPAGNE TERMINÉE" : "SECTEUR NETTOYÉ"}</Text>
        <Text style={styles.title}>NIVEAU {result.level}</Text>

        <View style={styles.starsRow}>
          {[1, 2, 3].map((i) => (
            <Star key={i} filled={i <= reward.stars} index={i} />
          ))}
        </View>

        <View style={styles.columns}>
          <View style={styles.col}>
            {criteria.map((c) => (
              <View key={c.label} style={styles.critRow}>
                <MaterialCommunityIcons
                  name={c.ok ? "check-circle" : "close-circle-outline"}
                  size={16}
                  color={c.ok ? colors.brand : colors.onSurfaceTertiary}
                />
                <Text style={[styles.critText, !c.ok && { color: colors.onSurfaceTertiary }]}>{c.label}</Text>
              </View>
            ))}
            <Text style={styles.statsLine}>
              {result.kills} éliminations · {result.headshots} tirs à la tête · {result.health}/{result.maxHealth} PV
            </Text>
          </View>

          <View style={[styles.col, styles.rewardBox]}>
            <RewardRow label="Combat" value={reward.combat} />
            <RewardRow label="Bonus de niveau" value={reward.bonus} />
            <RewardRow label="Bonus étoiles" value={reward.starBonus} />
            <View style={styles.divider} />
            <RewardRow label={doubled ? "Total ×2" : "Total"} value={doubled ? reward.total * 2 : reward.total} strong />
          </View>
        </View>

        {newWeapon && (
          <View style={styles.unlockNote}>
            <MaterialCommunityIcons name="pistol" size={16} color={colors.brandSecondary} />
            <Text style={styles.unlockText}>Nouvelle arme au niveau suivant : {WEAPON_NAMES[newWeapon]}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {!doubled && (
            <Pressable testID="double-credits-button" style={[styles.btn, styles.doubleBtn]} onPress={double}>
              <MaterialCommunityIcons name="star-four-points" size={20} color={colors.onWarning} />
              <Text style={[styles.btnText, { color: colors.onWarning }]}>{doubling ? "…" : "CRÉDITS ×2 (PUB)"}</Text>
            </Pressable>
          )}
          {!isLast && (
            <Pressable testID="next-level-button" style={[styles.btn, styles.nextBtn]} onPress={onNext}>
              <Text style={[styles.btnText, { color: colors.onBrand }]}>NIVEAU SUIVANT</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onBrand} />
            </Pressable>
          )}
          <Pressable testID="level-menu-button" style={[styles.btn, styles.menuBtn]} onPress={onExit}>
            <MaterialCommunityIcons name="home" size={20} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>MENU</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Star({ filled, index }: { filled: boolean; index: number }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(200 + index * 250, withSpring(1, { damping: 8 }));
  }, [scale, index]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <MaterialCommunityIcons
        name={filled ? "star" : "star-outline"}
        size={index === 2 ? 64 : 50}
        color={filled ? colors.warning : colors.onSurfaceTertiary}
      />
    </Animated.View>
  );
}

function RewardRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.rewardRow}>
      <Text style={[styles.rewardLabel, strong && styles.rewardStrong]}>{label}</Text>
      <View style={styles.rewardValueWrap}>
        <Text style={[styles.rewardValue, strong && styles.rewardStrong]}>+{value}</Text>
        <MaterialCommunityIcons name="circle-multiple" size={strong ? 18 : 14} color={colors.warning} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay, zIndex: 50 },
  content: { alignItems: "center", justifyContent: "center", flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  kicker: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 3 },
  title: { color: colors.brand, fontFamily: fonts.display, fontSize: 44, letterSpacing: 4, textShadowColor: colors.brand, textShadowRadius: 14 },
  starsRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: -4 },
  columns: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  col: { minWidth: 240, gap: 6 },
  critRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  critText: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 14 },
  statsLine: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, marginTop: 4 },
  rewardBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rewardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.lg },
  rewardLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMed, fontSize: 14 },
  rewardValueWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  rewardValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, fontVariant: ["tabular-nums"] },
  rewardStrong: { color: colors.warning, fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  unlockNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  unlockText: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap", justifyContent: "center" },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.md, borderWidth: 2 },
  doubleBtn: { backgroundColor: colors.warning, borderColor: colors.warning },
  nextBtn: { backgroundColor: colors.brand, borderColor: colors.brand },
  menuBtn: { backgroundColor: "transparent", borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
