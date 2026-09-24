import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { getRecoveryCode, recoverAccount } from "../api/cloud";
import type { CloudStatus } from "../hooks/use-progress";

type Props = {
  status: CloudStatus;
  // Called after a recovery code was accepted: reloads the online save on this phone.
  onRecovered: (name: string) => Promise<void>;
};

const STATUS: Record<CloudStatus, { text: string; icon: string; color: string }> = {
  off: { text: "Indisponible dans cette version", icon: "cloud-off-outline", color: colors.onSurfaceTertiary },
  syncing: { text: "Synchronisation…", icon: "cloud-sync-outline", color: colors.brandSecondary },
  synced: { text: "Progression sauvegardée en ligne", icon: "cloud-check-outline", color: colors.brand },
  offline: { text: "Hors connexion : sauvegarde à la prochaine connexion", icon: "cloud-alert", color: colors.warning },
};

export default function CloudSave({ status, onRecovered }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const st = STATUS[status];

  const showCode = async (forceNew = false) => {
    setBusy(true);
    setMessage(null);
    try {
      setCode(await getRecoveryCode(forceNew));
    } catch {
      setMessage({ ok: false, text: "Impossible d’obtenir le code : vérifie ta connexion." });
    }
    setBusy(false);
  };

  const restore = async () => {
    setBusy(true);
    setMessage(null);
    const r = await recoverAccount(entry);
    if ("name" in r) {
      await onRecovered(r.name);
      setMessage({ ok: true, text: `Progression de ${r.name} récupérée sur ce téléphone.` });
      setEntry("");
      setCode(null);
    } else {
      setMessage({
        ok: false,
        text:
          r.error === "unknown"
            ? "Code inconnu. Vérifie les 12 caractères."
            : r.error === "rate"
              ? "Trop d’essais. Réessaie dans 10 minutes."
              : "Connexion impossible. Réessaie plus tard.",
      });
    }
    setConfirming(false);
    setBusy(false);
  };

  if (status === "off") return null;

  return (
    <View style={styles.box} testID="cloud-save">
      <View style={styles.head}>
        <MaterialCommunityIcons name={st.icon as any} size={20} color={st.color} />
        <Text style={styles.title}>Sauvegarde en ligne</Text>
      </View>
      <Text style={[styles.status, { color: st.color }]}>{st.text}</Text>

      <Text style={styles.hint}>
        Ton code de récupération permet de retrouver ta progression sur un autre téléphone. Garde-le pour toi.
      </Text>
      {code ? (
        <View style={styles.codeRow}>
          <Text style={styles.code} selectable testID="recovery-code">
            {code}
          </Text>
          <Pressable onPress={() => showCode(true)} style={styles.linkBtn} disabled={busy} testID="new-code">
            <Text style={styles.link}>Nouveau code</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => showCode(false)} style={styles.btn} disabled={busy} testID="show-code">
          <MaterialCommunityIcons name="key-variant" size={16} color={colors.brand} />
          <Text style={styles.btnText}>AFFICHER MON CODE</Text>
        </Pressable>
      )}

      <Text style={[styles.hint, { marginTop: spacing.sm }]}>Récupérer une progression depuis un autre téléphone :</Text>
      <View style={styles.codeRow}>
        <TextInput
          testID="recovery-input"
          value={entry}
          onChangeText={(t) => {
            setEntry(t.toUpperCase());
            setConfirming(false);
          }}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={colors.onSurfaceTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          style={styles.input}
        />
        {!confirming ? (
          <Pressable
            onPress={() => setConfirming(true)}
            disabled={busy || entry.replace(/[^A-Z0-9]/g, "").length < 12}
            style={[styles.btn, entry.replace(/[^A-Z0-9]/g, "").length < 12 && { opacity: 0.4 }]}
            testID="recover-button"
          >
            <Text style={styles.btnText}>RÉCUPÉRER</Text>
          </Pressable>
        ) : (
          <Pressable onPress={restore} disabled={busy} style={[styles.btn, styles.danger]} testID="recover-confirm">
            <Text style={[styles.btnText, { color: colors.onWarning }]}>CONFIRMER</Text>
          </Pressable>
        )}
      </View>
      {confirming && (
        <Text style={[styles.hint, { color: colors.warning }]}>
          La progression actuelle de ce téléphone sera remplacée. Appuie sur CONFIRMER pour continuer.
        </Text>
      )}
      {busy && <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xs }} />}
      {message && (
        <Text style={[styles.hint, { color: message.ok ? colors.brand : colors.error }]} testID="cloud-message">
          {message.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  status: { fontFamily: fonts.textMed, fontSize: 13 },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  code: {
    flex: 1,
    color: colors.brand,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 3,
    fontVariant: ["tabular-nums"],
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    paddingHorizontal: spacing.sm,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  danger: { backgroundColor: colors.warning, borderColor: colors.warning },
  btnText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
  linkBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  link: { color: colors.brandSecondary, fontFamily: fonts.textMed, fontSize: 13, textDecorationLine: "underline" },
});
