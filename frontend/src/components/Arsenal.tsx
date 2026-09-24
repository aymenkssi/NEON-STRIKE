import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { UPGRADES, UPGRADE_MAX, upgradeCost, type UpgradeKey, type UpgradeLevels } from "../game/progression";
import Panel from "./Panel";

type Props = {
  credits: number;
  upgrades: UpgradeLevels;
  onBuy: (key: UpgradeKey) => boolean;
  onClose: () => void;
};

export default function Arsenal({ credits, upgrades, onBuy, onClose }: Props) {
  const buy = (key: UpgradeKey) => {
    const ok = onBuy(key);
    Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    ).catch(() => {});
  };

  return (
    <Panel title="ARSENAL" icon="store" credits={credits} onClose={onClose} testID="arsenal">
      <ScrollView horizontal={false} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {UPGRADES.map((u) => {
          const lvl = upgrades[u.key];
          const cost = upgradeCost(lvl);
          const maxed = cost === null;
          const affordable = !maxed && credits >= cost;
          return (
            <View key={u.key} style={styles.card} testID={`upgrade-${u.key}`}>
              <View style={styles.cardHead}>
                <MaterialCommunityIcons name={u.icon as any} size={24} color={colors.brandSecondary} />
                <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
              </View>
              <View style={styles.pips}>
                {Array.from({ length: UPGRADE_MAX }, (_, i) => (
                  <View key={i} style={[styles.pip, i < lvl && styles.pipOn]} />
                ))}
              </View>
              <Text style={styles.desc}>{lvl > 0 ? u.description(lvl) : "Aucun bonus"}</Text>
              <Text style={styles.next}>{maxed ? "Niveau max" : `Suivant : ${u.description(lvl + 1)}`}</Text>
              <Pressable
                testID={`buy-${u.key}`}
                disabled={!affordable}
                onPress={() => buy(u.key)}
                style={[styles.buyBtn, !affordable && styles.buyDisabled]}
              >
                {maxed ? (
                  <Text style={[styles.buyText, { color: colors.onSurfaceTertiary }]}>MAX</Text>
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="circle-multiple"
                      size={16}
                      color={affordable ? colors.onWarning : colors.onSurfaceTertiary}
                    />
                    <Text style={[styles.buyText, !affordable && { color: colors.onSurfaceTertiary }]}>{cost}</Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  card: {
    width: 168,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: 6,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 15, letterSpacing: 0.5, flexShrink: 1 },
  pips: { flexDirection: "row", gap: 4 },
  pip: { flex: 1, height: 6, borderRadius: 2, backgroundColor: colors.surfaceTertiary },
  pipOn: { backgroundColor: colors.brandSecondary },
  desc: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 13 },
  next: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, minHeight: 16 },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.warning,
    marginTop: 2,
  },
  buyDisabled: { backgroundColor: colors.surfaceTertiary },
  buyText: { color: colors.onWarning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
});
