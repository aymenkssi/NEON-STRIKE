import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { accountsAvailable } from "../api/account";
import AuthForm, { type AuthMode } from "./AuthForm";

type Props = {
  onGuest: () => void;
  onSignedIn: (username: string, mode: AuthMode) => Promise<void>;
};

const COVER = require("../../assets/images/neon-cover.png");

// First launch: play as a guest (everything stays on the phone) or use an account.
export default function Welcome({ onGuest, onSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<AuthMode | null>(null);

  return (
    <View style={styles.root} testID="welcome">
      <Image source={COVER} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(7,11,18,0.75)", "rgba(7,11,18,0.95)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        locations={[0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.side, { paddingRight: Math.max(insets.right, 24), paddingTop: Math.max(insets.top, 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.kicker}>BIENVENUE, SURVIVANT</Text>
            {form ? (
              <AuthForm initialMode={form} onDone={onSignedIn} onCancel={() => setForm(null)} />
            ) : (
              <>
                <Text style={styles.title}>Comment veux-tu jouer ?</Text>
                <Choice
                  testID="welcome-register"
                  icon="account-plus"
                  title="CRÉER UN COMPTE"
                  text="Nom unique, progression sauvegardée en ligne et place au classement mondial."
                  primary
                  disabled={!accountsAvailable}
                  onPress={() => setForm("register")}
                />
                <Choice
                  testID="welcome-login"
                  icon="login"
                  title="J’AI DÉJÀ UN COMPTE"
                  text="Retrouve ta progression sur ce téléphone."
                  disabled={!accountsAvailable}
                  onPress={() => setForm("login")}
                />
                <Choice
                  testID="welcome-guest"
                  icon="incognito"
                  title="JOUER EN INVITÉ"
                  text="Sans inscription : progression uniquement sur ce téléphone, pas de classement. Tu pourras créer un compte plus tard."
                  onPress={onGuest}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Choice(p: { icon: string; title: string; text: string; primary?: boolean; disabled?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled}
      style={[styles.choice, p.primary && styles.choicePrimary, p.disabled && { opacity: 0.4 }]}
      testID={p.testID}
    >
      <MaterialCommunityIcons name={p.icon as any} size={26} color={p.primary ? colors.onBrand : colors.brand} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceTitle, p.primary && { color: colors.onBrand }]}>{p.title}</Text>
        <Text style={[styles.choiceText, p.primary && { color: "rgba(0,0,0,0.7)" }]}>{p.text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  fill: { flex: 1 },
  side: { flexGrow: 1, alignItems: "flex-end", justifyContent: "center", paddingVertical: spacing.md, paddingLeft: spacing.md },
  card: {
    width: 400,
    maxWidth: "100%",
    backgroundColor: "rgba(13,15,18,0.9)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  kicker: { color: colors.brandSecondary, fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 3 },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, marginBottom: 2 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  choicePrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  choiceTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  choiceText: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 16 },
});
