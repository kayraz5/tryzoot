# My files — manual check (MATTHEW)

`used by N` = other people's files import it, so changing it breaks them.
`uses N` = it imports N files I don't own, so their edits can break me.

## Views (5)

- [ ] `src/view/views/AuthView.vue`
- [ ] `src/view/views/MapView.vue` — uses 13
- [ ] `src/view/views/ProfileView.vue` — uses 6
- [ ] `src/view/views/StoryView.vue`
- [ ] `src/view/views/WardrobeView.vue`

## Map components (7)

- [ ] `src/view/components/map/AirportHelp.vue` — uses 3
- [ ] `src/view/components/map/MissionInfoCard.vue` — uses 5
- [ ] `src/view/components/map/mapBuildings.js`
- [ ] `src/view/components/map/mapLabels.js`
- [ ] `src/view/components/map/pinPoint.js` — uses 2
- [ ] `src/view/components/map/questLayers.js` — uses 1
- [ ] `src/view/components/map/useMissionNav.js` — used by 1, uses 4

## Character (3D) (4)

- [ ] `src/view/components/character/CharacterStudio.vue`
- [ ] `src/view/components/character/traveller.js`
- [ ] `src/view/components/character/travellerAssets.js`
- [ ] `src/view/components/character/travellerLayer.js`

## Story (3)

- [ ] `public/story/scrollcraft.css`
- [ ] `src/view/components/story/engine/scrollcraft.js`
- [ ] `src/view/components/story/story.css`

## Quests (1)

- [ ] `src/view/components/quests/memberMarkers.js` — used by 1, uses 1

## App shell (2)

- [ ] `src/controller/router/index.js` — used by 1, uses 12
- [ ] `src/view/app/AppNav.vue` — used by 1

## Stores (2)

- [ ] `src/model/stores/character.js` — used by 1
- [ ] `src/model/stores/user.js` — used by 23, uses 2

## Services (6)

- [ ] `src/model/services/airport.js` — uses 2
- [ ] `src/model/services/db/index.js` — used by 7, uses 3
- [ ] `src/model/services/geo.js` — used by 6
- [ ] `src/model/services/routeGeometry.js` — used by 1
- [ ] `src/model/services/routing.js` — used by 3
- [ ] `src/model/services/transit/mrt.js` — used by 2, uses 4

## API (2)

- [ ] `api/_lib/supabase.js` — used by 2
- [ ] `api/route.js` — used by 1

## Scripts / config (4)

- [ ] `.gitignore`
- [ ] `package.json`
- [ ] `scripts/faststart-video.mjs`
- [ ] `scripts/sync-mrt-lines.mjs`

## Tests (5)

- [ ] `src/__tests__/airport.spec.js`
- [ ] `src/__tests__/mapBuildings.spec.js`
- [ ] `src/__tests__/pinProximity.spec.js`
- [ ] `src/__tests__/routeGeometry.spec.js`
- [ ] `src/__tests__/stopPins.spec.js`

## Supabase (1)

- [ ] `supabase/route_cache.sql`

## Assets / data — no code to review (7)

- [ ] `public/story/` — 5 file(s)
- [ ] `src/assets/videos/` — 1 file(s)
- [ ] `src/model/data/` — 1 file(s)

**Total: 49 files.**
