// Story mode "L'Épidémie Néon": acts (5 levels each in their city), comic pages shown before and
// after an act, radio lines during the levels, story bosses and act rewards.
// Pure data, no React / three.js. Texts are translation keys (i18n/fr.ts).
import type { Key } from "../i18n/fr";
import type { CityId } from "./cities";
import type { CharacterKind } from "./characters";

export type Speaker = "narrator" | "max" | "radio" | "rex" | "guardian";

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
export type SceneId = "lab" | "leak" | "radio" | "tower" | "badge";
export type Art = { stage: { bg: number; actors: Actor[]; night?: boolean } } | { scene: SceneId };

export type Panel = { art: Art; who: Speaker; text: Key };
export type Line = { who: Speaker; text: Key };

export type ActReward = { credits: number; skin: string };
export type StoryBoss = { look: CharacterKind; name: Key; hp: number; speech: Key };

export type Act = {
  n: number;
  title: Key;
  tagline: Key;
  city: CityId;
  levels: [number, number]; // first and last level
  ready: boolean; // false: shown as "coming soon" in the journal
  intro?: string; // comic shown before the first level
  outro?: string; // comic shown after the last level
  reward?: ActReward;
  boss?: StoryBoss; // boss of the last level
};

export const ACTS: Act[] = [
  {
    n: 1, title: "story.act1", tagline: "story.act1.tag", city: "paris", levels: [1, 5], ready: true,
    intro: "a1_intro", outro: "a1_outro",
    reward: { credits: 500, skin: "o_soldier_vet" },
    boss: { look: "guardian", name: "story.boss.guardian", hp: 1.5, speech: "story.l5.boss" },
  },
  { n: 2, title: "story.act2", tagline: "story.act2.tag", city: "newyork", levels: [6, 10], ready: false },
  { n: 3, title: "story.act3", tagline: "story.act3.tag", city: "tokyo", levels: [11, 15], ready: false },
  { n: 4, title: "story.act4", tagline: "story.act4.tag", city: "london", levels: [16, 20], ready: false },
  { n: 5, title: "story.act5", tagline: "story.act5.tag", city: "cairo", levels: [21, 30], ready: false },
];

export const COMICS: Record<string, Panel[]> = {
  a1_intro: [
    { art: { scene: "lab" }, who: "narrator", text: "story.a1i.1" },
    { art: { scene: "leak" }, who: "narrator", text: "story.a1i.2" },
    { art: { stage: { bg: 0x101a33, night: true, actors: [{ hero: "o_soldier", weapon: "shotgun", x: 0, turn: 0.35 }] } }, who: "max", text: "story.a1i.3" },
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
    { art: { stage: { bg: 0x0d1f2a, night: true, actors: [{ zombie: "guardian", x: 0, turn: 0.4, scale: 1.2 }] } }, who: "narrator", text: "story.a1o.1" },
    { art: { scene: "badge" }, who: "max", text: "story.a1o.2" },
    { art: { scene: "radio" }, who: "rex", text: "story.a1o.3" },
    { art: { scene: "tower" }, who: "narrator", text: "story.a1o.4" },
  ],
};

// Radio lines: when the level starts and when its boss shows up.
export const RADIO: Record<number, { start?: Line; boss?: Line }> = {
  1: { start: { who: "radio", text: "story.l1.start" }, boss: { who: "max", text: "story.l1.boss" } },
  2: { start: { who: "max", text: "story.l2.start" }, boss: { who: "radio", text: "story.l2.boss" } },
  3: { start: { who: "radio", text: "story.l3.start" }, boss: { who: "max", text: "story.l3.boss" } },
  4: { start: { who: "max", text: "story.l4.start" }, boss: { who: "radio", text: "story.l4.boss" } },
  5: { start: { who: "radio", text: "story.l5.start" }, boss: { who: "guardian", text: "story.l5.boss" } },
};

export const actOfLevel = (level: number) => ACTS.find((a) => level >= a.levels[0] && level <= a.levels[1]) ?? null;
export const actByNumber = (n: number) => ACTS.find((a) => a.n === n) ?? null;

// The boss of an act's last level (null: the usual boss).
export function storyBoss(level: number): StoryBoss | null {
  const a = actOfLevel(level);
  return a?.ready && a.boss && a.levels[1] === level ? a.boss : null;
}

// Comic to show before playing this level (first level of an act, not seen yet).
export function introBefore(level: number, seen: string[]): string | null {
  const a = actOfLevel(level);
  return a?.ready && a.intro && a.levels[0] === level && !seen.includes(a.intro) ? a.intro : null;
}

// Act finished by clearing this level (its last one), if the act is playable.
export function actEndingAt(level: number): Act | null {
  const a = actOfLevel(level);
  return a?.ready && a.levels[1] === level ? a : null;
}

export type StoryState = { seen: string[]; claimed: number[] }; // comics seen, act rewards received
export const EMPTY_STORY: StoryState = { seen: [], claimed: [] };

export function cleanStory(s: any): StoryState {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x in COMICS) : []);
  const nums = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && !!actByNumber(x)) : []);
  return { seen: Array.from(new Set(strings(s?.seen))), claimed: Array.from(new Set(nums(s?.claimed))) };
}

// Levels of an act cleared (for the journal).
export function actProgress(act: Act, stars: Record<string, number>) {
  const total = act.levels[1] - act.levels[0] + 1;
  let done = 0;
  for (let l = act.levels[0]; l <= act.levels[1]; l++) if ((stars[l] ?? 0) > 0) done++;
  return { done, total };
}
