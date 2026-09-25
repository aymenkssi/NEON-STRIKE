// The 6 world cities of the campaign (one per sector of 5 levels) and the time of day of each
// level: morning, noon, afternoon, sunset, then night for the 5th level of the city.
import type { Key } from "../i18n/fr";

export type CityId = "paris" | "newyork" | "tokyo" | "london" | "cairo" | "rio";
export type TimeOfDay = "morning" | "noon" | "afternoon" | "sunset" | "night";
export type Weather = "none" | "rain" | "dust" | "petals" | "leaves";

export type CityDef = {
  id: CityId;
  name: Key; // translation key of the city name
  style: "haussmann" | "skyscraper" | "tokyo" | "brick" | "desert" | "favela";
  heights: [number, number]; // building height range (m)
  walls: number[]; // facade colours
  trims: number[]; // roofs, frames, balconies
  plaza: [number, number]; // two paving colours
  road: number;
  ground: number; // land around the city
  tree: "plane" | "cherry" | "palm" | "small";
  cars: number[];
  weather: Weather;
  centerpiece: "fountain" | "column" | "torii" | "obelisk";
};

export const CITIES: Record<CityId, CityDef> = {
  paris: {
    id: "paris", name: "city.paris", style: "haussmann", heights: [15, 20],
    walls: [0xf1e3c6, 0xe9d6b2, 0xf5ead3, 0xe4cfa6], trims: [0x5b6b82, 0x4f5d73, 0x2f3542],
    plaza: [0xd9c9a8, 0xcbb892], road: 0x5c5f66, ground: 0x7fae5a, tree: "plane",
    cars: [0xe8e8e8, 0x2f6fd6, 0xd63a3a, 0x3a3a3a], weather: "leaves", centerpiece: "fountain",
  },
  newyork: {
    id: "newyork", name: "city.newyork", style: "skyscraper", heights: [28, 75],
    walls: [0x9aa6b8, 0xb86b4b, 0x7f8ea3, 0xc9b79c, 0x8a5a44], trims: [0x3d4552, 0x2b2f38, 0xd9dde3],
    plaza: [0xb9bcc2, 0xa6a9b0], road: 0x44474e, ground: 0x6f9950, tree: "small",
    cars: [0xffc61a, 0xffc61a, 0xffc61a, 0x2b2f38, 0xd9dde3], weather: "none", centerpiece: "fountain",
  },
  tokyo: {
    id: "tokyo", name: "city.tokyo", style: "tokyo", heights: [14, 34],
    walls: [0xeef1f5, 0xd8dde6, 0xf3e9e2, 0xc9d2de, 0xe6e0f0], trims: [0xff4f8b, 0x3ac7ff, 0xffd23a, 0x6bff8a],
    plaza: [0xd6d9de, 0xc2c6cc], road: 0x4a4d55, ground: 0x7cae6a, tree: "cherry",
    cars: [0xffffff, 0xff4f5e, 0x3a7bff, 0x2b2b2b], weather: "petals", centerpiece: "torii",
  },
  london: {
    id: "london", name: "city.london", style: "brick", heights: [13, 22],
    walls: [0xa9503c, 0x8f4432, 0xb86a4c, 0xd8cbb0], trims: [0xf2efe8, 0x2d3a2f, 0x3b3f47],
    plaza: [0xb3b3ad, 0x9e9e98], road: 0x4b4d52, ground: 0x6d9a52, tree: "plane",
    cars: [0x1f1f24, 0x1f1f24, 0xc8102e, 0x2f4a7a], weather: "rain", centerpiece: "column",
  },
  cairo: {
    id: "cairo", name: "city.cairo", style: "desert", heights: [7, 16],
    walls: [0xe8c992, 0xdcb57a, 0xf0d7a8, 0xd9a86a], trims: [0x8a5a34, 0x3f8f7f, 0xf4ecd8],
    plaza: [0xe5c68e, 0xd6b47a], road: 0x7a6a55, ground: 0xe3c283, tree: "palm",
    cars: [0xf4ecd8, 0x2f7f5f, 0xc84a2a, 0x3a3a3a], weather: "dust", centerpiece: "obelisk",
  },
  rio: {
    id: "rio", name: "city.rio", style: "favela", heights: [6, 13],
    walls: [0xff6f61, 0xffc93c, 0x4ecdc4, 0x9b5de5, 0x5fd068, 0xff9f1c, 0x3a86ff], trims: [0xf7f7f2, 0x2b9bd6, 0x8d5a2b],
    plaza: [0xf5f5f0, 0x2a2a2a], road: 0x55575c, ground: 0x4fae4f, tree: "palm",
    cars: [0xffffff, 0x3a86ff, 0xffc93c, 0x2b2b2b], weather: "none", centerpiece: "fountain",
  },
};

