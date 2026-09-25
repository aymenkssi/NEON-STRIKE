import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { accountsAvailable, deleteAccount, PASSWORD_MIN } from "../api/account";
import type { AccountState } from "../hooks/use-account";
import type { CloudStatus } from "../hooks/use-progress";
import AuthForm, { type AuthMode } from "./AuthForm";
import SuggestionForm from "./SuggestionForm";
import { useT, type Key } from "@/src/i18n";

type Props = {
  account: AccountState;
  cloudStatus: CloudStatus;
  onSignedIn: (username: string, mode: AuthMode) => Promise<void>;
  onLogout: () => Promise<void>;
  onDeleted: () => Promise<void>;
};

const SYNC: Record<CloudStatus, { text: Key; icon: string; color: string }> = {
  off: { text: "account.sync.off", icon: "cloud-off-outline", color: colors.onSurfaceTertiary },
  syncing: { text: "account.sync.syncing", icon: "cloud-sync-outline", color: colors.brandSecondary },
  synced: { text: "account.sync.synced", icon: "cloud-check-outline", color: colors.brand },
  offline: { text: "account.sync.offline", icon: "cloud-alert", color: colors.warning },
};

export default function AccountSection({ account, cloudStatus, onSignedIn, onLogout, onDeleted }: Props) {
  const [form, setForm] = useState<AuthMode | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<Key | null>(null);
  const t = useT();

  if (account.mode === "account") {
    const sync = SYNC[cloudStatus];
    return (
      <View style={styles.box} testID="account-section">
        <View style={styles.head}>
          <MaterialCommunityIcons name="account-check" size={20} color={colors.brand} />
          <Text style={styles.title}>{t("account.title")}</Text>
        </View>
        <Text style={styles.name} testID="account-name">
          {account.username}
        </Text>
        <View style={styles.row}>
          <MaterialCommunityIcons name={sync.icon as any} size={16} color={sync.color} />
          <Text style={[styles.hint, { color: sync.color }]}>{t(sync.text)}</Text>
        </View>
        {!confirmLogout ? (
          <Pressable onPress={() => setConfirmLogout(true)} style={styles.btn} testID="logout">
            <MaterialCommunityIcons name="logout" size={16} color={colors.onSurfaceSecondary} />
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("account.logout")}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.warning }]}>
              {t("account.logoutWarning")}
            </Text>
            <View style={styles.row}>
              <Pressable onPress={() => setConfirmLogout(false)} style={styles.btn}>
                <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.cancel")}</Text>
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
                {busy ? <ActivityIndicator color={colors.onWarning} /> : <Text style={[styles.btnText, { color: colors.onWarning }]}>{t("common.confirm")}</Text>}
              </Pressable>
            </View>
          </>
        )}
        <View style={styles.divider} />
        <View style={styles.head}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.warning} />
          <Text style={styles.title}>{t("suggest.title")}</Text>
        </View>
        {suggesting ? (
          <SuggestionForm onClose={() => setSuggesting(false)} />
        ) : (
          <>
            <Text style={styles.hint}>{t("suggest.hint")}</Text>
            <Pressable onPress={() => setSuggesting(true)} style={[styles.btn, styles.primary]} testID="open-suggestion">
              <MaterialCommunityIcons name="send" size={16} color={colors.onBrand} />
              <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("suggest.open")}</Text>
            </Pressable>
          </>
        )}
        <View style={styles.divider} />
        {!deleting ? (
          <Pressable onPress={() => setDeleting(true)} style={[styles.btn, styles.danger]} testID="delete-account">
            <MaterialCommunityIcons name="account-remove" size={16} color={colors.error} />
            <Text style={[styles.btnText, { color: colors.error }]}>{t("account.delete")}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.error }]}>{t("account.deleteWarning")}</Text>
            <TextInput
              testID="delete-password"
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.password", { n: PASSWORD_MIN })}
              placeholderTextColor={colors.onSurfaceTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              maxLength={72}
              style={styles.input}
            />
            {deleteError && <Text style={[styles.hint, { color: colors.error }]} testID="delete-error">{t(deleteError)}</Text>}
            <View style={styles.row}>
              <Pressable
                onPress={() => {
                  setDeleting(false);
                  setPassword("");
                  setDeleteError(null);
                }}
                style={styles.btn}
              >
                <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                disabled={busy || !password}
                onPress={async () => {
                  setBusy(true);
                  setDeleteError(null);
                  const r = await deleteAccount(password);
                  if (r === "deleted") {
                    await onDeleted();
                    return;
                  }
                  setBusy(false);
                  setDeleteError(r === "credentials" ? "account.err.password" : r === "rate" ? "auth.err.rate" : "auth.err.network");
                }}
                style={[styles.btn, styles.dangerFill, (busy || !password) && { opacity: 0.5 }]}
                testID="delete-confirm"
              >
                {busy ? <ActivityIndicator color={colors.onSurface} /> : <Text style={[styles.btnText, { color: colors.onSurface }]}>{t("account.deleteConfirm")}</Text>}
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
        <Text style={styles.title}>{t("account.guestTitle")}</Text>
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
            {t("account.guestText")} {t("suggest.guest")}
          </Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setForm("register")}
              disabled={!accountsAvailable}
              style={[styles.btn, styles.primary, !accountsAvailable && { opacity: 0.4 }]}
              testID="guest-register"
            >
              <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("auth.register")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setForm("login")}
              disabled={!accountsAvailable}
              style={[styles.btn, !accountsAvailable && { opacity: 0.4 }]}
              testID="guest-login"
            >
              <Text style={styles.btnText}>{t("auth.login")}</Text>
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
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  warn: { backgroundColor: colors.warning, borderColor: colors.warning },
  danger: { borderColor: colors.error, alignSelf: "flex-start" },
  dangerFill: { backgroundColor: colors.error, borderColor: colors.error },
  input: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(13,15,18,0.85)",
    color: colors.onSurface,
    fontFamily: fonts.displaySemi,
    fontSize: 16,
  },
  btnText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
});
