import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import type { RemoteMessage } from "../api/config";

const KIND = {
  info: { icon: "information", color: colors.brandSecondary, label: "INFO" },
  promo: { icon: "sale", color: colors.warning, label: "PROMO" },
  warning: { icon: "alert", color: colors.error, label: "ALERTE" },
} as const;

type Props = { message: RemoteMessage; onClose: () => void; onOpenShop?: () => void };

// A message published from the admin page, shown once to each player.
export default function PlayerMessage({ message, onClose, onOpenShop }: Props) {
  const kind = KIND[message.kind] ?? KIND.info;
  return (
    <BlurView intensity={50} tint="dark" style={styles.overlay} testID="player-message">
      <View style={[styles.card, { borderColor: kind.color }]}>
        <View style={styles.head}>
          <MaterialCommunityIcons name={kind.icon} size={22} color={kind.color} />
          <Text style={[styles.kind, { color: kind.color }]}>{kind.label}</Text>
        </View>
        <Text style={styles.title}>{message.title}</Text>
        <ScrollView style={styles.bodyWrap}>
          <Text style={styles.body}>{message.body}</Text>
        </ScrollView>
        <View style={styles.actions}>
          {message.kind === "promo" && onOpenShop && (
            <Pressable
              testID="message-shop"
              style={[styles.btn, { backgroundColor: colors.warning, borderColor: colors.warning }]}
              onPress={() => {
                onClose();
                onOpenShop();
              }}
            >
              <MaterialCommunityIcons name="cart" size={18} color={colors.onWarning} />
              <Text style={[styles.btnText, { color: colors.onWarning }]}>BOUTIQUE</Text>
            </Pressable>
          )}
          <Pressable testID="message-close" style={[styles.btn, styles.okBtn]} onPress={onClose}>
            <Text style={[styles.btnText, { color: colors.onBrand }]}>OK</Text>
          </Pressable>
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 35, padding: spacing.md },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "100%",
    backgroundColor: "rgba(13,15,18,0.94)",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kind: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2 },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 24, letterSpacing: 1 },
  bodyWrap: { maxHeight: 160 },
  body: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 16, lineHeight: 22 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 2 },
  okBtn: { backgroundColor: colors.brand, borderColor: colors.brand },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
