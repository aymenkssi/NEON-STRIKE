import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme";

// With onPress the badge shows a "+" and opens the coin shop.
export default function CreditBadge({ amount, testID, onPress }: { amount: number; testID?: string; onPress?: () => void }) {
  const content = (
    <>
      <MaterialCommunityIcons name="circle-multiple" size={16} color={colors.warning} />
      <Text style={styles.text}>{amount.toLocaleString()}</Text>
      {onPress && (
        <View style={styles.plus}>
          <MaterialCommunityIcons name="plus" size={14} color={colors.onWarning} />
        </View>
      )}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={styles.badge} testID={testID} onPress={onPress} hitSlop={6}>
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.badge} testID={testID}>
      {content}
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
  plus: { width: 18, height: 18, borderRadius: 4, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center" },
  text: { color: colors.warning, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, fontVariant: ["tabular-nums"] },
});
