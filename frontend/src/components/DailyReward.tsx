import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { DAILY_REWARDS, dailyStatus } from "../game/progression";
import Panel from "./Panel";

type Props = {
  credits: number;
  lastClaim: string;
  streak: number;
  onClaim: () => number;
  onClose: () => void;
};

export default function DailyReward({ credits, lastClaim, streak, onClaim, onClose }: Props) {
  const { canClaim, dayIndex } = dailyStatus(lastClaim, streak);
  const [claimed, setClaimed] = useState<number | null>(null);

  const claim = () => {
    const amount = onClaim();
    if (amount > 0) {
      setClaimed(amount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  return (
    <Panel title="RÉCOMPENSE DU JOUR" icon="gift" credits={credits} onClose={onClose} testID="daily-reward">
      <Text style={styles.hint}>Connecte-toi chaque jour pour augmenter ta récompense. Un jour manqué remet la série à zéro.</Text>
      <View style={styles.row}>
        {DAILY_REWARDS.map((amount, i) => {
          const done = claimed !== null ? i <= dayIndex : canClaim ? i < dayIndex : i <= dayIndex;
          const today = i === dayIndex;
          return (
            <View
              key={i}
              style={[styles.day, today && styles.dayToday, done && styles.dayDone, i === 6 && styles.dayBig]}
            >
              <Text style={[styles.dayLabel, today && { color: colors.brand }]}>JOUR {i + 1}</Text>
              <MaterialCommunityIcons
                name={done ? "check-circle" : i === 6 ? "treasure-chest" : "circle-multiple"}
                size={i === 6 ? 28 : 22}
                color={done ? colors.brand : colors.warning}
              />
              <Text style={styles.amount}>{amount}</Text>
            </View>
          );
        })}
      </View>
      {claimed !== null ? (
        <Text style={styles.claimed}>+{claimed} crédits récupérés !</Text>
      ) : canClaim ? (
        <Pressable testID="claim-daily" style={styles.claimBtn} onPress={claim}>
          <MaterialCommunityIcons name="gift-open" size={20} color={colors.onBrand} />
          <Text style={styles.claimText}>RÉCUPÉRER {DAILY_REWARDS[dayIndex]}</Text>
        </Pressable>
      ) : (
        <Text style={styles.wait}>Déjà récupéré aujourd’hui. Reviens demain !</Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  day: {
    width: 78,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    gap: 4,
  },
  dayBig: { width: 96, borderColor: "rgba(255,176,0,0.5)" },
  dayToday: { borderColor: colors.brand },
  dayDone: { opacity: 0.6 },
  dayLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 11, letterSpacing: 1 },
  amount: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16 },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  claimText: { color: colors.onBrand, fontFamily: fonts.display, fontSize: 17, letterSpacing: 1.5 },
  claimed: { color: colors.warning, fontFamily: fonts.display, fontSize: 20, textAlign: "center", marginTop: spacing.md },
  wait: { color: colors.onSurfaceSecondary, fontFamily: fonts.textMed, fontSize: 14, textAlign: "center", marginTop: spacing.md },
});
