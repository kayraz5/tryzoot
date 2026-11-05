<!-- EDITOR: MATTHEW -->
# Editor map

Who owns which file, so each of us knows what to double-check. Every source file also
carries an `EDITOR:` marker on line 1; this index adds the images, JSON and media files
that cannot hold a comment.

**How ownership was decided** — `git blame` on the current `main`, counting *surviving*
lines per author. So it reflects whose code is in the file today, not who merely touched it
once. Binary and media files are credited to the author of the last commit that changed them.

## Summary

| Editor | Source files | Assets / data | Total |
|---|---:|---:|---:|
| MATTHEW | 41 | 14 | 55 |
| KAYRA | 52 | 8 | 60 |
| STEVEN | 74 | 7 | 81 |
| SHREY | 24 | 152 | 176 |
| EUDALE | 37 | 0 | 37 |
| HULBERT | 37 | 1 | 38 |

## Shared files — double-check these together

No single owner above 60%, so two people's code is interleaved. The marker in these files
names both.

| File | Split |
|---|---|
| `.env.example` | SHREY:14 KAYRA:9 MATTHEW:6  |
| `api/plan.js` | KAYRA:38 HULBERT:32  |
| `src/model/services/db/index.js` | MATTHEW:43 STEVEN:33  |
| `src/model/services/transit/mrt.js` | KAYRA:63 MATTHEW:59  |
| `src/view/components/passport/StampCelebration.vue` | HULBERT:55 SHREY:40 KAYRA:7  |
| `src/view/components/quests/memberMarkers.js` | MATTHEW:40 EUDALE:38 KAYRA:1  |
| `src/view/views/CodexView.vue` | HULBERT:46 SHREY:42 MATTHEW:11 KAYRA:4  |

## Flagged mismatch

- `src/view/views/OnboardView.vue` was hand-tagged `EDITOR: STEVEN`, but blame says
  **HULBERT owns 79%** of the current lines. The existing tag was left untouched — worth
  confirming between Steven and Hulbert which of you should own it.

## Tree view

Folders are tagged with whoever owns most of what is inside them (`A / B / C` means the
folder is genuinely split). `⚠ shared` marks a file two people both have live code in.

