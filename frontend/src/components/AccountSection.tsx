import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { accountsAvailable } from "../api/account";
import type { AccountState } from "../hooks/use-account";
import type { CloudStatus } from "../hooks/use-progress";
import AuthForm, { type AuthMode } from "./AuthForm";

type Props = {
  account: AccountState;
  cloudStatus: CloudStatus;
  onSignedIn: (username: string, mode: AuthMode) => Promise<void>;
  onLogout: () => Promise<void>;
};

const SYNC: Record<CloudStatus, { text: string; icon: string; color: string }> = {
  off: { text: "Sauvegarde en ligne indisponible", icon: "cloud-off-outline", color: colors.onSurfaceTertiary },
  syncing: { text: "Synchronisation…", icon: "cloud-sync-outline", color: colors.brandSecondary },
  synced: { text: "Progression sauvegardée en ligne", icon: "cloud-check-outline", color: colors.brand },
  offline: { text: "Hors connexion : sauvegarde à la prochaine connexion", icon: "cloud-alert", color: colors.warning },
};

export default function AccountSection({ account, cloudStatus, onSignedIn, onLogout }: Props) {
  const [form, setForm] = useState<AuthMode | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);

  if (account.mode === "account") {
    const sync = SYNC[cloudStatus];
    return (
      <View style={styles.box} testID="account-section">
        <View style={styles.head}>
          <MaterialCommunityIcons name="account-check" size={20} color={colors.brand} />
          <Text style={styles.title}>Compte</Text>
        </View>
        <Text style={styles.name} testID="account-name">
          {account.username}
        </Text>
        <View style={styles.row}>
          <MaterialCommunityIcons name={sync.icon as any} size={16} color={sync.color} />
          <Text style={[styles.hint, { color: sync.color }]}>{sync.text}</Text>
        </View>
        {!confirmLogout ? (
          <Pressable onPress={() => setConfirmLogout(true)} style={styles.btn} testID="logout">
            <MaterialCommunityIcons name="logout" size={16} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>SE DÉCONNECTER</Text>
          </Pressable>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.warning }]}>
              Ta progression reste sauvegardée sur ton compte. Ce téléphone repartira de zéro jusqu’à ta prochaine connexion.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={() => setConfirmLogout(false)} style={styles.btn}>
                <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>ANNULER</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setBusy(true);
                  await onLogout();
                  setBusy(false);
                }}
                style={[styles.btn, styles.warn]}
                testID="logout-confirm"
              >
                {busy ? <ActivityIndicator color={colors.onWarning} /> : <Text style={[styles.btnText, { color: colors.onWarning }]}>CONFIRMER</Text>}
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.box} testID="account-section">
      <View style={styles.head}>
        <MaterialCommunityIcons name="incognito" size={20} color={colors.brandSecondary} />
        <Text style={styles.title}>Mode invité</Text>
      </View>
      {form ? (
        <AuthForm
          initialMode={form}
          onDone={async (u, m) => {
            await onSignedIn(u, m);
            setForm(null);
          }}
          onCancel={() => setForm(null)}
        />
      ) : (
        <>
          <Text style={styles.hint}>
            Ta progression est enregistrée uniquement sur ce téléphone et tes scores ne vont pas au classement. Crée un compte pour
            les sauvegarder en ligne : tu gardes tout ce que tu as déjà gagné.
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setForm("register")}
              disabled={!accountsAvailable}
              style={[styles.btn, styles.primary, !accountsAvailable && { opacity: 0.4 }]}
              testID="guest-register"
            >
              <Text style={[styles.btnText, { color: colors.onBrand }]}>CRÉER UN COMPTE</Text>
            </Pressable>
            <Pressable
              onPress={() => setForm("login")}
              disabled={!accountsAvailable}
              style={[styles.btn, !accountsAvailable && { opacity: 0.4 }]}
              testID="guest-login"
            >
              <Text style={styles.btnText}>SE CONNECTER</Text>
            </Pressable>
          </View>
        </>
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
    gap: 8,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  name: { color: colors.brand, fontFamily: fonts.display, fontSize: 24, letterSpacing: 1.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, lineHeight: 16, flexShrink: 1 },
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
  primary: { backgroundColor: colors.brand },
  warn: { backgroundColor: colors.warning, borderColor: colors.warning },
  btnText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
});