export const CITY_ORDER: CityId[] = ["paris", "newyork", "tokyo", "london", "cairo", "rio"];
export const TIMES: TimeOfDay[] = ["morning", "noon", "afternoon", "sunset", "night"];

export type Lighting = {
  skyTop: number;
  horizon: number;
  sun: number;
  sunIntensity: number;
  sunDir: [number, number, number]; // towards the sun
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  ambient: number;
  ambientIntensity: number;
  fog: number; // FogExp2 density
  night: boolean;
};

export const LIGHTING: Record<TimeOfDay, Lighting> = {
  morning: {
    skyTop: 0x5fa8ff, horizon: 0xffe4c2, sun: 0xfff0d6, sunIntensity: 2.2, sunDir: [0.6, 0.45, 0.3],
    hemiSky: 0xcfe8ff, hemiGround: 0x9a8a6a, hemiIntensity: 1.3, ambient: 0xffffff, ambientIntensity: 0.55, fog: 0.0022, night: false,
  },
  noon: {
    skyTop: 0x3d8bff, horizon: 0xc4e8ff, sun: 0xffffff, sunIntensity: 2.6, sunDir: [0.3, 0.9, 0.25],
    hemiSky: 0xd6ecff, hemiGround: 0x9a8f78, hemiIntensity: 1.4, ambient: 0xffffff, ambientIntensity: 0.6, fog: 0.0018, night: false,
  },
  afternoon: {
    skyTop: 0x4a92f2, horizon: 0xffe9b8, sun: 0xfff1cc, sunIntensity: 2.4, sunDir: [-0.55, 0.6, 0.35],
    hemiSky: 0xd9e8ff, hemiGround: 0xa08a68, hemiIntensity: 1.3, ambient: 0xfff6e6, ambientIntensity: 0.55, fog: 0.002, night: false,
  },
  sunset: {
    skyTop: 0x5a4aa8, horizon: 0xffb48a, sun: 0xffb070, sunIntensity: 2, sunDir: [-0.8, 0.22, -0.4],
    hemiSky: 0xe6d2e0, hemiGround: 0x5a5470, hemiIntensity: 1.15, ambient: 0xe8dcf0, ambientIntensity: 0.5, fog: 0.0016, night: false,
  },
  night: {
    skyTop: 0x070b22, horizon: 0x223366, sun: 0x9fb6ff, sunIntensity: 0.9, sunDir: [0.4, 0.55, -0.5],
    hemiSky: 0x5a70b8, hemiGround: 0x1a1a2e, hemiIntensity: 0.9, ambient: 0x8090d0, ambientIntensity: 0.45, fog: 0.0035, night: true,
  },
};

export function cityOfLevel(level: number): CityDef {
  const i = Math.min(CITY_ORDER.length - 1, Math.floor((Math.max(1, level) - 1) / 5));
  return CITIES[CITY_ORDER[i]];
}

export function timeOfLevel(level: number): TimeOfDay {
  return TIMES[(Math.max(1, level) - 1) % 5];
}