```
zoot-/                                              SHREY 178 / STEVEN 82 / KAYRA 61
├── .github/                                        STEVEN
│   └── workflows/                                  STEVEN
│       └── ci.yml                                  STEVEN
├── .vercel/                                        MATTHEW
│   ├── project.json                                MATTHEW
│   └── README.txt                                  MATTHEW
├── api/                                            SHREY 7 / HULBERT 3 / KAYRA 3
│   ├── _lib/                                       SHREY 5 / HULBERT 1 / MATTHEW 1
│   │   ├── places/                                 SHREY
│   │   │   ├── index.js                            SHREY
│   │   │   ├── merge.js                            SHREY
│   │   │   ├── osm.js                              SHREY
│   │   │   └── supabase.js                         SHREY
│   │   ├── groq.js                                 HULBERT
│   │   ├── immigration.js                          SHREY
│   │   └── supabase.js                             MATTHEW
│   ├── bus-arrival.js                              KAYRA
│   ├── entry-rule.js                               SHREY
│   ├── plan.js                                     KAYRA + HULBERT   ⚠ shared
│   ├── route.js                                    MATTHEW
│   ├── summary.js                                  HULBERT
│   ├── sync-places.js                              SHREY
│   └── transit.js                                  KAYRA
├── docs/                                           EUDALE
│   ├── repo-audit.md                               EUDALE
│   ├── social-quests-spec.md                       EUDALE
│   ├── supabase-social-commands.md                 EUDALE
│   └── zoot-context.md                             EUDALE
├── e2e/                                            STEVEN
│   ├── fixtures/                                   STEVEN
│   │   ├── api/                                    STEVEN
│   │   │   ├── entry-rule.json                     STEVEN
│   │   │   ├── route.json                          STEVEN
│   │   │   └── summary.json                        STEVEN
│   │   ├── external/                               STEVEN
│   │   │   ├── lightning.json                      STEVEN
│   │   │   ├── open-meteo.json                     STEVEN
│   │   │   └── psi.json                            STEVEN
│   │   ├── draft.js                                STEVEN
│   │   ├── harness.js                              STEVEN
│   │   ├── social.js                               STEVEN
│   │   └── supabase.js                             STEVEN
│   ├── journeys/                                   STEVEN
│   │   ├── harness.spec.js                         STEVEN
│   │   ├── map.spec.js                             STEVEN
│   │   ├── mission.spec.js                         STEVEN
│   │   ├── onboarding.spec.js                      STEVEN
│   │   ├── passport.spec.js                        STEVEN
│   │   ├── plan.spec.js                            STEVEN
│   │   ├── quests-guest.spec.js                    STEVEN
│   │   └── routing.spec.js                         STEVEN
│   ├── social/                                     STEVEN
│   │   ├── chat-drawer.supabase.spec.js            STEVEN
│   │   ├── coop-xp.supabase.spec.js                STEVEN
│   │   ├── hud-chip.supabase.spec.js               STEVEN
│   │   ├── join-leave.supabase.spec.js             STEVEN
│   │   ├── live-location.supabase.spec.js          STEVEN
│   │   └── quests.supabase.spec.js                 STEVEN
│   ├── global-setup.js                             STEVEN
│   └── vue.spec.js                                 STEVEN
├── patches/                                        SHREY
│   └── flipbook-vue@1.0.0-beta.4.patch             SHREY
├── public/                                         KAYRA 7 / MATTHEW 6 / STEVEN 1
│   ├── brand/                                      KAYRA
│   │   ├── favicon.png                             KAYRA
│   │   ├── zoot-badge-192.png                      KAYRA
│   │   ├── zoot-otter.png                          KAYRA
│   │   ├── zoot-passport.jpg                       KAYRA
│   │   ├── zoot-runner.webp                        KAYRA
│   │   └── zoot-wordmark.png                       KAYRA
│   ├── data/                                       KAYRA
│   │   └── bus.sg.json                             KAYRA
│   ├── story/                                      MATTHEW
│   │   ├── flight-changi.webp                      MATTHEW
│   │   ├── flight-domes.webp                       MATTHEW
│   │   ├── flight-gate.webp                        MATTHEW
│   │   ├── flight-rain.webp                        MATTHEW
│   │   ├── flight.mp4                              MATTHEW
│   │   └── scrollcraft.css                         MATTHEW
│   └── favicon.ico                                 STEVEN
├── scripts/                                        MATTHEW 2 / SHREY 2 / HULBERT 1
│   ├── faststart-video.mjs                         MATTHEW
│   ├── gen-seed.mjs                                HULBERT
│   ├── snapshot-entry.mjs                          SHREY
│   ├── sync-mrt-lines.mjs                          MATTHEW
│   ├── sync-places.mjs                             SHREY
│   ├── sync-transit.mjs                            KAYRA
│   └── test-env.mjs                                STEVEN
├── scrollcraft/                                    MATTHEW
│   └── builds/                                     MATTHEW
│       └── zoot-layover-flight/                    MATTHEW
│           └── lab/                                MATTHEW
│               ├── mobile/                         MATTHEW
│               │   └── report.json                 MATTHEW
│               ├── reduced/                        MATTHEW
│               │   └── report.json                 MATTHEW
│               ├── shots/                          MATTHEW
│               │   └── report.json                 MATTHEW
│               ├── mobile-sheet.png                MATTHEW
│               └── sheet.png                       MATTHEW
├── src/                                            SHREY 162 / KAYRA 47 / STEVEN 41
│   ├── __tests__/                                  STEVEN 40 / EUDALE 8 / MATTHEW 5
│   │   ├── helpers/                                STEVEN
│   │   │   ├── fakeClock.js                        STEVEN
│   │   │   ├── fixtures.js                         STEVEN
│   │   │   ├── gen.js                              STEVEN
│   │   │   └── index.js                            STEVEN
│   │   ├── airport.spec.js                         MATTHEW
│   │   ├── apiEntryRule.spec.js                    STEVEN
│   │   ├── apiLibGroq.spec.js                      STEVEN
│   │   ├── apiLibImmigration.spec.js               STEVEN
│   │   ├── apiLibPlaces.spec.js                    STEVEN
│   │   ├── apiPlan.spec.js                         STEVEN
│   │   ├── apiRoute.spec.js                        STEVEN
│   │   ├── apiSummary.spec.js                      STEVEN
│   │   ├── apiSyncPlaces.spec.js                   STEVEN
│   │   ├── brand.spec.js                           STEVEN
│   │   ├── catalog.spec.js                         STEVEN
│   │   ├── catalog.supabase.spec.js                STEVEN
│   │   ├── CenterDialog.spec.js                    EUDALE
│   │   ├── characterStore.spec.js                  STEVEN
│   │   ├── checkin.spec.js                         STEVEN
│   │   ├── clock.spec.js                           STEVEN
│   │   ├── config.spec.js                          STEVEN
│   │   ├── dbIndex.spec.js                         STEVEN
│   │   ├── geo.spec.js                             STEVEN
│   │   ├── groq.spec.js                            STEVEN
│   │   ├── hours.spec.js                           STEVEN
│   │   ├── immigration.spec.js                     STEVEN
│   │   ├── itinerarySchema.spec.js                 STEVEN
│   │   ├── joinResolver.spec.js                    EUDALE
│   │   ├── localDb.spec.js                         STEVEN
│   │   ├── mapBuildings.spec.js                    MATTHEW
│   │   ├── missionStore.spec.js                    STEVEN
│   │   ├── mrtRoute.spec.js                        STEVEN
│   │   ├── passportStore.spec.js                   STEVEN
│   │   ├── pinProximity.spec.js                    MATTHEW
│   │   ├── placeImages.spec.js                     STEVEN
│   │   ├── planner.spec.js                         STEVEN
│   │   ├── planUi.spec.js                          STEVEN
│   │   ├── questChat.spec.js                       EUDALE
│   │   ├── QuestCoopChip.spec.js                   EUDALE
│   │   ├── retimeWait.spec.js                      EUDALE
│   │   ├── returnTerminal.spec.js                  KAYRA
│   │   ├── routeGeometry.spec.js                   MATTHEW
│   │   ├── routing.spec.js                         STEVEN
│   │   ├── socialJoin.spec.js                      EUDALE
│   │   ├── socialWindow.spec.js                    EUDALE
│   │   ├── stopPins.spec.js                        MATTHEW
│   │   ├── StopRangePicker.spec.js                 EUDALE
│   │   ├── transit.spec.js                         KAYRA
│   │   ├── travel.spec.js                          STEVEN
│   │   ├── tripStore.spec.js                       STEVEN
│   │   ├── uiStore.spec.js                         STEVEN
│   │   ├── useMissionNav.spec.js                   STEVEN
│   │   ├── userStore.spec.js                       STEVEN
│   │   ├── weather.spec.js                         STEVEN
│   │   ├── weatherHud.spec.js                      HULBERT
│   │   └── xp.spec.js                              STEVEN
│   ├── assets/                                     SHREY
│   │   ├── stamps/                                 SHREY  (149 files)
│   │   └── videos/                                 MATTHEW
│   │       └── landing_page_video.mp4              MATTHEW
│   ├── controller/                                 MATTHEW
│   │   └── router/                                 MATTHEW
│   │       └── index.js                            MATTHEW
│   ├── model/                                      KAYRA 17 / HULBERT 13 / MATTHEW 9
│   │   ├── data/                                   KAYRA 4 / SHREY 3 / HULBERT 1
│   │   │   ├── interests.js                        KAYRA
│   │   │   ├── mrtLines.sg.json                    MATTHEW
│   │   │   ├── mrtNetwork.sg.json                  KAYRA
│   │   │   ├── origins.js                          KAYRA
│   │   │   ├── places.synced.json                  SHREY
│   │   │   ├── sgEntrySnapshot.js                  SHREY
│   │   │   ├── sidequests.js                       HULBERT
│   │   │   ├── stampArt.js                         SHREY
│   │   │   └── transitLines.js                     KAYRA
│   │   ├── services/                               HULBERT 11 / KAYRA 11 / MATTHEW 6
│   │   │   ├── db/                                 HULBERT 2 / MATTHEW 1 / STEVEN 1
│   │   │   │   ├── index.js                        MATTHEW + STEVEN   ⚠ shared
│   │   │   │   ├── local.js                        HULBERT
│   │   │   │   └── remote.js                       HULBERT
│   │   │   ├── transit/                            KAYRA
│   │   │   │   ├── bus.js                          KAYRA
│   │   │   │   ├── index.js                        KAYRA
│   │   │   │   ├── mrt.js                          KAYRA + MATTHEW   ⚠ shared
│   │   │   │   ├── network.js                      KAYRA
│   │   │   │   ├── onemap.js                       KAYRA
│   │   │   │   ├── polyline.js                     KAYRA
│   │   │   │   ├── steps.js                        KAYRA
│   │   │   │   └── walk.js                         KAYRA
│   │   │   ├── airport.js                          MATTHEW
│   │   │   ├── brand.js                            HULBERT
│   │   │   ├── catalog.js                          SHREY
│   │   │   ├── checkin.js                          HULBERT
│   │   │   ├── clock.js                            HULBERT
│   │   │   ├── config.js                           HULBERT
│   │   │   ├── distance.js                         KAYRA
│   │   │   ├── geo.js                              MATTHEW
│   │   │   ├── groq.js                             HULBERT
│   │   │   ├── hours.js                            HULBERT
│   │   │   ├── immigration.js                      SHREY
│   │   │   ├── itinerarySchema.js                  HULBERT
│   │   │   ├── joinResolver.js                     EUDALE
│   │   │   ├── notify.js                           EUDALE
│   │   │   ├── placeImages.js                      EUDALE
│   │   │   ├── planner.js                          KAYRA
│   │   │   ├── routeGeometry.js                    MATTHEW
│   │   │   ├── routing.js                          MATTHEW
│   │   │   ├── social.js                           EUDALE
│   │   │   ├── stampArt.js                         SHREY
│   │   │   ├── travel.js                           KAYRA
│   │   │   ├── weather.js                          HULBERT
│   │   │   └── xp.js                               HULBERT
│   │   └── stores/                                 MATTHEW 2 / KAYRA 2 / EUDALE 1
│   │       ├── character.js                        MATTHEW
│   │       ├── mission.js                          KAYRA
│   │       ├── party.js                            EUDALE
│   │       ├── passport.js                         SHREY
│   │       ├── trip.js                             KAYRA
│   │       ├── ui.js                               HULBERT
│   │       └── user.js                             MATTHEW
│   ├── view/                                       KAYRA 28 / MATTHEW 20 / EUDALE 19
│   │   ├── app/                                    MATTHEW 1 / EUDALE 1 / HULBERT 1
│   │   │   ├── AppNav.vue                          MATTHEW
│   │   │   ├── CenterDialog.vue                    EUDALE
│   │   │   └── ToastHost.vue                       HULBERT
│   │   ├── common/                                 HULBERT 5 / EUDALE 4
│   │   │   ├── weather/                            HULBERT
│   │   │   │   ├── RainOverlay.vue                 HULBERT
│   │   │   │   ├── SkyEffects.vue                  HULBERT
│   │   │   │   ├── useWeatherRefresh.js            HULBERT
│   │   │   │   └── WeatherChip.vue                 HULBERT
│   │   │   ├── MemberAvatarStack.vue               EUDALE
│   │   │   ├── PlaceArt.vue                        HULBERT
│   │   │   ├── ProfilePreviewModal.vue             EUDALE
│   │   │   ├── StopGallery.vue                     EUDALE
│   │   │   └── UserAvatar.vue                      EUDALE
│   │   ├── components/                             KAYRA 24 / MATTHEW 14 / EUDALE 12
│   │   │   ├── character/                          MATTHEW
│   │   │   │   ├── CharacterStudio.vue             MATTHEW
│   │   │   │   ├── traveller.js                    MATTHEW
│   │   │   │   ├── travellerAssets.js              MATTHEW
│   │   │   │   └── travellerLayer.js               MATTHEW
│   │   │   ├── map/                                MATTHEW 7 / KAYRA 4 / HULBERT 2
│   │   │   │   ├── transit/                        KAYRA
│   │   │   │   │   ├── layers.js                   KAYRA
│   │   │   │   │   ├── TransitSteps.vue            KAYRA
│   │   │   │   │   ├── TransitStopSheet.vue        KAYRA
│   │   │   │   │   └── useTransit.js               KAYRA
│   │   │   │   ├── AirportHelp.vue                 MATTHEW
│   │   │   │   ├── mapBuildings.js                 MATTHEW
│   │   │   │   ├── mapLabels.js                    MATTHEW
│   │   │   │   ├── MapMenuButton.vue               HULBERT
│   │   │   │   ├── MapStatusStack.vue              HULBERT
│   │   │   │   ├── MissionInfoCard.vue             MATTHEW
│   │   │   │   ├── pinPoint.js                     MATTHEW
│   │   │   │   ├── questLayers.js                  MATTHEW
│   │   │   │   └── useMissionNav.js                MATTHEW
│   │   │   ├── mission/                            KAYRA
│   │   │   │   ├── LayoverCard.vue                 KAYRA
│   │   │   │   ├── MissionHeader.vue               KAYRA
│   │   │   │   ├── PlacePicker.vue                 KAYRA
│   │   │   │   ├── QuestDoneCard.vue               KAYRA
│   │   │   │   ├── ReplanCard.vue                  KAYRA
│   │   │   │   ├── ScheduleEditor.vue              KAYRA
│   │   │   │   ├── StopCard.vue                    KAYRA
│   │   │   │   └── TimeToGate.vue                  KAYRA
│   │   │   ├── passport/                           SHREY 3 / HULBERT 1
│   │   │   │   ├── pageArt.js                      SHREY
│   │   │   │   ├── StampCelebration.vue            HULBERT + SHREY   ⚠ shared
│   │   │   │   └── stampSlam.js                    SHREY
│   │   │   ├── places/                             KAYRA
│   │   │   │   └── PlaceCard.vue                   KAYRA
│   │   │   ├── plan/                               KAYRA
│   │   │   │   ├── BufferBar.vue                   KAYRA
│   │   │   │   ├── EntryBanner.vue                 KAYRA
│   │   │   │   ├── InterestTiles.vue               KAYRA
│   │   │   │   ├── LayoverForm.vue                 KAYRA
│   │   │   │   ├── LayoverSummary.vue              KAYRA
│   │   │   │   ├── MoreOptions.vue                 KAYRA
│   │   │   │   ├── MoreOptionsFields.vue           KAYRA
│   │   │   │   ├── plan.css                        KAYRA
│   │   │   │   ├── planUi.js                       KAYRA
│   │   │   │   ├── StylePicker.vue                 KAYRA
│   │   │   │   └── TimeBudgetCard.vue              KAYRA
│   │   │   ├── profile/                            SHREY
│   │   │   │   └── EntryCheck.vue                  SHREY
│   │   │   ├── quests/                             EUDALE
│   │   │   │   ├── JoinConfirmSheet.vue            EUDALE
│   │   │   │   ├── memberMarkers.js                MATTHEW + EUDALE   ⚠ shared
│   │   │   │   ├── OpenToCompanySheet.vue          EUDALE
│   │   │   │   ├── QuestCard.vue                   EUDALE
│   │   │   │   ├── QuestChatButton.vue             EUDALE
│   │   │   │   ├── QuestChatDrawer.vue             EUDALE
│   │   │   │   ├── QuestChatHost.vue               EUDALE
│   │   │   │   ├── QuestCoopChip.vue               EUDALE
│   │   │   │   ├── QuestGoSolo.vue                 EUDALE
│   │   │   │   ├── QuestMapLive.vue                EUDALE
│   │   │   │   ├── StopRangePicker.vue             EUDALE
│   │   │   │   └── useActiveQuest.js               EUDALE
│   │   │   └── story/                              MATTHEW
│   │   │       ├── engine/                         MATTHEW
│   │   │       │   └── scrollcraft.js              MATTHEW
│   │   │       └── story.css                       MATTHEW
│   │   ├── styles/                                 KAYRA
│   │   │   └── app.css                             KAYRA
│   │   └── views/                                  HULBERT 6 / MATTHEW 5 / KAYRA 3
│   │       ├── AuthView.vue                        MATTHEW
│   │       ├── CodexView.vue                       HULBERT + SHREY   ⚠ shared
│   │       ├── DevView.vue                         HULBERT
│   │       ├── ExploreView.vue                     KAYRA
│   │       ├── LandingView.vue                     HULBERT
│   │       ├── MapView.vue                         MATTHEW
│   │       ├── MissionView.vue                     KAYRA
│   │       ├── OnboardView.vue                     HULBERT
│   │       ├── PassportView.vue                    SHREY
│   │       ├── PlaceView.vue                       HULBERT
│   │       ├── PlanView.vue                        KAYRA
│   │       ├── ProfileView.vue                     MATTHEW
│   │       ├── QuestDetailView.vue                 EUDALE
│   │       ├── QuestsView.vue                      EUDALE
│   │       ├── StoryView.vue                       MATTHEW
│   │       ├── SwipeView.vue                       HULBERT
│   │       └── WardrobeView.vue                    MATTHEW
│   ├── App.vue                                     HULBERT
│   └── main.js                                     HULBERT
├── supabase/                                       SHREY 3 / EUDALE 2 / MATTHEW 1
│   ├── passport_pages.sql                          SHREY
│   ├── places_sync.sql                             SHREY
│   ├── route_cache.sql                             MATTHEW
│   ├── schema.sql                                  KAYRA
│   ├── seed.sql                                    SHREY
│   ├── social.sql                                  EUDALE
│   └── social_seed.sql                             EUDALE
├── tests/                                          STEVEN
│   ├── setup/                                      STEVEN
│   │   ├── supabase.globalSetup.js                 STEVEN
│   │   ├── supabase.setup.js                       STEVEN
│   │   └── unit.setup.js                           STEVEN
│   └── support/                                    STEVEN
│       ├── __tests__/                              STEVEN
│       │   ├── hermeticEnv.spec.js                 STEVEN
│       │   ├── networkGuard.spec.js                STEVEN
│       │   ├── redact.spec.js                      STEVEN
│       │   └── supabaseGate.spec.js                STEVEN
│       ├── networkGuard.js                         STEVEN
│       ├── redact.js                               STEVEN
│       └── supabaseGate.js                         STEVEN
├── .env.example                                    SHREY + KAYRA   ⚠ shared
├── .gitignore                                      MATTHEW
├── index.html                                      HULBERT
├── jsconfig.json                                   HULBERT
├── package.json                                    MATTHEW
├── playwright.config.js                            HULBERT
├── pnpm-lock.yaml                                  STEVEN
├── pnpm-workspace.yaml                             SHREY
├── README.md                                       HULBERT
├── vercel.json                                     SHREY
├── vite.config.js                                  KAYRA
└── vitest.config.js                                STEVEN
```

