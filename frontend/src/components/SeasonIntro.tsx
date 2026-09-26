import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { storage } from "@/src/utils/storage";
import { useT, type Key } from "@/src/i18n";

// Shown once at launch (and from the "?" of the season ranking): how seasons and rewards work.
export const SEASON_INTRO_KEY = "np_seen_seasons_v1";
export const markSeasonIntroSeen = () => storage.setItem(SEASON_INTRO_KEY, true);

type Props = { guest: boolean; onClose: () => void; onOpenBoard?: () => void };

const POINTS: { icon: string; color: string; text: Key; note?: Key }[] = [
  { icon: "calendar-refresh", color: colors.brandSecondary, text: "intro.monthly" },
  { icon: "gift", color: colors.warning, text: "intro.rewards" },
  { icon: "trophy", color: "#FFD700", text: "intro.champion" },
  { icon: "credit-card-outline", color: colors.skins, text: "intro.giftcards", note: "intro.giftcards.note" },
  { icon: "shield-check", color: colors.brand, text: "intro.fair" },
];

export default function SeasonIntro({ guest, onClose, onOpenBoard }: Props) {
  const t = useT();
  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="season-intro">
      <View style={styles.modal}>
        <View style={styles.head}>
          <MaterialCommunityIcons name="trophy-award" size={28} color={colors.warning} />
          <Text style={styles.title}>{t("intro.title")}</Text>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {POINTS.map((p) => (
            <View key={p.text} style={styles.point}>
              <MaterialCommunityIcons name={p.icon as any} size={20} color={p.color} style={styles.icon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, p.text === "intro.giftcards" && { color: colors.skins, fontFamily: fonts.display }]}>{t(p.text)}</Text>
                {p.note && <Text style={styles.note}>{t(p.note)}</Text>}
              </View>
            </View>
          ))}
          {guest && <Text style={styles.guest}>{t("intro.guest")}</Text>}
        </ScrollView>
        <View style={styles.actions}>
          {onOpenBoard && (
            <Pressable testID="season-intro-board" style={[styles.btn, styles.ghost]} onPress={onOpenBoard}>
              <Text style={[styles.btnText, { color: colors.warning }]}>{t("intro.board")}</Text>
            </Pressable>
          )}
          <Pressable testID="season-intro-close" style={[styles.btn, styles.primary]} onPress={onClose}>
            <Text style={[styles.btnText, { color: colors.onWarning }]}>{t("intro.go")}</Text>
          </Pressable>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 40, padding: spacing.md },
  modal: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "100%",
    backgroundColor: "rgba(13,15,18,0.95)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  title: { color: colors.warning, fontFamily: fonts.display, fontSize: 22, letterSpacing: 2 },
  scroll: { flexShrink: 1 },
  point: { flexDirection: "row", gap: 10, paddingVertical: 5 },
  icon: { marginTop: 1 },
  text: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 14, lineHeight: 19 },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 11, marginTop: 1 },
  guest: { color: colors.warning, fontFamily: fonts.textMed, fontSize: 13, textAlign: "center", marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  btn: { flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  primary: { backgroundColor: colors.warning, borderColor: colors.warning },
  ghost: { borderColor: colors.warning },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1.5 },
});
