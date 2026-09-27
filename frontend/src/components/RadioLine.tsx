import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme";
import type { Line, Speaker } from "../game/story";
import { useT, type Key } from "@/src/i18n";

// A story line heard on the radio during a level (top-left, under the health bar).
const LOOK: Record<Speaker, { icon: string; color: string }> = {
  narrator: { icon: "book-open-variant", color: colors.warning },
  max: { icon: "account", color: "#7aa7ff" },
  radio: { icon: "radio-handheld", color: colors.brand },
  rex: { icon: "radio-handheld", color: "#b5d97a" },
  guardian: { icon: "shield-alert", color: "#00ffff" },
};

export default function RadioLine({ line }: { line: Line }) {
  const t = useT();
  const look = LOOK[line.who];
  return (
    <View style={styles.wrap} pointerEvents="none" testID="radio-line">
      <View style={[styles.avatar, { borderColor: look.color }]}>
        <MaterialCommunityIcons name={look.icon as any} size={20} color={look.color} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.who, { color: look.color }]}>{t(`story.who.${line.who}` as Key)}</Text>
        <Text style={styles.text}>{t(line.text)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 96,
    left: 16,
    maxWidth: 380,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10,12,16,0.82)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  body: { flexShrink: 1 },
  who: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.5 },
  text: { color: colors.onSurface, fontFamily: fonts.textMed, fontSize: 13, lineHeight: 17 },
});