## MATTHEW

| File | Own % |
|---|---:|
| `.gitignore` | 100% |
| `.vercel/README.txt` | 100% |
| `api/_lib/supabase.js` | 100% |
| `api/route.js` | 100% |
| `public/story/scrollcraft.css` | 100% |
| `scripts/faststart-video.mjs` | 100% |
| `scripts/sync-mrt-lines.mjs` | 96% |
| `src/__tests__/airport.spec.js` | 100% |
| `src/__tests__/mapBuildings.spec.js` | 98% |
| `src/__tests__/pinProximity.spec.js` | 97% |
| `src/__tests__/routeGeometry.spec.js` | 100% |
| `src/__tests__/stopPins.spec.js` | 97% |
| `src/controller/router/index.js` | 60% |
| `src/model/services/airport.js` | 97% |
| `src/model/services/db/index.js` | 56% |
| `src/model/services/geo.js` | 67% |
| `src/model/services/routeGeometry.js` | 100% |
| `src/model/services/routing.js` | 99% |
| `src/model/stores/character.js` | 100% |
| `src/model/stores/user.js` | 99% |
| `src/view/app/AppNav.vue` | 83% |
| `src/view/components/character/CharacterStudio.vue` | 99% |
| `src/view/components/character/traveller.js` | 100% |
| `src/view/components/character/travellerAssets.js` | 100% |
| `src/view/components/character/travellerLayer.js` | 99% |
| `src/view/components/map/AirportHelp.vue` | 98% |
| `src/view/components/map/MissionInfoCard.vue` | 85% |
| `src/view/components/map/mapBuildings.js` | 100% |
| `src/view/components/map/mapLabels.js` | 100% |
| `src/view/components/map/pinPoint.js` | 99% |
| `src/view/components/map/questLayers.js` | 80% |
| `src/view/components/map/useMissionNav.js` | 95% |
| `src/view/components/quests/memberMarkers.js` | 50% |
| `src/view/components/story/engine/scrollcraft.js` | 100% |
| `src/view/components/story/story.css` | 100% |
| `src/view/views/AuthView.vue` | 99% |
| `src/view/views/MapView.vue` | 84% |
| `src/view/views/ProfileView.vue` | 96% |
| `src/view/views/StoryView.vue` | 100% |
| `src/view/views/WardrobeView.vue` | 98% |
| `supabase/route_cache.sql` | 100% |

