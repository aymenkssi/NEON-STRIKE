import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import CreditBadge from "./CreditBadge";

type Props = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  credits?: number;
  onCreditsPress?: () => void;
  onClose: () => void;
  testID?: string;
  children: React.ReactNode;
};

// Shared modal shell for the menu overlays (levels, arsenal, daily reward).
export default function Panel({ title, icon, credits, onCreditsPress, onClose, testID, children }: Props) {
  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID={testID}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name={icon} size={22} color={colors.brand} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.titleRow}>
            {credits !== undefined && <CreditBadge amount={credits} onPress={onCreditsPress} />}
            <Pressable testID={testID ? `${testID}-close` : undefined} onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
        </View>
        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 30, padding: spacing.md },
  modal: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "100%",
    backgroundColor: "rgba(13,15,18,0.92)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
