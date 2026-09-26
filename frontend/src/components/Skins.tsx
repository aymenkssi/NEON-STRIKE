import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import { colors, fonts, spacing, radius } from "../theme";
import { buildWeaponModel } from "../game/weapons";
import { OUTFITS, WEAPON_SKINS, isExclusive, ownsSkin, type SkinState } from "../game/skins";
import { formatNumber, useT, type Key } from "@/src/i18n";
import Panel from "./Panel";

type Props = {
  credits: number;
  skins: SkinState;
  onBuy: (id: string) => boolean;
  onEquip: (id: string) => void;
  onOpenShop: () => void;
  onClose: () => void;
};

type Tab = "weapons" | "outfits";
const PREVIEW_WEAPONS = ["rifle", "shotgun", "smg", "railgun", "minigun", "launcher"];
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

// Rotating 3D view of a weapon held in the gloved hand, with the previewed skin and outfit.
function SkinPreview({ weaponSkin, outfit, weapon }: { weaponSkin: string; outfit: string; weapon: string }) {
  const holder = useRef<THREE.Group | null>(null);
  const raf = useRef<any>(null);
  const current = useRef({ weaponSkin, outfit, weapon });
  current.current = { weaponSkin, outfit, weapon };

  const show = () => {
    const h = holder.current;
    if (!h) return;
    h.clear();
    const { weaponSkin: s, outfit: o, weapon: w } = current.current;
    const model = buildWeaponModel(w, s, o);
    model.position.set(0, 0.06, 0.24); // turn around the middle of the weapon
    h.add(model);
  };
  useEffect(show, [weaponSkin, outfit, weapon]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(0x14171d, 1);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 3, 2);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 20);
    camera.position.set(0, 0.22, 1.55);
    camera.lookAt(0, -0.03, 0);
    const g = new THREE.Group();
    scene.add(g);
    holder.current = g;
    show();
    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      g.rotation.y += 0.012;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    loop();
  };

  return <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />;
}