Assets / data:

- `.vercel/` — 1 file(s)
- `package.json/` — 1 file(s)
- `public/story/` — 5 file(s)
- `scrollcraft/builds/zoot-layover-flight/lab/` — 2 file(s)
- `scrollcraft/builds/zoot-layover-flight/lab/mobile/` — 1 file(s)
- `scrollcraft/builds/zoot-layover-flight/lab/reduced/` — 1 file(s)
- `scrollcraft/builds/zoot-layover-flight/lab/shots/` — 1 file(s)
- `src/assets/videos/` — 1 file(s)
- `src/model/data/` — 1 file(s)

## KAYRA

| File | Own % |
|---|---:|
| `api/bus-arrival.js` | 100% |
| `api/plan.js` | 54% |
| `api/transit.js` | 100% |
| `scripts/sync-transit.mjs` | 100% |
| `src/__tests__/returnTerminal.spec.js` | 100% |
| `src/__tests__/transit.spec.js` | 100% |
| `src/model/data/interests.js` | 100% |
| `src/model/data/origins.js` | 100% |
| `src/model/data/transitLines.js` | 100% |
| `src/model/services/distance.js` | 100% |
| `src/model/services/planner.js` | 99% |
| `src/model/services/transit/bus.js` | 100% |
| `src/model/services/transit/index.js` | 100% |
| `src/model/services/transit/mrt.js` | 51% |
| `src/model/services/transit/network.js` | 100% |
| `src/model/services/transit/onemap.js` | 100% |
| `src/model/services/transit/polyline.js` | 100% |
| `src/model/services/transit/steps.js` | 100% |
| `src/model/services/transit/walk.js` | 100% |
| `src/model/services/travel.js` | 100% |
| `src/model/stores/mission.js` | 100% |
| `src/model/stores/trip.js` | 100% |
| `src/view/components/map/transit/TransitSteps.vue` | 97% |
| `src/view/components/map/transit/TransitStopSheet.vue` | 100% |
| `src/view/components/map/transit/layers.js` | 100% |
| `src/view/components/map/transit/useTransit.js` | 100% |
| `src/view/components/mission/LayoverCard.vue` | 100% |
| `src/view/components/mission/MissionHeader.vue` | 100% |
| `src/view/components/mission/PlacePicker.vue` | 100% |
| `src/view/components/mission/QuestDoneCard.vue` | 100% |
| `src/view/components/mission/ReplanCard.vue` | 100% |
| `src/view/components/mission/ScheduleEditor.vue` | 100% |
| `src/view/components/mission/StopCard.vue` | 100% |
| `src/view/components/mission/TimeToGate.vue` | 74% |
| `src/view/components/places/PlaceCard.vue` | 100% |
| `src/view/components/plan/BufferBar.vue` | 100% |
| `src/view/components/plan/EntryBanner.vue` | 100% |
| `src/view/components/plan/InterestTiles.vue` | 100% |
| `src/view/components/plan/LayoverForm.vue` | 100% |
| `src/view/components/plan/LayoverSummary.vue` | 100% |
| `src/view/components/plan/MoreOptions.vue` | 100% |
| `src/view/components/plan/MoreOptionsFields.vue` | 100% |
| `src/view/components/plan/StylePicker.vue` | 100% |
| `src/view/components/plan/TimeBudgetCard.vue` | 100% |
| `src/view/components/plan/plan.css` | 68% |
| `src/view/components/plan/planUi.js` | 100% |
| `src/view/styles/app.css` | 65% |
| `src/view/views/ExploreView.vue` | 100% |
| `src/view/views/MissionView.vue` | 100% |
| `src/view/views/PlanView.vue` | 100% |
| `supabase/schema.sql` | 100% |
| `vite.config.js` | 63% |

