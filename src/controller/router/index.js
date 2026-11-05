// EDITOR: MATTHEW
import { createRouter, createWebHistory } from 'vue-router'
import { DEV_PANEL } from '../../model/services/config.js'
import { useUserStore } from '../../model/stores/user.js'
import { useMissionStore } from '../../model/stores/mission.js'

/**
 * Routes from the IA table. meta.auth → needs a session; meta.onboarded → needs a travel style.
 * Heavy 3D views are lazy chunks so the landing page stays fast on phones.
 */
const routes = [
  // The landing page is "The Layover Flight": one continuous scroll-driven world
  // (src/view/components/story/).
  {
    path: '/',
    name: 'landing',
    component: () => import('../../view/views/StoryView.vue')
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('../../view/views/AuthView.vue')
  },
  {
    path: '/onboard',
    name: 'onboard',
    component: () => import('../../view/views/OnboardView.vue'),
    meta: { auth: true }
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('../../view/views/PlanView.vue'),
    meta: { auth: true, onboarded: true, nav: true }
  },
  {
    path: '/mission',
    name: 'mission-active',
    component: () => import('../../view/views/MissionView.vue'),
    meta: { auth: true, nav: true }
  },
  {
    path: '/mission/:id',
    name: 'mission',
    component: () => import('../../view/views/MissionView.vue'),
    meta: { auth: true, nav: true }
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('../../view/views/MapView.vue'),
    meta: { auth: true, fullscreen: true }
  },
  {
    path: '/place/:id',
    name: 'place',
    component: () => import('../../view/views/PlaceView.vue'),
    meta: { nav: true }
  },
  {
    path: '/passport',
    name: 'passport',
    component: () => import('../../view/views/PassportView.vue'),
    meta: { auth: true, nav: true }
  },
  {
    path: '/codex',
    name: 'codex',
    component: () => import('../../view/views/CodexView.vue'),
    meta: { auth: true, nav: true }
  },
  // Browse every place in the catalog (Kayra). Open without an account, like /place/:id.
  {
    path: '/explore',
    name: 'explore',
    component: () => import('../../view/views/ExploreView.vue'),
    meta: { nav: true }
  },
  {
    path: '/me',
    name: 'me',
    component: () => import('../../view/views/ProfileView.vue'),
    meta: { auth: true, nav: true }
  },
  {
    path: '/swipe',
    name: 'swipe',
    component: () => import('../../view/views/SwipeView.vue'),
    meta: { auth: true, nav: true }
  },
  // Social quests: hosts open a window of stops, guests join part of it.
  {
    path: '/quests',
    name: 'quests',
    component: () => import('../../view/views/QuestsView.vue'),
    meta: { auth: true, nav: true }
  },
  {
    path: '/quests/:id',
    name: 'quest',
    component: () => import('../../view/views/QuestDetailView.vue'),
    meta: { auth: true, nav: true }
  },
  ...(DEV_PANEL
    ? [
        {
          path: '/dev',
          name: 'dev',
          component: () => import('../../view/views/DevView.vue'),
          meta: { auth: true, nav: true }
        },
        // Dressing room for the 3D traveller (src/view/components/character/traveller.js). No auth so it's
        // quick to open while you're tweaking his outfits.
        {
          path: '/wardrobe',
          name: 'wardrobe',
          component: () => import('../../view/views/WardrobeView.vue')
        }
      ]
    : []),
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async (to) => {
  const user = useUserStore()
  await user.init()
  // Phones reopen the site at "/" after the browser was closed: a signed-in account goes back to
  // its mission instead of the landing page's sign-up buttons. (Guest sessions still see the landing.)
  if (to.name === 'landing' && user.isAuthed && user.mode === 'supabase')
    return { name: 'mission-active' }
  if (to.meta.auth && !user.isAuthed) return { name: 'auth', query: { next: to.fullPath } }

  // /plan is also the entry point from the landing page. Resume the current
  // account's unfinished mission before onboarding or showing a new plan form.
  if (to.name === 'plan' && user.isAuthed && to.query.fresh !== '1') {
    try {
      const mission = await useMissionStore().loadUnfinished()
      if (mission) return { name: 'mission', params: { id: mission.id } }
    } catch (err) {
      // A transient mission lookup failure should not prevent normal planning.
      console.warn('[router] could not resume an unfinished mission:', err)
    }
  }

  if (to.meta.onboarded && user.needsOnboarding)
    return { name: 'onboard', query: { next: to.fullPath } }
  return true
})
