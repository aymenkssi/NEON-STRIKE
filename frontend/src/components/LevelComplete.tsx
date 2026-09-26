import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { showRewarded } from "../ads";
import { DIFFICULTY, MAX_LEVEL, levelReward, type LevelResult } from "../game/progression";
import { formatNumber, useT, type Key } from "@/src/i18n";

type Props = {
  result: LevelResult;
  onDoubleCredits: (extra: number) => void;
  onNext: () => void;
  onExit: () => void;
};

export default function LevelComplete({ result, onDoubleCredits, onNext, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const reward = levelReward(result);
  const [doubled, setDoubled] = useState(false);
  const [doubling, setDoubling] = useState(false);
  const isLast = result.level >= MAX_LEVEL;

  const criteria = [
    { label: t("complete.crit1"), ok: true },
    { label: t("complete.crit2"), ok: result.health >= result.maxHealth * 0.5 },
    { label: t("complete.crit3"), ok: result.kills > 0 && result.headshots / result.kills >= 0.3 },
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
        <Text style={styles.kicker}>{isLast ? t("complete.campaignDone") : t("complete.cleared")}</Text>
        <Text style={styles.title}>{t("menu.levelN", { n: result.level })}</Text>

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
              {t("complete.stats", { kills: result.kills, heads: result.headshots, hp: result.health, max: result.maxHealth })}
            </Text>
          </View>

          <View style={[styles.col, styles.rewardBox]}>
            <RewardRow label={t("complete.combat")} value={reward.combat} />
            <RewardRow label={t("complete.levelBonus")} value={reward.bonus} />
            <RewardRow label={t("complete.starBonus")} value={reward.starBonus} />
            {result.difficulty && result.difficulty !== "normal" && (
              <Text style={[styles.diffNote, { color: DIFFICULTY[result.difficulty].color }]} testID="complete-difficulty">
                {t("complete.difficulty", { name: t(`difficulty.${result.difficulty}`), m: formatNumber(reward.mult) })}
              </Text>
            )}
            <View style={styles.divider} />
            <RewardRow label={doubled ? t("complete.totalX2") : t("complete.total")} value={doubled ? reward.total * 2 : reward.total} strong />
          </View>
        </View>

        {result.difficulty === "nightmare" && (
          <View style={styles.unlockNote} testID="complete-skull">
            <MaterialCommunityIcons name="skull" size={16} color={colors.error} />
            <Text style={[styles.unlockText, { color: colors.error }]}>{t("complete.skull")}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {!doubled && (
            <Pressable testID="double-credits-button" style={[styles.btn, styles.doubleBtn]} onPress={double}>
              <MaterialCommunityIcons name="star-four-points" size={20} color={colors.onWarning} />
              <Text style={[styles.btnText, { color: colors.onWarning }]}>{doubling ? "…" : t("complete.double")}</Text>
            </Pressable>
          )}
          {!isLast && (
            <Pressable testID="next-level-button" style={[styles.btn, styles.nextBtn]} onPress={onNext}>
              <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("complete.next")}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onBrand} />
            </Pressable>
          )}
          <Pressable testID="level-menu-button" style={[styles.btn, styles.menuBtn]} onPress={onExit}>
            <MaterialCommunityIcons name="home" size={20} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.menu")}</Text>
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
  diffNote: { fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 0.5, textAlign: "right", marginTop: 2 },
  unlockNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  unlockText: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap", justifyContent: "center" },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, height: 48, borderRadius: radius.md, borderWidth: 2 },
  doubleBtn: { backgroundColor: colors.warning, borderColor: colors.warning },
  nextBtn: { backgroundColor: colors.brand, borderColor: colors.brand },
  menuBtn: { backgroundColor: "transparent", borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