Assets / data:

- `public/brand/` — 6 file(s)
- `public/data/` — 1 file(s)
- `src/model/data/` — 1 file(s)

## STEVEN

| File | Own % |
|---|---:|
| `.github/workflows/ci.yml` | 100% |
| `e2e/fixtures/draft.js` | 100% |
| `e2e/fixtures/harness.js` | 100% |
| `e2e/fixtures/social.js` | 100% |
| `e2e/fixtures/supabase.js` | 100% |
| `e2e/global-setup.js` | 100% |
| `e2e/journeys/harness.spec.js` | 100% |
| `e2e/journeys/map.spec.js` | 100% |
| `e2e/journeys/mission.spec.js` | 100% |
| `e2e/journeys/onboarding.spec.js` | 100% |
| `e2e/journeys/passport.spec.js` | 100% |
| `e2e/journeys/plan.spec.js` | 100% |
| `e2e/journeys/quests-guest.spec.js` | 100% |
| `e2e/journeys/routing.spec.js` | 100% |
| `e2e/social/chat-drawer.supabase.spec.js` | 100% |
| `e2e/social/coop-xp.supabase.spec.js` | 100% |
| `e2e/social/hud-chip.supabase.spec.js` | 100% |
| `e2e/social/join-leave.supabase.spec.js` | 100% |
| `e2e/social/live-location.supabase.spec.js` | 100% |
| `e2e/social/quests.supabase.spec.js` | 100% |
| `e2e/vue.spec.js` | 100% |
| `pnpm-lock.yaml` | 75% |
| `scripts/test-env.mjs` | 100% |
| `src/__tests__/apiEntryRule.spec.js` | 100% |
| `src/__tests__/apiLibGroq.spec.js` | 100% |
| `src/__tests__/apiLibImmigration.spec.js` | 100% |
| `src/__tests__/apiLibPlaces.spec.js` | 100% |
| `src/__tests__/apiPlan.spec.js` | 100% |
| `src/__tests__/apiRoute.spec.js` | 100% |
| `src/__tests__/apiSummary.spec.js` | 100% |
| `src/__tests__/apiSyncPlaces.spec.js` | 100% |
| `src/__tests__/brand.spec.js` | 100% |
| `src/__tests__/catalog.spec.js` | 100% |
| `src/__tests__/catalog.supabase.spec.js` | 100% |
| `src/__tests__/characterStore.spec.js` | 100% |
| `src/__tests__/checkin.spec.js` | 100% |
| `src/__tests__/clock.spec.js` | 100% |
| `src/__tests__/config.spec.js` | 100% |
| `src/__tests__/dbIndex.spec.js` | 100% |
| `src/__tests__/geo.spec.js` | 100% |
| `src/__tests__/groq.spec.js` | 100% |
| `src/__tests__/helpers/fakeClock.js` | 100% |
| `src/__tests__/helpers/fixtures.js` | 100% |
| `src/__tests__/helpers/gen.js` | 100% |
| `src/__tests__/helpers/index.js` | 100% |
| `src/__tests__/hours.spec.js` | 99% |
| `src/__tests__/immigration.spec.js` | 100% |
| `src/__tests__/itinerarySchema.spec.js` | 100% |
| `src/__tests__/localDb.spec.js` | 100% |
| `src/__tests__/missionStore.spec.js` | 100% |
| `src/__tests__/mrtRoute.spec.js` | 71% |
| `src/__tests__/passportStore.spec.js` | 100% |
| `src/__tests__/placeImages.spec.js` | 100% |
| `src/__tests__/planUi.spec.js` | 99% |
| `src/__tests__/planner.spec.js` | 100% |
| `src/__tests__/routing.spec.js` | 100% |
| `src/__tests__/travel.spec.js` | 97% |
| `src/__tests__/tripStore.spec.js` | 100% |
| `src/__tests__/uiStore.spec.js` | 100% |
| `src/__tests__/useMissionNav.spec.js` | 99% |
| `src/__tests__/userStore.spec.js` | 100% |
| `src/__tests__/weather.spec.js` | 100% |
| `src/__tests__/xp.spec.js` | 100% |
| `tests/setup/supabase.globalSetup.js` | 100% |
| `tests/setup/supabase.setup.js` | 100% |
| `tests/setup/unit.setup.js` | 100% |
| `tests/support/__tests__/hermeticEnv.spec.js` | 100% |
| `tests/support/__tests__/networkGuard.spec.js` | 100% |
| `tests/support/__tests__/redact.spec.js` | 100% |
| `tests/support/__tests__/supabaseGate.spec.js` | 100% |
| `tests/support/networkGuard.js` | 100% |
| `tests/support/redact.js` | 100% |
| `tests/support/supabaseGate.js` | 100% |
| `vitest.config.js` | 80% |

