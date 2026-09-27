// Story mode "L'Épidémie Néon": 5 acts (one city each, the last one crosses two), comic pages
// shown before, during and after an act, radio lines during the levels, story bosses, act rewards
// (credits, skins, characters) and a secret Helix document hidden in every level.
// Pure data, no React / three.js. Texts are translation keys (i18n/fr.ts).
import type { Key } from "../i18n/fr";
import type { CityId } from "./cities";
import type { CharacterKind } from "./characters";

export type Speaker =
  | "narrator" | "max" | "radio" | "rex" | "kira" | "zed" | "nova" | "leo" | "doc"
  | "guardian" | "commander" | "queen" | "founder";

// Art of a comic panel: a 3D stage with characters (heroes and zombies), or a drawn scene.
export type Actor = {
  hero?: string; // outfit id (skins.ts)
  weapon?: string; // held by a hero
  zombie?: CharacterKind;
  x: number;
  z?: number;
  turn?: number; // rotation around y (0 = facing the camera)
  scale?: number;
};
export type SceneId =
  | "lab" | "leak" | "radio" | "tower" | "badge"
  | "skyline" | "crates" | "neon" | "servers" | "satellite" | "desert" | "signal";
export type Stage = { bg: number; actors: Actor[]; night?: boolean };
export type Art = { stage: Stage } | { scene: SceneId };

export type Panel = { art: Art; who: Speaker; text: Key };
export type Line = { who: Speaker; text: Key };

// Reward of a finished act: credits, maybe an exclusive skin, and the characters met in the act
// (given for free, the others keep being sold in the Skins shop).
export type ActReward = { credits: number; skin?: string; heroes?: string[] };
export type StoryBoss = { look: CharacterKind; name: Key; hp: number };

export type Act = {
  n: number;
  title: Key;
  tagline: Key;
  city: CityId;
  cities?: CityId[]; // when the act crosses several cities
  levels: [number, number]; // first and last level
  ready: boolean; // false: shown as "coming soon" in the journal
  intro?: string; // comic shown before the first level
  mid?: { level: number; id: string }; // comic shown before a level in the middle of the act
  outro?: string; // comic shown after the last level
  next: Key; // "to be continued" line of the reward page
  reward?: ActReward;
  boss?: StoryBoss; // boss of the last level
};

export const ACTS: Act[] = [
  {
    n: 1, title: "story.act1", tagline: "story.act1.tag", city: "paris", levels: [1, 5], ready: true,
    intro: "a1_intro", outro: "a1_outro", next: "story.next.1",
    reward: { credits: 500, skin: "o_soldier_vet" },
    boss: { look: "guardian", name: "story.boss.guardian", hp: 1.5 },
  },
  {
    n: 2, title: "story.act2", tagline: "story.act2.tag", city: "newyork", levels: [6, 10], ready: true,
    intro: "a2_intro", outro: "a2_outro", next: "story.next.2",
    reward: { credits: 800, heroes: ["o_commando", "o_ninja"] },
    boss: { look: "spitterking", name: "story.boss.spitterking", hp: 1.6 },
  },
  {
    n: 3, title: "story.act3", tagline: "story.act3.tag", city: "tokyo", levels: [11, 15], ready: true,
    intro: "a3_intro", outro: "a3_outro", next: "story.next.3",
    reward: { credits: 1000, heroes: ["o_cyber"] },
    boss: { look: "commander", name: "story.boss.commander", hp: 1.8 },
  },
  {
    n: 4, title: "story.act4", tagline: "story.act4.tag", city: "london", levels: [16, 20], ready: true,
    intro: "a4_intro", outro: "a4_outro", next: "story.next.4",
    reward: { credits: 1200, heroes: ["o_astronaut"] },
    boss: { look: "queen", name: "story.boss.queen", hp: 2 },
  },
  {
    n: 5, title: "story.act5", tagline: "story.act5.tag", city: "cairo", cities: ["cairo", "rio"], levels: [21, 30], ready: true,
    intro: "a5_intro", mid: { level: 26, id: "a5_mid" }, outro: "a5_outro", next: "story.next.5",
    reward: { credits: 2500, heroes: ["o_royal"] },
    boss: { look: "founder", name: "story.boss.founder", hp: 2.5 },
  },
];

