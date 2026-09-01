# Neon Protocol — PRD

## Original Problem Statement
Port an HTML/Three.js 3D FPS zombie game ("Neon Protocol") into an improved native Android app (Expo React Native).

## User Choices
- Gameplay: score system + zombie waves + high-score record AND player health bar with game over.
- Sound effects: yes.
- Online leaderboard with pseudo/username.
- Visual theme: darker / night survival.
- Orientation: landscape.
- Monetization: Google AdMob ads.

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router. 3D scene via `expo-gl` (GLView) + `three` (0.185) + `expo-three`. Reanimated + gesture-handler for touch controls. expo-audio for SFX. Rajdhani display font (expo-font). Landscape-locked (expo-screen-orientation + app.json).
- **Backend**: FastAPI + MongoDB (motor). Public leaderboard keyed by pseudo.
- **Ads**: `react-native-google-mobile-ads` behind a safe wrapper (`src/ads/index.ts` native + `index.web.ts` stub). Renders a placeholder in Expo Go/web; real ads only in a native build.

## Core Requirements (static)
- First-person shooter with shotgun (8-pellet spread), recoil, reload, muzzle flash.
- Minecraft-style zombies with walk animation + pathfinding that chase and bite the player.
- Waves of increasing difficulty; score for kills (+100, +50 headshot); kill counter.
- Player health (100) with damage vignette + haptics; game over on 0 HP.
- Touch controls: left virtual joystick (move/sprint), right look zone, FIRE/JUMP/RELOAD buttons.
- HUD: health bar, wave, ammo, score, kills, pause, crosshair, hit marker.
- Online leaderboard (submit + ranked list, personal-best detection).
- Settings: look sensitivity slider, sound toggle (persisted locally).
- AdMob banner on menu + game over; rewarded ad to revive.

## Implemented (2026-06)
- [x] Full 3D game engine ported to expo-gl/three (`src/game/GameEngine.ts`): world, cover boxes, wave-spawned zombies, shotgun raycast, particles (blood/impact), weapon sway/bob/recoil/reload, jump + jetpack, collisions.
- [x] Dark/night moonlit theme with neon-green Tron grid, tuned lighting/fog for visibility.
- [x] Landscape lock, HUD overlay, touch controls, pause menu, game over screen.
- [x] Main menu (pseudo input, Play, Leaderboard, Settings) with zombie background.
- [x] Sound effects (procedurally generated WAVs: shotgun, reload, hit, zombie, wave, game over, empty).
- [x] Backend leaderboard API (submit/list/best) + rewarded-ad ack. 15/15 backend tests passing.
- [x] AdMob integration (test IDs) with safe web/Expo-Go fallback.
- [x] Fixed pause-button hit-test z-order (HUD paints above touch look-zone).

## Known Constraints
- Real AdMob ads require a native/production build (won't show in Expo Go/web — placeholder shown). Replace test Ad IDs with real ones + set EXPO_PUBLIC_AD_MODE=production before release.
- The 3D scene is best experienced on a real Android device / dev build; Expo Go works for testing.

## Backlog / Next
- P1: Different weapons / weapon pickups; ammo/health pickups.
- P1: Boss zombie every N waves; minimap or damage-direction indicator.
- P2: Interstitial ad on game over; daily challenge; rewarded ad for double coins.
- P2: Player profile stats (best wave, total kills) persisted online.