Assets / data:

- `e2e/fixtures/api/` — 3 file(s)
- `e2e/fixtures/external/` — 3 file(s)
- `public/` — 1 file(s)

## SHREY

| File | Own % |
|---|---:|
| `.env.example` | 48% |
| `api/_lib/immigration.js` | 100% |
| `api/_lib/places/index.js` | 100% |
| `api/_lib/places/merge.js` | 100% |
| `api/_lib/places/osm.js` | 100% |
| `api/_lib/places/supabase.js` | 93% |
| `api/entry-rule.js` | 100% |
| `api/sync-places.js` | 100% |
| `pnpm-workspace.yaml` | 100% |
| `scripts/snapshot-entry.mjs` | 100% |
| `scripts/sync-places.mjs` | 100% |
| `src/model/data/sgEntrySnapshot.js` | 100% |
| `src/model/data/stampArt.js` | 100% |
| `src/model/services/catalog.js` | 100% |
| `src/model/services/immigration.js` | 100% |
| `src/model/services/stampArt.js` | 66% |
| `src/model/stores/passport.js` | 100% |
| `src/view/components/passport/pageArt.js` | 99% |
| `src/view/components/passport/stampSlam.js` | 75% |
| `src/view/components/profile/EntryCheck.vue` | 92% |
| `src/view/views/PassportView.vue` | 97% |
| `supabase/passport_pages.sql` | 100% |
| `supabase/places_sync.sql` | 100% |
| `supabase/seed.sql` | 100% |