const hero = (id: string, weapon: string, x = 0, turn = 0.35): Actor => ({ hero: id, weapon, x, turn });
const TEAM = (ids: [string, string][]): Actor[] =>
  ids.map(([id, w], i) => ({ hero: id, weapon: w, x: (i - (ids.length - 1) / 2) * 1.25, z: -Math.abs(i - (ids.length - 1) / 2) * 0.4, turn: 0.25 }));
const solo = (a: Actor, bg = 0x101a33): Art => ({ stage: { bg, night: true, actors: [a] } });
const boss = (look: CharacterKind, bg: number): Art => ({ stage: { bg, night: true, actors: [{ zombie: look, x: 0, turn: 0.4 }] } });

export const COMICS: Record<string, Panel[]> = {
  a1_intro: [
    { art: { scene: "lab" }, who: "narrator", text: "story.a1i.1" },
    { art: { scene: "leak" }, who: "narrator", text: "story.a1i.2" },
    { art: solo(hero("o_soldier", "shotgun")), who: "max", text: "story.a1i.3" },
    { art: { scene: "radio" }, who: "radio", text: "story.a1i.4" },
    {
      art: {
        stage: {
          bg: 0x1a0f2e, night: true,
          actors: [
            { hero: "o_soldier", weapon: "shotgun", x: -1.6, turn: 1.2 },
            { zombie: "walker", x: 1.1, z: -0.6, turn: -1.1 },
            { zombie: "runner", x: 2.2, z: -1.6, turn: -1.2 },
            { zombie: "walker", x: 0.5, z: -2.6, turn: -0.9 },
          ],
        },
      },
      who: "max", text: "story.a1i.5",
    },
  ],
  a1_outro: [
    { art: boss("guardian", 0x0d1f2a), who: "narrator", text: "story.a1o.1" },
    { art: { scene: "badge" }, who: "max", text: "story.a1o.2" },
    { art: { scene: "radio" }, who: "rex", text: "story.a1o.3" },
    { art: { scene: "tower" }, who: "narrator", text: "story.a1o.4" },
  ],
  a2_intro: [
    { art: { scene: "skyline" }, who: "narrator", text: "story.a2i.1" },
    { art: solo(hero("o_commando", "m4"), 0x1b2414), who: "rex", text: "story.a2i.2" },
    { art: solo(hero("o_ninja", "mp5", 0, -0.3), 0x1d0c14), who: "kira", text: "story.a2i.3" },
    { art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_commando", "m4"], ["o_soldier", "shotgun"], ["o_ninja", "mp5"]]) } }, who: "max", text: "story.a2i.4" },
  ],
  a2_outro: [
    { art: boss("spitterking", 0x16240c), who: "narrator", text: "story.a2o.1" },
    { art: { scene: "crates" }, who: "rex", text: "story.a2o.2" },
    { art: solo(hero("o_ninja", "mp5", 0, -0.3), 0x1d0c14), who: "kira", text: "story.a2o.3" },
    { art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_commando", "m4"], ["o_soldier", "shotgun"], ["o_ninja", "mp5"]]) } }, who: "narrator", text: "story.a2o.4" },
  ],
  a3_intro: [
    { art: { scene: "neon" }, who: "narrator", text: "story.a3i.1" },
    { art: solo(hero("o_cyber", "pistol"), 0x160c2a), who: "zed", text: "story.a3i.2" },
    { art: { scene: "servers" }, who: "zed", text: "story.a3i.3" },
    { art: { stage: { bg: 0x160c2a, night: true, actors: TEAM([["o_soldier", "shotgun"], ["o_cyber", "pistol"]]) } }, who: "max", text: "story.a3i.4" },
    {
      art: { stage: { bg: 0x0c1420, night: true, actors: [{ zombie: "shield", x: -1, turn: 0.3 }, { zombie: "shield", x: 1, z: -0.8, turn: -0.2 }] } },
      who: "radio", text: "story.a3i.5",
    },
  ],
  a3_outro: [
    { art: boss("commander", 0x240a0e), who: "narrator", text: "story.a3o.1" },
    { art: { scene: "servers" }, who: "zed", text: "story.a3o.2" },
    { art: { scene: "radio" }, who: "nova", text: "story.a3o.3" },
    { art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_commando", "m4"], ["o_ninja", "mp5"], ["o_soldier", "shotgun"], ["o_cyber", "pistol"]]) } }, who: "narrator", text: "story.a3o.4" },
  ],
  a4_intro: [
    { art: { scene: "satellite" }, who: "narrator", text: "story.a4i.1" },
    { art: solo(hero("o_astronaut", "sniper"), 0x0f1a26), who: "nova", text: "story.a4i.2" },
    { art: boss("queen", 0x220a2a), who: "narrator", text: "story.a4i.3" },
    { art: { stage: { bg: 0x0f1a26, night: true, actors: TEAM([["o_soldier", "shotgun"], ["o_astronaut", "sniper"]]) } }, who: "max", text: "story.a4i.4" },
  ],
  a4_outro: [
    { art: boss("queen", 0x220a2a), who: "narrator", text: "story.a4o.1" },
    { art: { scene: "satellite" }, who: "nova", text: "story.a4o.2" },
    { art: { scene: "radio" }, who: "leo", text: "story.a4o.3" },
    { art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_commando", "m4"], ["o_ninja", "mp5"], ["o_soldier", "shotgun"], ["o_cyber", "pistol"], ["o_astronaut", "sniper"]]) } }, who: "narrator", text: "story.a4o.4" },
  ],
  a5_intro: [
    { art: { scene: "desert" }, who: "narrator", text: "story.a5i.1" },
    { art: solo(hero("o_royal", "ak47"), 0x2a1a08), who: "leo", text: "story.a5i.2" },
    {
      art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_ninja", "mp5"], ["o_commando", "m4"], ["o_soldier", "shotgun"], ["o_royal", "ak47"], ["o_cyber", "pistol"], ["o_astronaut", "sniper"]]) } },
      who: "max", text: "story.a5i.3",
    },
  ],
  a5_mid: [
    { art: { scene: "tower" }, who: "narrator", text: "story.a5m.1" },
    { art: { scene: "servers" }, who: "zed", text: "story.a5m.2" },
    { art: solo(hero("o_royal", "ak47"), 0x2a1a08), who: "leo", text: "story.a5m.3" },
  ],
  a5_outro: [
    { art: boss("founder", 0x0a1a24), who: "narrator", text: "story.a5o.1" },
    { art: { scene: "satellite" }, who: "nova", text: "story.a5o.2" },
    {
      art: { stage: { bg: 0x121a2e, night: true, actors: TEAM([["o_ninja", "mp5"], ["o_commando", "m4"], ["o_soldier", "shotgun"], ["o_royal", "ak47"], ["o_cyber", "pistol"], ["o_astronaut", "sniper"]]) } },
      who: "max", text: "story.a5o.3",
    },
    { art: { scene: "signal" }, who: "narrator", text: "story.a5o.4" },
  ],
};

// Radio lines: when the level starts and when its boss shows up.
export const RADIO: Record<number, { start?: Line; boss?: Line }> = {
  1: { start: { who: "radio", text: "story.l1.start" }, boss: { who: "max", text: "story.l1.boss" } },
  2: { start: { who: "max", text: "story.l2.start" }, boss: { who: "radio", text: "story.l2.boss" } },
  3: { start: { who: "radio", text: "story.l3.start" }, boss: { who: "max", text: "story.l3.boss" } },
  4: { start: { who: "max", text: "story.l4.start" }, boss: { who: "radio", text: "story.l4.boss" } },
  5: { start: { who: "radio", text: "story.l5.start" }, boss: { who: "guardian", text: "story.l5.boss" } },
  6: { start: { who: "rex", text: "story.l6.start" }, boss: { who: "kira", text: "story.l6.boss" } },
  7: { start: { who: "kira", text: "story.l7.start" }, boss: { who: "rex", text: "story.l7.boss" } },
  8: { start: { who: "rex", text: "story.l8.start" }, boss: { who: "kira", text: "story.l8.boss" } },
  9: { start: { who: "kira", text: "story.l9.start" }, boss: { who: "rex", text: "story.l9.boss" } },
  10: { start: { who: "rex", text: "story.l10.start" }, boss: { who: "rex", text: "story.l10.boss" } },
  11: { start: { who: "zed", text: "story.l11.start" }, boss: { who: "zed", text: "story.l11.boss" } },
  12: { start: { who: "zed", text: "story.l12.start" }, boss: { who: "kira", text: "story.l12.boss" } },
  13: { start: { who: "max", text: "story.l13.start" }, boss: { who: "zed", text: "story.l13.boss" } },
  14: { start: { who: "zed", text: "story.l14.start" }, boss: { who: "rex", text: "story.l14.boss" } },
  15: { start: { who: "zed", text: "story.l15.start" }, boss: { who: "commander", text: "story.l15.boss" } },
  16: { start: { who: "nova", text: "story.l16.start" }, boss: { who: "nova", text: "story.l16.boss" } },
  17: { start: { who: "max", text: "story.l17.start" }, boss: { who: "kira", text: "story.l17.boss" } },
  18: { start: { who: "nova", text: "story.l18.start" }, boss: { who: "zed", text: "story.l18.boss" } },
  19: { start: { who: "rex", text: "story.l19.start" }, boss: { who: "nova", text: "story.l19.boss" } },
  20: { start: { who: "nova", text: "story.l20.start" }, boss: { who: "queen", text: "story.l20.boss" } },
  21: { start: { who: "leo", text: "story.l21.start" }, boss: { who: "leo", text: "story.l21.boss" } },
  22: { start: { who: "zed", text: "story.l22.start" }, boss: { who: "rex", text: "story.l22.boss" } },
  23: { start: { who: "leo", text: "story.l23.start" }, boss: { who: "nova", text: "story.l23.boss" } },
  24: { start: { who: "kira", text: "story.l24.start" }, boss: { who: "max", text: "story.l24.boss" } },
  25: { start: { who: "leo", text: "story.l25.start" }, boss: { who: "zed", text: "story.l25.boss" } },
  26: { start: { who: "zed", text: "story.l26.start" }, boss: { who: "kira", text: "story.l26.boss" } },
  27: { start: { who: "nova", text: "story.l27.start" }, boss: { who: "rex", text: "story.l27.boss" } },
  28: { start: { who: "leo", text: "story.l28.start" }, boss: { who: "nova", text: "story.l28.boss" } },
  29: { start: { who: "max", text: "story.l29.start" }, boss: { who: "leo", text: "story.l29.boss" } },
  30: { start: { who: "leo", text: "story.l30.start" }, boss: { who: "founder", text: "story.l30.boss" } },
};

// Secret Helix documents: one hidden in every level (story.doc.<level>).
export const DOC_COUNT = 30;
export const docKey = (level: number) => `story.doc.${level}` as Key;
export const docsOfAct = (act: Act) => Array.from({ length: act.levels[1] - act.levels[0] + 1 }, (_, i) => act.levels[0] + i);

export const actOfLevel = (level: number) => ACTS.find((a) => level >= a.levels[0] && level <= a.levels[1]) ?? null;
export const actByNumber = (n: number) => ACTS.find((a) => a.n === n) ?? null;

// The boss of an act's last level (null: the usual boss).
export function storyBoss(level: number): StoryBoss | null {
  const a = actOfLevel(level);
  return a?.ready && a.boss && a.levels[1] === level ? a.boss : null;
}

// Comic to show before playing this level (first level of an act, or its middle part), not seen yet.
export function comicBefore(level: number, act: Act | null = actOfLevel(level)): string | null {
  if (!act?.ready) return null;
  if (act.intro && act.levels[0] === level) return act.intro;
  if (act.mid && act.mid.level === level) return act.mid.id;
  return null;
}
export function introBefore(level: number, seen: string[]): string | null {
  const id = comicBefore(level);
  return id && !seen.includes(id) ? id : null;
}
// Comics of an act in story order (for the journal).
export const comicsOf = (act: Act) => [act.intro, act.mid?.id, act.outro].filter((x): x is string => !!x);

// Act finished by clearing this level (its last one), if the act is playable.
export function actEndingAt(level: number): Act | null {
  const a = actOfLevel(level);
  return a?.ready && a.levels[1] === level ? a : null;
}

// Comics seen, act rewards received, secret documents found (levels).
export type StoryState = { seen: string[]; claimed: number[]; docs: number[] };
export const EMPTY_STORY: StoryState = { seen: [], claimed: [], docs: [] };

export function cleanStory(s: any): StoryState {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x in COMICS) : []);
  const nums = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && !!actByNumber(x)) : []);
  const docs = Array.isArray(s?.docs) ? s.docs.filter((x: unknown): x is number => typeof x === "number" && x >= 1 && x <= DOC_COUNT) : [];
  return { seen: Array.from(new Set(strings(s?.seen))), claimed: Array.from(new Set(nums(s?.claimed))), docs: Array.from(new Set<number>(docs)) };
}

// Levels of an act cleared (for the journal).
export function actProgress(act: Act, stars: Record<string, number>) {
  const total = act.levels[1] - act.levels[0] + 1;
  let done = 0;
  for (let l = act.levels[0]; l <= act.levels[1]; l++) if ((stars[l] ?? 0) > 0) done++;
  return { done, total };
}
