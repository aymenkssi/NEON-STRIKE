import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, spacing, radius } from "../theme";
import { sendSuggestion, type SuggestionCategory, type SuggestionResult } from "../api/suggestions";
import { useT, type Key } from "@/src/i18n";

const MAX = 1000;
const CATEGORIES: { key: SuggestionCategory; label: Key; icon: string }[] = [
  { key: "idea", label: "suggest.idea", icon: "lightbulb-on-outline" },
  { key: "bug", label: "suggest.bug", icon: "bug-outline" },
  { key: "other", label: "suggest.other", icon: "message-outline" },
];
const ERRORS: Record<Exclude<SuggestionResult, "sent">, Key> = {
  limit: "suggest.err.limit",
  invalid: "suggest.err.invalid",
  account: "suggest.err.account",
  network: "auth.err.network",
};

// Signed-in players send an idea or a bug report; it shows up in the admin page.
export default function SuggestionForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [category, setCategory] = useState<SuggestionCategory>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const canSend = !busy && message.trim().length >= 5;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    const r = await sendSuggestion(category, message);
    setBusy(false);
    setResult(r);
    if (r === "sent") setMessage("");
  };

  if (result === "sent") {
    return (
      <View style={styles.wrap} testID="suggestion-sent">
        <View style={styles.row}>
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.brand} />
          <Text style={[styles.text, { color: colors.brand, flex: 1 }]}>{t("suggest.thanks")}</Text>
        </View>
        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={() => setResult(null)} testID="suggestion-another">
            <Text style={styles.btnText}>{t("suggest.another")}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghost]} onPress={onClose}>
            <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.close")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="suggestion-form">
      <View style={styles.row}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setCategory(c.key)}
            style={[styles.chip, category === c.key && styles.chipActive]}
            testID={`suggestion-cat-${c.key}`}
          >
            <MaterialCommunityIcons name={c.icon as any} size={15} color={category === c.key ? colors.onBrand : colors.onSurfaceSecondary} />
            <Text style={[styles.chipText, category === c.key && { color: colors.onBrand }]}>{t(c.label)}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="suggestion-text"
        value={message}
        onChangeText={(v) => {
          setMessage(v.slice(0, MAX));
          if (result) setResult(null);
        }}
        placeholder={t("suggest.placeholder")}
        placeholderTextColor={colors.onSurfaceTertiary}
        multiline
        maxLength={MAX}
        style={styles.input}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>
        {message.length}/{MAX}
      </Text>
      {result && (
        <Text style={[styles.text, { color: colors.error }]} testID="suggestion-error">
          {t(ERRORS[result])}
        </Text>
      )}
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.ghost]} onPress={onClose}>
          <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("common.cancel")}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.primary, !canSend && { opacity: 0.4 }]}
          disabled={!canSend}
          onPress={submit}
          testID="suggestion-send"
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <>
              <MaterialCommunityIcons name="send" size={16} color={colors.onBrand} />
              <Text style={[styles.btnText, { color: colors.onBrand }]}>{t("suggest.send")}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 0.5 },
  input: {
    minHeight: 90,
    maxHeight: 160,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(13,15,18,0.85)",
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 14,
    padding: spacing.sm,
  },
  counter: { color: colors.onSurfaceTertiary, fontFamily: fonts.text, fontSize: 11, alignSelf: "flex-end", marginTop: -4 },
  text: { fontFamily: fonts.textMed, fontSize: 13, lineHeight: 18 },
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
  ghost: { borderColor: colors.border },
  btnText: { color: colors.brand, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
});