export default function Skins({ credits, skins, onBuy, onEquip, onOpenShop, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("weapons");
  const [selected, setSelected] = useState<string>(skins.weapon);
  const [weapon, setWeapon] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const items = tab === "weapons" ? WEAPON_SKINS : OUTFITS;
  const item = [...WEAPON_SKINS, ...OUTFITS].find((i) => i.id === selected) ?? WEAPON_SKINS[0];
  const isWeaponSkin = WEAPON_SKINS.some((w) => w.id === item.id);
  const owned = ownsSkin(skins, item.id);
  const equipped = skins.weapon === item.id || skins.outfit === item.id;
  const reward = !owned && isExclusive(item.id); // season reward: cannot be bought

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelected(next === "weapons" ? skins.weapon : skins.outfit);
    setNotice(null);
  };

  const act = () => {
    if (equipped || reward) return;
    if (owned) {
      onEquip(item.id);
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (onBuy(item.id)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNotice({ ok: true, text: t("skins.bought", { name: t(item.name) }) });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setNotice({ ok: false, text: t("skins.poor") });
    }
  };

  return (
    <Panel title={t("skins.title")} icon="tshirt-crew" credits={credits} onCreditsPress={onOpenShop} onClose={onClose} testID="skins">
      <View style={styles.body}>
        <View style={styles.left}>
          <Pressable style={styles.preview} onPress={() => setWeapon((w) => (w + 1) % PREVIEW_WEAPONS.length)} testID="skin-preview">
            <SkinPreview
              weapon={PREVIEW_WEAPONS[weapon]}
              weaponSkin={isWeaponSkin ? item.id : skins.weapon}
              outfit={isWeaponSkin ? skins.outfit : item.id}
            />
            <View style={styles.cycle} pointerEvents="none">
              <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.onSurfaceSecondary} />
              <Text style={styles.cycleText}>{t(`weapon.${PREVIEW_WEAPONS[weapon]}` as Key)}</Text>
            </View>
          </Pressable>
          <Text style={styles.itemName} testID="skin-name">{t(item.name)}</Text>
          <Pressable
            testID="skin-action"
            onPress={act}
            disabled={equipped || reward}
            style={[styles.action, equipped ? styles.actionDone : reward ? styles.actionReward : owned ? styles.actionEquip : styles.actionBuy]}
          >
            {reward ? (
              <>
                <MaterialCommunityIcons name="trophy" size={18} color={colors.warning} />
                <Text style={[styles.actionText, { color: colors.warning, fontSize: 13 }]}>{t("skins.seasonOnly")}</Text>
              </>
            ) : equipped ? (
              <>
                <MaterialCommunityIcons name="check" size={18} color={colors.brand} />
                <Text style={[styles.actionText, { color: colors.brand }]}>{t("skins.equipped")}</Text>
              </>
            ) : owned ? (
              <Text style={[styles.actionText, { color: colors.onBrand }]}>{t("skins.equip")}</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="circle-multiple" size={18} color={colors.onWarning} />
                <Text style={[styles.actionText, { color: colors.onWarning }]}>{formatNumber(item.price)}</Text>
              </>
            )}
          </Pressable>
          {notice && (
            <Text style={[styles.notice, { color: notice.ok ? colors.brand : colors.warning }]} testID="skin-notice" onPress={notice.ok ? undefined : onOpenShop}>
              {notice.text}
            </Text>
          )}
        </View>

        <View style={styles.right}>
          <View style={styles.tabs}>
            {(["weapons", "outfits"] as Tab[]).map((k) => (
              <Pressable key={k} testID={`skins-tab-${k}`} onPress={() => switchTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                <MaterialCommunityIcons name={k === "weapons" ? "pistol" : "hand-back-right"} size={16} color={tab === k ? colors.onBrand : colors.onSurfaceSecondary} />
                <Text style={[styles.tabText, tab === k && { color: colors.onBrand }]}>{t(k === "weapons" ? "skins.weapons" : "skins.outfits")}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{t(tab === "weapons" ? "skins.hint.weapons" : "skins.hint.outfits")}</Text>
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {items.map((it) => {
              const swatch = "body" in it ? [it.body, it.metal, it.accent ?? 0xb45cff] : [it.sleeve, it.glove, it.band];
              const mine = ownsSkin(skins, it.id);
              const on = skins.weapon === it.id || skins.outfit === it.id;
              return (
                <Pressable
                  key={it.id}
                  testID={`skin-${it.id}`}
                  onPress={() => {
                    setSelected(it.id);
                    setNotice(null);
                  }}
                  style={[styles.card, selected === it.id && styles.cardSelected]}
                >
                  <View style={styles.swatches}>
                    {swatch.map((c, i) => (
                      <View key={i} style={[styles.swatch, { backgroundColor: hex(c) }]} />
                    ))}
                  </View>
                  <Text style={styles.cardName} numberOfLines={1}>{t(it.name)}</Text>
                  {on ? (
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.brand} />
                  ) : !mine && isExclusive(it.id) ? (
                    <View style={styles.priceRow}>
                      <MaterialCommunityIcons name="trophy" size={12} color={colors.warning} />
                      <Text style={styles.price}>{t("skins.top5")}</Text>
                    </View>
                  ) : mine ? (
                    <Text style={styles.cardOwned}>{it.price === 0 ? t("skins.free") : "✓"}</Text>
                  ) : (
                    <View style={styles.priceRow}>
                      <MaterialCommunityIcons name="circle-multiple" size={12} color={colors.warning} />
                      <Text style={styles.price}>{formatNumber(it.price)}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: "row", gap: spacing.md, flexShrink: 1 },
  left: { width: 250, alignItems: "stretch", gap: spacing.sm },
  preview: { height: 170, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  cycle: { position: "absolute", bottom: 6, left: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  cycleText: { color: colors.onSurfaceSecondary, fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 1 },
  itemName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5, textAlign: "center" },
  action: { height: 42, borderRadius: radius.md, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  actionBuy: { backgroundColor: colors.warning, borderColor: colors.warning },
  actionEquip: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionDone: { borderColor: colors.brand },
  actionReward: { borderColor: colors.warning },
  actionText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5 },
  notice: { fontFamily: fonts.textMed, fontSize: 12, textAlign: "center" },
  right: { flex: 1, minHeight: 0 },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  tabOn: { backgroundColor: colors.skins, borderColor: colors.skins },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 1 },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, marginVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.sm },
  card: {
    width: 104,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cardSelected: { borderColor: colors.skins, backgroundColor: "rgba(255,92,214,0.08)" },
  swatches: { flexDirection: "row", gap: 3 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.4)" },
  cardName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
  cardOwned: { color: colors.brand, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  price: { color: colors.warning, fontFamily: fonts.display, fontSize: 13 },
});
