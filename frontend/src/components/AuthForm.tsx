import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { AUTH_ERRORS, PASSWORD_MIN, USERNAME_RE, checkUsername, loginAccount, registerAccount } from "../api/account";

export type AuthMode = "register" | "login";

type Props = {
  initialMode: AuthMode;
  onDone: (username: string, mode: AuthMode) => void | Promise<void>;
  onCancel?: () => void;
};

type Availability = "idle" | "checking" | "ok" | "taken" | "invalid" | "unknown";

export default function AuthForm({ initialMode, onDone, onCancel }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");

  // Live "name available?" check while typing a new account name.
  useEffect(() => {
    if (mode !== "register" || !username) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(async () => setAvailability(await checkUsername(username)), 400);
    return () => clearTimeout(t);
  }, [username, mode]);

  const canSubmit =
    !busy && USERNAME_RE.test(username) && password.length >= PASSWORD_MIN && !(mode === "register" && availability === "taken");

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const r = mode === "register" ? await registerAccount(username, password) : await loginAccount(username, password);
    if ("username" in r) {
      await onDone(r.username, mode);
    } else {
      setError(AUTH_ERRORS[r.error]);
      if (r.error === "taken") setAvailability("taken");
    }
    setBusy(false);
  };

  const hint: Record<Availability, { text: string; color: string } | null> = {
    idle: null,
    checking: { text: "Vérification…", color: colors.onSurfaceSecondary },
    ok: { text: "Nom disponible", color: colors.brand },
    taken: { text: "Nom déjà pris", color: colors.error },
    invalid: { text: "3 à 16 lettres, chiffres ou _", color: colors.warning },
    unknown: null,
  };
  const h = hint[availability];

  return (
    <View style={styles.wrap} testID="auth-form">
      <View style={styles.tabs}>
        {(["register", "login"] as AuthMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setError(null);
            }}
            style={[styles.tab, mode === m && styles.tabActive]}
            testID={`auth-tab-${m}`}
          >
            <Text style={[styles.tabText, mode === m && { color: colors.onBrand }]}>{m === "register" ? "CRÉER UN COMPTE" : "SE CONNECTER"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.field}>
        <MaterialCommunityIcons name="account" size={18} color={colors.onSurfaceSecondary} />
        <TextInput
          testID="auth-username"
          value={username}
          onChangeText={(t) => setUsername(t.replace(/\s/g, "").slice(0, 16))}
          placeholder="Nom d’utilisateur"
          placeholderTextColor={colors.onSurfaceTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={16}
          style={styles.input}
        />
        {availability === "checking" && <ActivityIndicator size="small" color={colors.brandSecondary} />}
        {availability === "ok" && <MaterialCommunityIcons name="check-circle" size={18} color={colors.brand} />}
        {availability === "taken" && <MaterialCommunityIcons name="close-circle" size={18} color={colors.error} />}
      </View>
      {mode === "register" && h && <Text style={[styles.hint, { color: h.color }]} testID="auth-availability">{h.text}</Text>}

      <View style={styles.field}>
        <MaterialCommunityIcons name="lock" size={18} color={colors.onSurfaceSecondary} />
        <TextInput
          testID="auth-password"
          value={password}
          onChangeText={setPassword}
          placeholder={`Mot de passe (${PASSWORD_MIN} caractères min.)`}
          placeholderTextColor={colors.onSurfaceTertiary}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          maxLength={72}
          style={styles.input}
          onSubmitEditing={submit}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} testID="auth-toggle-password">
          <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={18} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {error && (
        <Text style={[styles.hint, { color: colors.error }]} testID="auth-error">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        {onCancel && (
          <Pressable onPress={onCancel} style={[styles.btn, styles.ghost]} testID="auth-cancel">
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>RETOUR</Text>
          </Pressable>
        )}
        <Pressable onPress={submit} disabled={!canSubmit} style={[styles.btn, styles.primary, !canSubmit && { opacity: 0.4 }]} testID="auth-submit">
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={[styles.btnText, { color: colors.onBrand }]}>{mode === "register" ? "CRÉER MON COMPTE" : "CONNEXION"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    flex: 1,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(13,15,18,0.85)",
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.displaySemi, fontSize: 16, letterSpacing: 0.5, paddingVertical: 0 },
  hint: { fontFamily: fonts.textMed, fontSize: 12, marginTop: -4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  btn: { flex: 1, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  primary: { backgroundColor: colors.brand, borderColor: colors.brand },
  ghost: { flex: 0, paddingHorizontal: spacing.lg, borderColor: colors.border },
  btnText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 1 },
});
