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
import { LANGS, setLang, useLang, useT } from "@/src/i18n";

type Props = {
  onGuest: () => void;
  onSignedIn: (username: string, mode: AuthMode) => Promise<void>;
};

const COVER = require("../../assets/images/neon-cover.png");

// First launch: play as a guest (everything stays on the phone) or use an account.
export default function Welcome({ onGuest, onSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<AuthMode | null>(null);
  const t = useT();
  const lang = useLang();

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
      <View style={[styles.langs, { top: Math.max(insets.top, 12), left: Math.max(insets.left, 16) }]}>
        {LANGS.map((l) => (
          <Pressable key={l} onPress={() => setLang(l)} style={[styles.lang, lang === l && styles.langActive]} testID={`welcome-lang-${l}`}>
            <Text style={[styles.langText, lang === l && { color: colors.onBrand }]}>{l.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView
          contentContainerStyle={[styles.side, { paddingRight: Math.max(insets.right, 24), paddingTop: Math.max(insets.top, 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.kicker}>{t("welcome.kicker")}</Text>
            {form ? (
              <AuthForm initialMode={form} onDone={onSignedIn} onCancel={() => setForm(null)} />
            ) : (
              <>
                <Text style={styles.title}>{t("welcome.title")}</Text>
                <Choice
                  testID="welcome-register"
                  icon="account-plus"
                  title={t("auth.register")}
                  text={t("welcome.registerText")}
                  primary
                  disabled={!accountsAvailable}
                  onPress={() => setForm("register")}
                />
                <Choice
                  testID="welcome-login"
                  icon="login"
                  title={t("welcome.login")}
                  text={t("welcome.loginText")}
                  disabled={!accountsAvailable}
                  onPress={() => setForm("login")}
                />
                <Choice
                  testID="welcome-guest"
                  icon="incognito"
                  title={t("welcome.guest")}
                  text={t("welcome.guestText")}
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
  langs: { position: "absolute", zIndex: 5, flexDirection: "row", gap: 6 },
  lang: {
    height: 30,
    minWidth: 40,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(13,15,18,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  langActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
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