Assets / data:

- `patches/` — 1 file(s)
- `src/assets/stamps/` — 149 file(s)
- `src/model/data/` — 1 file(s)
- `vercel.json/` — 1 file(s)

## EUDALE

| File | Own % |
|---|---:|
| `docs/repo-audit.md` | 100% |
| `docs/social-quests-spec.md` | 100% |
| `docs/supabase-social-commands.md` | 100% |
| `docs/zoot-context.md` | 100% |
| `src/__tests__/CenterDialog.spec.js` | 94% |
| `src/__tests__/QuestCoopChip.spec.js` | 90% |
| `src/__tests__/StopRangePicker.spec.js` | 98% |
| `src/__tests__/joinResolver.spec.js` | 100% |
| `src/__tests__/questChat.spec.js` | 98% |
| `src/__tests__/retimeWait.spec.js` | 100% |
| `src/__tests__/socialJoin.spec.js` | 100% |
| `src/__tests__/socialWindow.spec.js` | 100% |
| `src/model/services/joinResolver.js` | 100% |
| `src/model/services/notify.js` | 100% |
| `src/model/services/placeImages.js` | 100% |
| `src/model/services/social.js` | 100% |
| `src/model/stores/party.js` | 100% |
| `src/view/app/CenterDialog.vue` | 100% |
| `src/view/common/MemberAvatarStack.vue` | 100% |
| `src/view/common/ProfilePreviewModal.vue` | 100% |
| `src/view/common/StopGallery.vue` | 100% |
| `src/view/common/UserAvatar.vue` | 100% |
| `src/view/components/quests/JoinConfirmSheet.vue` | 99% |
| `src/view/components/quests/OpenToCompanySheet.vue` | 95% |
| `src/view/components/quests/QuestCard.vue` | 95% |
| `src/view/components/quests/QuestChatButton.vue` | 95% |
| `src/view/components/quests/QuestChatDrawer.vue` | 96% |
| `src/view/components/quests/QuestChatHost.vue` | 95% |
| `src/view/components/quests/QuestCoopChip.vue` | 89% |
| `src/view/components/quests/QuestGoSolo.vue` | 89% |
| `src/view/components/quests/QuestMapLive.vue` | 93% |
| `src/view/components/quests/StopRangePicker.vue` | 98% |
| `src/view/components/quests/useActiveQuest.js` | 93% |
| `src/view/views/QuestDetailView.vue` | 94% |
| `src/view/views/QuestsView.vue` | 95% |
| `supabase/social.sql` | 100% |
| `supabase/social_seed.sql` | 100% |

