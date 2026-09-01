import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { submitScore } from "../api/leaderboard";
import AdBanner from "../ads/AdBanner";

type Props = {
  username: string;
  result: { score: number; wave: number; kills: number };
  canRevive: boolean;
  onRevive: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export default function GameOver({ username, result, canRevive, onRevive, onRestart, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<"submitting" | "done" | "error">("submitting");
  const [rank, setRank] = useState<number | null>(null);
  const [isHigh, setIsHigh] = useState(false);

  const doSubmit = async () => {
    setState("submitting");
    try {
      const res = await submitScore({
        name: username,
        score: result.score,
        wave: result.wave,
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
    doSubmit();
  }, []);

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} testID="game-over-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.dead}>YOU DIED</Text>

        <View style={styles.statsRow}>
          <Stat label="SCORE" value={result.score.toLocaleString()} big />
          <Stat label="WAVE" value={String(result.wave)} />
          <Stat label="KILLS" value={String(result.kills)} />
        </View>

        <View style={styles.rankBox}>
          {state === "submitting" && (
            <View style={styles.rankRow}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.rankInfo}>Envoi du score…</Text>
            </View>
          )}
          {state === "done" && (
            <Text style={styles.rankInfo}>
              {isHigh ? "🏆 NOUVEAU RECORD !  " : ""}
              Classement mondial : <Text style={styles.rankNum}>#{rank}</Text>
            </Text>
          )}
          {state === "error" && (
            <Pressable onPress={doSubmit} testID="retry-submit">
              <Text style={styles.errorText}>Échec de l’envoi. Réessayer</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.actions}>
          {canRevive && (
            <Pressable testID="revive-button" style={[styles.btn, styles.reviveBtn]} onPress={onRevive}>
              <MaterialCommunityIcons name="heart-plus" size={20} color={colors.onBrand} />
              <Text style={[styles.btnText, { color: colors.onBrand }]}>REVIVRE (PUB)</Text>
            </Pressable>
          )}
          <Pressable testID="restart-button" style={[styles.btn, styles.restartBtn]} onPress={onRestart}>
            <MaterialCommunityIcons name="restart" size={20} color={colors.brand} />
            <Text style={[styles.btnText, { color: colors.brand }]}>REJOUER</Text>
          </Pressable>
          <Pressable testID="menu-button" style={[styles.btn, styles.menuBtn]} onPress={onExit}>
            <MaterialCommunityIcons name="home" size={20} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>MENU</Text>
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
  restartBtn: { backgroundColor: "transparent", borderColor: colors.brand },
  menuBtn: { backgroundColor: "transparent", borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
