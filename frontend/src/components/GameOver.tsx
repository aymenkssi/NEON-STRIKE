import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { submitScore } from "../api/leaderboard";
import { showRewarded } from "../ads";
import AdBanner from "../ads/AdBanner";
import type { RunResult } from "../game/GameEngine";
import { formatNumber, useT } from "@/src/i18n";

type Props = {
  username: string;
  guest: boolean;
  result: RunResult;
  canRevive: boolean;
  onRevive: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export default function GameOver({ username, guest, result, canRevive, onRevive, onRestart, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [state, setState] = useState<"submitting" | "done" | "error" | "guest">(guest ? "guest" : "submitting");
  const [rank, setRank] = useState<number | null>(null);
  const [isHigh, setIsHigh] = useState(false);
  const [displayScore, setDisplayScore] = useState(result.score);
  const [doubled, setDoubled] = useState(false);
  const [doubling, setDoubling] = useState(false);

  const doSubmit = async (scoreValue: number) => {
    // Guests play offline: only accounts appear on the world leaderboard.
    if (guest) return;
    setState("submitting");
    try {
      const res = await submitScore({
        name: username,
        score: scoreValue,
        level: result.level,
        kills: result.kills,
      });
      setRank(res.rank);
      setIsHigh(res.is_high_score);
      setState("done");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    doSubmit(result.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doubleScore = () => {
    if (doubled || doubling) return;
    setDoubling(true);
    showRewarded(
      () => {
        const ns = result.score * 2;
        setDisplayScore(ns);
        setDoubled(true);
        doSubmit(ns);
      },
      () => setDoubling(false)
    );
  };

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} testID="game-over-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.dead}>{t("over.title")}</Text>

        <View style={styles.statsRow}>
          <Stat label={t("stat.score")} value={formatNumber(displayScore)} big />
          <Stat label={t("stat.level")} value={String(result.level)} />
          <Stat label={t("stat.kills")} value={String(result.kills)} />
        </View>
        {doubled && <Text style={styles.doubledTag}>{t("over.doubled")}</Text>}
        {result.credits > 0 && (
          <View style={styles.creditsRow}>
            <MaterialCommunityIcons name="circle-multiple" size={16} color={colors.warning} />
            <Text style={styles.creditsText}>{t("over.credits", { n: result.credits })}</Text>
          </View>
        )}

        <View style={styles.rankBox}>
          {state === "submitting" && (
            <View style={styles.rankRow}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.rankInfo}>{t("over.sending")}</Text>
            </View>
          )}
          {state === "done" && (
            <Text style={styles.rankInfo}>
              {isHigh ? t("over.record") + "  " : ""}
              {t("over.rank")} <Text style={styles.rankNum}>#{rank}</Text>
            </Text>
          )}
          {state === "guest" && (
            <Text style={styles.rankInfo} testID="guest-no-rank">
              {t("over.guest")}
            </Text>
          )}
          {state === "error" && (
            <Pressable onPress={() => doSubmit(displayScore)} testID="retry-submit">
              <Text style={styles.errorText}>{t("over.sendFailed")}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.actions}>
          {!doubled && !guest && (
            <Pressable testID="double-score-button" style={[styles.btn, styles.doubleBtn]} onPress={doubleScore}>
              <MaterialCommunityIcons name="star-four-points" size={20} color={colors.onWarning} />
              <Text style={[styles.btnText, { color: colors.onWarning }]}>
                {doubling ? "…" : t("over.double")}
              </Text>
            </Pressable>
          )}
          {canRevive && (
            <Pressable testID="revive-button" style={[styles.btn, styles.reviveBtn]} onPress={onRevive}>
              <MaterialCommunityIcons name="heart-plus" size={20} color={colors.onBrand} />
              <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("over.revive")}</Text>
            </Pressable>
          )}
          <Pressable testID="restart-button" style={[styles.btn, styles.restartBtn]} onPress={onRestart}>
            <MaterialCommunityIcons name="restart" size={20} color={colors.brand} />
            <Text style={[styles.btnText, { color: colors.brand }]}>{t("over.retry")}</Text>
          </Pressable>
          <Pressable testID="menu-button" style={[styles.btn, styles.menuBtn]} onPress={onExit}>
            <MaterialCommunityIcons name="home" size={20} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.menu")}</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.md, marginBottom: Math.max(insets.bottom, 8) }}>
          <AdBanner testID="gameover-ad" />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, big && { color: colors.brand, fontSize: 40 }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay, zIndex: 50 },
  content: { alignItems: "center", justifyContent: "center", flexGrow: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  dead: { color: colors.error, fontFamily: fonts.display, fontSize: 56, letterSpacing: 4, textShadowColor: colors.error, textShadowRadius: 18 },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md, alignItems: "flex-end" },
  stat: { alignItems: "center" },
  statValue: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 26 },
  statLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.displayMed, fontSize: 11, letterSpacing: 1.5, marginTop: -2 },
  creditsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  creditsText: { color: colors.warning, fontFamily: fonts.displaySemi, fontSize: 15, letterSpacing: 0.5 },
  rankBox: { marginTop: spacing.md, minHeight: 24 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankInfo: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 14 },
  rankNum: { color: colors.brand, fontFamily: fonts.display, fontSize: 16 },
  errorText: { color: colors.warning, fontFamily: fonts.textMed, fontSize: 14 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg, flexWrap: "wrap", justifyContent: "center" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  reviveBtn: { backgroundColor: colors.brand, borderColor: colors.brand },
  doubleBtn: { backgroundColor: colors.warning, borderColor: colors.warning },
  doubledTag: { color: colors.warning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, marginTop: spacing.sm },
  restartBtn: { backgroundColor: "transparent", borderColor: colors.brand },
  menuBtn: { backgroundColor: "transparent", borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
