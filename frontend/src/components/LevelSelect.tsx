import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { MAX_LEVEL, WEAPON_UNLOCK_LEVEL } from "../game/progression";
import Panel from "./Panel";

type Props = {
  unlockedLevel: number;
  stars: Record<string, number>;
  credits: number;
  onSelect: (level: number) => void;
  onClose: () => void;
};

const WEAPON_AT = Object.fromEntries(Object.entries(WEAPON_UNLOCK_LEVEL).map(([k, v]) => [v, k]));

export default function LevelSelect({ unlockedLevel, stars, credits, onSelect, onClose }: Props) {
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

  const pick = (level: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelect(level);
  };

  return (
    <Panel title="CAMPAGNE" icon="map-marker-path" credits={credits} onClose={onClose} testID="level-select">
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Niveau {unlockedLevel}/{MAX_LEVEL} débloqué
        </Text>
        <View style={styles.summaryStars}>
          <MaterialCommunityIcons name="star" size={16} color={colors.warning} />
          <Text style={styles.summaryText}>
            {totalStars}/{MAX_LEVEL * 3}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {levels.map((lvl) => {
          const locked = lvl > unlockedLevel;
          const current = lvl === unlockedLevel;
          const s = stars[lvl] || 0;
          return (
            <Pressable
              key={lvl}
              testID={`level-${lvl}`}
              disabled={locked}
              onPress={() => pick(lvl)}
              style={[styles.tile, current && styles.tileCurrent, locked && styles.tileLocked]}
            >
              {locked ? (
                <MaterialCommunityIcons name="lock" size={20} color={colors.onSurfaceTertiary} />
              ) : (
                <Text style={[styles.num, current && { color: colors.brand }]}>{lvl}</Text>
              )}
              <View style={styles.tileStars}>
                {[1, 2, 3].map((i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i <= s ? "star" : "star-outline"}
                    size={11}
                    color={i <= s ? colors.warning : colors.onSurfaceTertiary}
                  />
                ))}
              </View>
              {WEAPON_AT[lvl] && lvl > 1 && (
                <MaterialCommunityIcons name="pistol" size={12} color={colors.brandSecondary} style={styles.weaponMark} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </Panel>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  summaryStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", paddingBottom: spacing.sm },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tileCurrent: { borderColor: colors.brand, backgroundColor: "rgba(57,255,20,0.08)" },
  tileLocked: { opacity: 0.45 },
  num: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, lineHeight: 24 },
  tileStars: { flexDirection: "row", gap: 1 },
  weaponMark: { position: "absolute", top: 4, right: 4 },
});
