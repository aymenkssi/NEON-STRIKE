import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { claimSeasonReward, type SeasonReward as Reward } from "../api/seasons";
import { formatNumber, useT, type Key } from "@/src/i18n";
import { SeasonBadge } from "./Leaderboard";

type Props = {
  reward: Reward;
  // Adds the credits (and the Champion skin) to the save once the server confirmed the claim.
  onClaimed: (credits: number, skin: string | null) => void;
  onClose: () => void;
};

// Shown at launch when a finished season left a reward for this player.
export default function SeasonReward({ reward, onClaimed, onClose }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const month = Number(reward.season.split("-")[1]);

  const claim = async () => {
    setBusy(true);
    setError(false);
    const r = await claimSeasonReward(reward.id);
    setBusy(false);
    if (!r) {
      setError(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClaimed(r.credits, r.skin);
    onClose();
  };

  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="season-reward">
      <View style={styles.modal}>
        <MaterialCommunityIcons name="trophy-award" size={46} color={colors.warning} />
        <Text style={styles.kicker}>{t("reward.over", { season: t(`season.m${month}` as Key) })}</Text>
        <View style={styles.rankRow}>
          <SeasonBadge rank={reward.badge ? reward.rank : null} size={26} />
          <Text style={styles.rank} testID="season-reward-rank">
            {reward.rank === 1 ? t("reward.rankFirst") : t("reward.rank", { rank: reward.rank })}
          </Text>
        </View>
        <View style={styles.list}>
          <View style={styles.item}>
            <MaterialCommunityIcons name="circle-multiple" size={20} color={colors.warning} />
            <Text style={[styles.itemText, { color: colors.warning }]}>{t("reward.credits", { n: formatNumber(reward.credits) })}</Text>
          </View>
          {reward.skin && (
            <View style={styles.item}>
              <MaterialCommunityIcons name="pistol" size={20} color={colors.skins} />
              <Text style={styles.itemText}>{t("reward.skin")}</Text>
            </View>
          )}
          {reward.badge && (
            <View style={styles.item}>
              <MaterialCommunityIcons name="trophy" size={20} color={colors.brandSecondary} />
              <Text style={styles.itemText}>{t("reward.badge")}</Text>
            </View>
          )}
        </View>
        {error && <Text style={styles.error}>{t("reward.error")}</Text>}
        <Pressable testID="season-reward-claim" style={styles.btn} onPress={claim} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onWarning} /> : <Text style={styles.btnText}>{t("reward.claim")}</Text>}
        </Pressable>
        {error && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.later}>{t("common.close")}</Text>
          </Pressable>
        )}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 40 },
  modal: {
    width: "56%",
    maxWidth: 440,
    backgroundColor: "rgba(13,15,18,0.94)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  kicker: { color: colors.warning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 2, textAlign: "center" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rank: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  list: { alignSelf: "stretch", gap: 6, marginVertical: spacing.xs },
  item: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  itemText: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 15 },
  error: { color: colors.error, fontFamily: fonts.textMed, fontSize: 12, textAlign: "center" },
  btn: { alignSelf: "stretch", height: 48, borderRadius: radius.md, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.onWarning, fontFamily: fonts.display, fontSize: 18, letterSpacing: 2 },
  later: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1 },
});
