# TERRAVEX — Development Roadmap

## Phase 1: Project Setup & Architecture [COMPLETE]
- [x] Modular `src/engine/` & `src/components/` architecture
- [x] Installed `three`, `@types/three`, `lucide-react`
- [x] Configured fullscreen WebGL layout, pixel-crisp CSS & memory documentation

## Phase 2: Playable MVP [COMPLETE]
- [x] Deterministic seeded PRNG & 2D/3D Perlin/FBM/Ridged noise (`noise.ts`)
- [x] Expandable Block & Item Registry (`blocks.ts`)
- [x] Procedural 16×16 Texture Atlas & 32×32 Isometric UI Sprite Generator (`textures.ts`)
- [x] Multi-biome World Generator (`worldGen.ts`)
- [x] Face-Culled AO Chunk Mesher (`chunkMesher.ts`) & Streaming Chunk Manager (`chunkManager.ts`)
- [x] AABB Collision, Sneak Ledge-Guard & 3D DDA Raycasting (`physics.ts`)
- [x] First-person Player Controller, Survival & Creative modes, Save/Load (`gameEngine.ts`, `saveSystem.ts`)
- [x] Main Menu, World Creator, HUD, Hotbar, Inventory & Crafting UI

## Phase 3: Advanced Gameplay Systems [COMPLETE]
- [x] All 4 Game Modes: Survival, Creative, Adventure (5 tracked objectives), Spectator
- [x] 2×2 Pocket & 3×3 Artisan Workbench Crafting + Searchable Recipe Book
- [x] Stone Furnaces (fuel & live smelting) & Persistent 18-slot Storage Chests
- [x] Farming (hoe tilling, water hydration, 3-stage wheat crops, food/hunger restoration)
- [x] Arcane Enchanting Altar (`Efficiency`, `Sharpness`, `Unbreaking`, `Fortune`)
- [x] Sparkstone Logic Circuits (Lever, Wire BFS propagation, Lit Lamps)
- [x] Creatures (Sheep, Boar, Stag), Hostiles (Stalker, Bone Marksman, Ember Slime), Villager Trader & Obsidian Warden Boss
- [x] Day/Night Cycle (Sun, Moon, Stars) & Dynamic Weather (Clear, Rain, Storm + Lightning, Snow)

## Phase 4: Polish, Controls & Optimization [COMPLETE]
- [x] Procedural Web Audio Synthesizer (`audio.ts`)
- [x] First-person held viewmodel bob/swing, 8-stage break cracks & voxel particles
- [x] O(1) chunk-indexed block modification storage & full entity material disposal
- [x] Responsive Mobile Touch Controls (`TouchControls`) & Browser Gamepad API polling (`input.ts`)
- [x] Full Settings panel (Render Distance, FOV, Sensitivity, Audio, Quality, Weather, Touch UI)

## Phase 5: Verification & QA [COMPLETE]
- [x] 10-test automated engine verification suite (`src/engine/verifyEngine.ts`) — 10/10 PASS
- [x] Strict TypeScript compilation (`npx tsc --noEmit`) — 0 errors
- [x] Production Vite build (`npm run build`) — verified

## Future Expansion Ideas (Post-v1.0)
- WebWorker off-thread chunk generation & greedy meshing for 10+ chunk render distances
- Flowing water/lava cellular automata and bucket items
- Additional Sparkstone logic gates (Repeaters, Pistons, Pressure Plates, Doors)
- Armor equipment slots and deeper underground dungeons / alternate dimensions
- World export/import JSON file download & upload
