# Coupling check — MATTHEW

Files owned by someone else that touch mine, so I know what to re-check after
anyone else's merge. Ownership = surviving-line `git blame` on `main`.

## 1. What my views import from other people

If they change these, my screen breaks.

| My view | Imports not mine | Total imports |
|---|---:|---:|
| `AuthView.vue` | 0 | 1 |
| `MapView.vue` | 13 | 25 |
| `ProfileView.vue` | 6 | 9 |
| `StoryView.vue` | 0 | 2 |
| `WardrobeView.vue` | 0 | 1 |

### MapView.vue

| Owner | File |
|---|---|
| EUDALE | `src/view/components/quests/QuestMapLive.vue` |
| HULBERT | `src/model/services/hours.js` |
| HULBERT | `src/model/stores/ui.js` |
| HULBERT | `src/view/common/weather/useWeatherRefresh.js` |
| HULBERT | `src/view/components/map/MapMenuButton.vue` |
| HULBERT | `src/view/components/map/MapStatusStack.vue` |
| KAYRA | `src/model/services/transit/index.js` |
| KAYRA | `src/model/services/travel.js` |
| KAYRA | `src/model/stores/mission.js` |
| KAYRA | `src/view/components/map/transit/TransitStopSheet.vue` |
| KAYRA | `src/view/components/map/transit/layers.js` |
| KAYRA | `src/view/components/map/transit/useTransit.js` |
| SHREY | `src/model/services/catalog.js` |

### ProfileView.vue

| Owner | File |
|---|---|
| HULBERT | `src/model/services/brand.js` |
| HULBERT | `src/model/services/config.js` |
| HULBERT | `src/model/stores/ui.js` |
| KAYRA | `src/model/data/origins.js` |
| SHREY | `src/model/stores/passport.js` |
| SHREY | `src/view/components/profile/EntryCheck.vue` |

**Self-contained** (no imports I don't own): `AuthView.vue`, `StoryView.vue`, `WardrobeView.vue`

## 2. Who imports my files

If I change these, their code breaks.

| My file | Importers not mine | Who |
|---|---:|---|
| `src/model/stores/user.js` | 23 | EUDALE x8, HULBERT x6, STEVEN x4, KAYRA x4, SHREY x2 |
| `src/model/services/db/index.js` | 7 | STEVEN x2, KAYRA x2, SHREY x2, EUDALE |
| `src/model/services/geo.js` | 6 | STEVEN x2, HULBERT x2, KAYRA, EUDALE |
| `src/model/services/routing.js` | 3 | STEVEN x2, KAYRA |
| `src/model/services/transit/mrt.js` | 2 | STEVEN, KAYRA |
| `api/_lib/supabase.js` | 2 | SHREY, STEVEN |
| `src/view/components/quests/memberMarkers.js` | 1 | EUDALE |
| `src/view/components/map/useMissionNav.js` | 1 | STEVEN |
| `src/view/app/AppNav.vue` | 1 | HULBERT |
| `src/model/stores/character.js` | 1 | STEVEN |
| `src/model/services/routeGeometry.js` | 1 | KAYRA |
| `src/model/data/mrtLines.sg.json` | 1 | KAYRA |
| `src/controller/router/index.js` | 1 | HULBERT |
| `api/route.js` | 1 | STEVEN |

`src/model/stores/user.js` is the one to be most careful with — 23 files across the whole team import it.

### Every importer of `src/model/stores/user.js`

- HULBERT — `src/App.vue`
- STEVEN — `src/__tests__/missionStore.spec.js`
- STEVEN — `src/__tests__/planUi.spec.js`
- EUDALE — `src/__tests__/questChat.spec.js`
- STEVEN — `src/__tests__/tripStore.spec.js`
- STEVEN — `src/__tests__/userStore.spec.js`
- KAYRA — `src/model/stores/mission.js`
- EUDALE — `src/model/stores/party.js`
- KAYRA — `src/model/stores/trip.js`
- HULBERT + SHREY — `src/view/components/passport/StampCelebration.vue`
- KAYRA — `src/view/components/plan/StylePicker.vue`
- KAYRA — `src/view/components/plan/planUi.js`
- EUDALE — `src/view/components/quests/OpenToCompanySheet.vue`
- EUDALE — `src/view/components/quests/QuestChatDrawer.vue`
- EUDALE — `src/view/components/quests/QuestChatHost.vue`
- EUDALE — `src/view/components/quests/QuestMapLive.vue`
- HULBERT — `src/view/views/DevView.vue`
- HULBERT — `src/view/views/LandingView.vue`
- HULBERT — `src/view/views/OnboardView.vue`
- SHREY — `src/view/views/PassportView.vue`
- HULBERT — `src/view/views/PlaceView.vue`
- EUDALE — `src/view/views/QuestDetailView.vue`
- EUDALE — `src/view/views/QuestsView.vue`

## 3. Contract that is not an import

`src/view/views/QuestDetailView.vue:60` (EUDALE) navigates into my map by URL:

```js
router.push({ path: '/map', query: { lat: p.lat, lng: p.lng, meet: q.value.meeting_label } })
```

It is split across two owners and both halves are live:

| Param | Handled in | Owner |
|---|---|---|
| `lat` / `lng` | `src/view/views/MapView.vue:1371` — flies the camera | MATTHEW |
| `meet` | `src/view/components/quests/QuestMapLive.vue:127` — draws the pin | EUDALE |
| (pin drawing) | `src/view/components/quests/memberMarkers.js` | MATTHEW + EUDALE |

Risks: it is a URL string, so nothing type-checks it; grepping `route.query` in
MapView misses it because the variable is aliased to `currentRoute`; and there is
**no test for this deep link** in `src/__tests__` or `e2e`. Rename a param and the
pin silently stops appearing with no build error.

## 4. Other things to know

- `src/view/components/map/MapStatusStack.vue` is HULBERT's, and the Demo-Walk
  change edits it. That is the one recent change crossing an ownership line.
- `src/view/views/LandingView.vue` (HULBERT) is dead code: `/` routes to my
  `StoryView.vue` under the name `landing`. Its `/auth` and `/map` links never render.

## 5. Mine that nobody else imports — safe to refactor

- `src/__tests__/airport.spec.js`
- `src/__tests__/mapBuildings.spec.js`
- `src/__tests__/pinProximity.spec.js`
- `src/__tests__/routeGeometry.spec.js`
- `src/__tests__/stopPins.spec.js`
- `src/model/services/airport.js`
- `src/view/components/character/CharacterStudio.vue`
- `src/view/components/character/traveller.js`
- `src/view/components/character/travellerAssets.js`
- `src/view/components/character/travellerLayer.js`
- `src/view/components/map/AirportHelp.vue`
- `src/view/components/map/MissionInfoCard.vue`
- `src/view/components/map/mapBuildings.js`
- `src/view/components/map/mapLabels.js`
- `src/view/components/map/pinPoint.js`
- `src/view/components/map/questLayers.js`
- `src/view/components/story/engine/scrollcraft.js`
- `src/view/views/AuthView.vue`
- `src/view/views/MapView.vue`
- `src/view/views/ProfileView.vue`
- `src/view/views/StoryView.vue`
- `src/view/views/WardrobeView.vue`