## HULBERT

| File | Own % |
|---|---:|
| `README.md` | 92% |
| `api/_lib/groq.js` | 94% |
| `api/summary.js` | 96% |
| `index.html` | 100% |
| `playwright.config.js` | 78% |
| `scripts/gen-seed.mjs` | 94% |
| `src/App.vue` | 62% |
| `src/__tests__/weatherHud.spec.js` | 97% |
| `src/main.js` | 100% |
| `src/model/data/sidequests.js` | 100% |
| `src/model/services/brand.js` | 94% |
| `src/model/services/checkin.js` | 100% |
| `src/model/services/clock.js` | 100% |
| `src/model/services/config.js` | 100% |
| `src/model/services/db/local.js` | 92% |
| `src/model/services/db/remote.js` | 82% |
| `src/model/services/groq.js` | 99% |
| `src/model/services/hours.js` | 89% |
| `src/model/services/itinerarySchema.js` | 100% |
| `src/model/services/weather.js` | 100% |
| `src/model/services/xp.js` | 96% |
| `src/model/stores/ui.js` | 98% |
| `src/view/app/ToastHost.vue` | 100% |
| `src/view/common/PlaceArt.vue` | 100% |
| `src/view/common/weather/RainOverlay.vue` | 97% |
| `src/view/common/weather/SkyEffects.vue` | 99% |
| `src/view/common/weather/WeatherChip.vue` | 97% |
| `src/view/common/weather/useWeatherRefresh.js` | 94% |
| `src/view/components/map/MapMenuButton.vue` | 100% |
| `src/view/components/map/MapStatusStack.vue` | 98% |
| `src/view/components/passport/StampCelebration.vue` | 53% |
| `src/view/views/CodexView.vue` | 44% |
| `src/view/views/DevView.vue` | 94% |
| `src/view/views/LandingView.vue` | 99% |
| `src/view/views/OnboardView.vue` | 79% |
| `src/view/views/PlaceView.vue` | 66% |
| `src/view/views/SwipeView.vue` | 94% |

Assets / data:

- `jsconfig.json/` — 1 file(s)

