import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme";

export default function CreditBadge({ amount, testID }: { amount: number; testID?: string }) {
  return (
    <View style={styles.badge} testID={testID}>
      <MaterialCommunityIcons name="circle-multiple" size={16} color={colors.warning} />
      <Text style={styles.text}>{amount.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,176,0,0.45)",
    backgroundColor: "rgba(13,15,18,0.85)",
  },
  text: { color: colors.warning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, fontVariant: ["tabular-nums"] },
});
