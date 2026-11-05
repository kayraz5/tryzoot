<!-- EDITOR: MATTHEW -->
<script setup>
/**
 * The Zoot landing page: one continuous scroll-driven flight over Singapore.
 *
 * HOW IT WORKS
 * The page is a single fixed stage holding one video, plus an empty spacer that
 * is the only element in document flow. Scrolling does exactly two things: it
 * moves the video's playhead, and it fades copy in and out over the top. Nothing
 * sticks or unsticks, so there are no section edges travelling up the screen.
 *
 * The scrollcraft engine (engine/scrollcraft.js, vendored as-is) owns the
 * smoothed playhead, the spacer's height and the copy fades. Everything specific
 * to Zoot lives in this file. Do not edit the engine.
 *
 * THE MARKUP
 * Everything is teleported to <body>. Left inside #app it would sit under a
 * static wrapper as tall as the whole track, and a block that long scrolling
 * behind a fixed stage is exactly the seam this page exists to avoid.
 *
 * Inside, five things in order. The stage is one segment holding one clip,
 * because a single segment cannot have a seam; its poster carries the first
 * frame until the video can paint, and the scene stills behind it are what
 * reduced motion cross-dissolves instead of the film. The copy layer is fixed
 * above the stage and nothing in it scrolls. The spacer is empty and the whole
 * document flow of the flight — the engine sets its height. The debrief is
 * last: the written pitch, and the only block on the page that travels.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

import '../components/story/story.css'

const router = useRouter()

// the film

/** Length of public/story/flight.mp4, in seconds. */
const CLIP_SECONDS = 15.104

/** Scroll the flight occupies, in viewport-heights. */
const TRACK_VH = 10

/**
 * The four scenes in the film, in order, with the timecode each one starts at.
 * The film cuts hard between scenes, so these timecodes are also where the
 * waypoints and the copy change: a cut that lands where the reader arrives
 * somewhere new reads as arrival rather than as a glitch.
 *
 * `skyColour`/`groundColour` are the film's own averaged top and bottom edge
 * colours in that scene. They fill the stage for the moment before the first
 * frame has decoded, so a cold start shows that scene's own light rather than
 * the engine's near-black.
 *
 * `focusX` is the horizontal point a portrait phone crops around. The crop is
 * severe — a 9:19.5 screen keeps roughly a quarter of a 16:9 frame's width — so
 * centring it is not neutral, it is a composition decision made four times. The
 * street and the grove read better cropped than wide, because one-point
 * perspective and a vertical subject both want a tall frame; the apron does
 * not, and centred it is a wall of fuselage with the nose and the jet bridge
 * both outside the frame, so it is pulled right onto the cockpit.
 *
 * The percentages are near enough viewport-independent: scale and frame width
 * move together, so they hold across phone sizes and only drift on a tablet,
 * where the crop is gentle enough for the drift not to matter.
 */
const SCENES = [
  // Changi T3
  { id: 'changi', startsAt: 0.0, skyColour: '#dcc49f', groundColour: '#968c87', focusX: '77%' },
  // the grey — the vanishing point down the shophouse street
  { id: 'rain', startsAt: 2.9, skyColour: '#5f656d', groundColour: '#4f545b', focusX: '50%' },
  // the domes — the centre supertree
  { id: 'domes', startsAt: 7.1, skyColour: '#ddbf87', groundColour: '#444935', focusX: '48%' },
  // Gate B14 — the traveller at the window
  { id: 'gate', startsAt: 12.3, skyColour: '#5d5959', groundColour: '#746355', focusX: '37%' }
]

/** Where a scene begins as a fraction of the scroll track (0 to 1). */
const sceneProgress = (i) => SCENES[i].startsAt / CLIP_SECONDS

/**
 * Hand the stage everything that is specific to one scene.
 *
 * One function because there are two callers — the first paint at mount and
 * every crossing after it — and a scene's properties only stay in step if
 * adding one means editing a single place.
 */
function paintScene(index) {
  const scene = SCENES[index]
  const { style } = dom.stage
  style.setProperty('--zt-sky', scene.skyColour)
  style.setProperty('--zt-ground', scene.groundColour)
  style.setProperty('--zt-focus', scene.focusX)
}

// the beats

/**
 * The copy blocks, and the scrim that protects each one.
 *
 * `window` is handed straight to the engine as `data-sc-window`: "from to rampIn
 * rampOut", in track fractions. Each one sits inside a single scene so no line
 * is ever cut in half by the film.
 *
 * `ground` picks the ink. The film cuts between a bright apron, a dark
 * downpour, a dark garden floor and a warm gate interior, and no single ink
 * clears 4.5:1 on all four, so each block states which kind of ground it lands
 * on and takes its ink and its scrim polarity from that.
 *
 * `scrim` is the shape of the protection: a corner for most blocks, a column for
 * the hero (whose scene has near-black palms and bright concrete side by side,
 * top to bottom), and a soft plate for the close.
 */
const BEATS = [
  { id: 'hero', anchor: 'lead', ground: 'light', scrim: 'column', window: '0 0.1 0 0.35' },
  {
    id: 'terminal',
    anchor: 'trail',
    ground: 'light',
    scrim: 'corner',
    window: '0.118 0.182 0.3 0.22'
  },
  { id: 'rain', anchor: 'lead', ground: 'dark', scrim: 'corner', window: '0.205 0.44 0.2 0.22' },
  { id: 'clears', anchor: 'lead', ground: 'dark', scrim: 'corner', window: '0.485 0.78 0.2 0.2' },
  {
    id: 'finale',
    anchor: 'center',
    ground: 'light',
    scrim: 'plate',
    window: '0.825 1 0.16 0',
    raised: true
  }
]

/** Attributes for a copy block, so a beat is only described in one place. */
function beatAttrs(id) {
  const beat = BEATS.find((b) => b.id === id)
  return {
    class: [
      'sc-copy',
      `sc-copy--${beat.anchor}`,
      'zt-copy',
      beat.ground === 'light' && 'zt-copy--onlight',
      beat.raised && 'zt-copy--raised'
    ],
    'data-sc-copy': '',
    'data-sc-window': beat.window,
    'data-zt-copy': id
  }
}

// the action

/**
 * The page's one button, and it has exactly one job: open the sign-up screen.
 *
 * It used to read the visitor's state and shortcut straight to /plan for anyone
 * who already had a session — which is how a stale "continue as guest" session,
 * the only kind there is until Supabase is configured, quietly turned the
 * landing page's call to action into a link to the planner. The landing page is
 * the front door, so every button on it goes to the same place no matter who is
 * holding it.
 *
 * `mode` opens the form on the sign-up tab instead of leaving the reader on a
 * sign-in form to find their own way across, and `next` is stated so that
 * signing up still ends where the button promised it would.
 */
const CTA = { label: 'Sign up', to: { path: '/auth', query: { mode: 'signup', next: '/plan' } } }

// the handoff

/**
 * The one seam this page has left. The film ends, the written pitch below it
 * climbs into view, and without help the panel simply guillotines the closing
 * line halfway through a sentence.
 *
 * The engine's spacer carries one viewport of scroll past the end of the track,
 * which is exactly the distance the debrief travels from the bottom of the
 * screen to the top. That viewport is the handoff. Across it the closing copy
 * lifts at half the panel's speed and dissolves, so what the panel overtakes is
 * a layer already moving and already leaving: a fixed block being covered reads
 * as clipping, the same block drifting up and out reads as depth.
 *
 * Driven from scroll rather than from a CSS transition, because the thing it is
 * handing off to is driven from scroll. A timed fade would run on its own clock
 * and disagree with the panel the moment anyone scrolled at a different speed.
 */

/** Which beat does the handing off. */
const HANDOFF_BEAT = 'finale'

/** How far the closing copy lifts across the handoff, in viewport-heights. */
const HANDOFF_LIFT = 0.5

/** Handoff progress the closing copy dissolves between. */
const HANDOFF_FADE = { from: 0.12, to: 0.62 }

/**
 * Subpixel slack when deciding the debrief covers the screen, in pixels.
 *
 * Both edges land exactly on the viewport at the ends of their travel, and an
 * offset that reads 0.3 instead of 0 there would drop the film back in for one
 * frame. A sliver this thin is not visible; the flicker it prevents is.
 *
 * Belongs to syncStage(), which is its only reader.
 */
const COVER_SLACK = 1

/** Every progress number on this page lives in 0..1. */
const clamp01 = (n) => Math.min(Math.max(n, 0), 1)

/** 0 at or below `from`, 1 at or above `to`, eased in between. */
function smoothstep(value, from, to) {
  const t = clamp01((value - from) / (to - from))
  return t * t * (3 - 2 * t)
}

// the debrief

/**
 * The pitch, carried over from the previous landing page and parked below the
 * flight.
 *
 * The film sells the feeling and then stops. Everything a reader still has to
 * be *told* — what this thing is, who it is for, why the day needs planning at
 * all — lives down here, in the one block on the page that is actually in
 * document flow. Only the banner is gone: the hero said the same thing the
 * `hero` beat now says over the film, so it would have been said twice.
 *
 * Tables rather than markup, for the same reason SCENES and BEATS are tables:
 * each item is described in one place, and the template only has to say what
 * one of them looks like.
 */

/** The three claims under "What is Zoot?". */
const DEBRIEF_TAGS = [
  'On-the-go trip planner',
  'Designed for short layovers',
  'Interactive planning'
]

/** What the app actually does, one card each. `icon` is a Bootstrap Icons name. */
const DEBRIEF_FEATURES = [
  {
    icon: 'bi-geo-alt-fill',
    title: '3D quest map',
    text: 'A tilted toy-city Singapore with your route, the weather and a live countdown to your gate, all on one screen.'
  },
  {
    icon: 'bi-stars',
    title: 'AI place picker',
    text: 'Tell it your hours and interests. It picks the stops, the app times every leg, and it refuses plans that risk your flight.'
  },
  {
    icon: 'bi-patch-check-fill',
    title: 'Check-ins and XP',
    text: 'Walk into a stop’s ring, slam a chop into your 3D passport and level up as the trip goes on.'
  }
]

/**
 * Sam’s day: the worked example, because an eight-hour layover is an abstraction
 * until someone shows you one with times on it.
 *
 * `tag` is the optional pill at the end of a line and `tone` is its colour,
 * named for the `.zt-pill` modifiers in view/styles/app.css. The tag always
 * trails the line so one row of markup can draw every stop.
 */
const DEBRIEF_TIMELINE = [
  { time: '10:00', text: 'Lands at T3, 30 min to clear immigration' },
  { time: '10:30', text: 'Into town, every leg timed', tag: 'MRT', tone: 'ink' },
  { time: '13:00', text: 'Hawker lunch, then Gardens by the Bay (domes if it rains)' },
  { time: '16:30', text: 'Back at T3', tag: '90 min buffer', tone: 'pink' }
]

/** Why the day needs planning at all. Numbered by the template, not here. */
const DEBRIEF_PROBLEMS = [
  'Static lists leave travellers to figure out routing, timing and weather.',
  'Layover passengers fear immigration delays, transit confusion and missing their flight.',
  'Guided tours can’t personalise the day for one traveller.'
]

// the view

const root = ref(null)
const currentScene = ref(0)

/** Elements cached at mount and then written to every frame. */
const dom = {
  stage: null,
  stills: [], // the film
  copy: [],
  scrims: [], // the fixed copy layer
  handoff: null,
  debrief: null // the handoff into the debrief
}

let engine = null
let engineStyles = null
let pendingFrame = 0
let prefersReducedMotion = false

/**
 * How far we have scrolled into the page, in viewport-heights.
 *
 * The page's one scroll read. The flight and the handoff are both measured off
 * it, and measuring them separately is how two things meant to meet drift.
 */
function scrolledVh() {
  return (window.scrollY - (root.value?.offsetTop ?? 0)) / (window.innerHeight || 1)
}

/** How far through the flight we are, 0 to 1. */
function trackProgress() {
  return clamp01(scrolledVh() / TRACK_VH)
}

/**
 * How far into the handoff we are, 0 to 1: the viewport of scroll that begins
 * where the film ends and finishes with the debrief filling the screen.
 */
function handoffProgress() {
  return clamp01(scrolledVh() - TRACK_VH)
}

/**
 * Lift and dissolve the closing copy as the debrief climbs over it.
 *
 * Written to a wrapper inside the copy block and never to the block itself: the
 * engine owns that element's opacity and transform and rewrites both every
 * frame, and scrollcraft.css additionally forces `transform: none` on it under
 * reduced motion. Nested opacity multiplies, so the engine's fade and this one
 * compose without either having to know the other exists.
 *
 * The lift is the half of this that is decoration rather than meaning, so it is
 * the half reduced motion drops; the dissolve stays, because a block left at
 * full opacity under the panel is a rendering bug in any motion setting.
 */
function syncHandoff(handoff, fade) {
  const lift = prefersReducedMotion ? 0 : handoff * HANDOFF_LIFT * (window.innerHeight || 1)
  dom.handoff.style.opacity = fade.toFixed(3)
  dom.handoff.style.transform = lift ? `translate3d(0, ${(-lift).toFixed(1)}px, 0)` : 'none'
}

/**
 * What a copy block is actually painting at: the engine's own opacity, times
 * the handoff fade for the one block this file fades as well. Anything that
 * reacts to a block being visible has to ask this rather than read the inline
 * opacity, or the closing copy stays "visible" to it long after it has gone.
 */
function opacityOf(block, fade) {
  const own = parseFloat(block.style.opacity || '0')
  return block.dataset.ztCopy === HANDOFF_BEAT ? own * fade : own
}

/**
 * Track which scene we are in, so the stage's per-scene properties — its
 * pre-paint ground, and the point a portrait phone crops around — follow it.
 *
 * Derived from scroll rather than from the engine's `sc:waypoint` event, because
 * that event only fires when the scene *changes*: scene one is already current
 * at the top of the page, so its colours would never be applied. Deriving it
 * also means reloading halfway down restores the right fill.
 */
function syncScene(progress) {
  let scene = 0
  for (let i = 0; i < SCENES.length; i++) {
    if (progress >= sceneProgress(i)) scene = i
  }

  if (scene !== currentScene.value) {
    currentScene.value = scene
    paintScene(scene)
  }
}

/**
 * Take the film off the screen once the debrief has covered it, and put it back
 * the moment any of it shows again.
 *
 * The stage is fixed, so unlike a scrolled block it never stops being on the
 * page. Left alone it goes on compositing a full-viewport video layer behind an
 * opaque panel for as long as anyone reads, which on a phone is paid for in
 * battery and in dropped frames on the panel in front of it.
 *
 * `visibility` rather than `display`: the engine measures this element, and a
 * display change would cost a layout every time the boundary is crossed. It
 * keeps the decoded frame too, so scrolling back up returns the film instantly
 * rather than to a blank stage that has to buffer again.
 *
 * Measured from the panel's own box rather than from handoff progress, because
 * the two only agree when the debrief is taller than the viewport. On a screen
 * tall enough to show the end of the panel, progress still reaches 1 while the
 * film is visible underneath, and measuring the panel keeps the film.
 *
 * From `offsetTop` and `offsetHeight` rather than from a bounding rect, though,
 * and that distinction is the whole bug it fixes. Overscrolling at the end of
 * the page rubber-bands the document upward; a rect reports that bounce, so the
 * panel appeared to lift off the bottom of the screen and the film was switched
 * back on to fill a gap it was itself creating. Layout offsets and `scrollY`
 * are both clamped to the document and ignore the bounce. (`offsetTop` is
 * relative to the mode root, which is the offsetParent once the engine's
 * stylesheet makes it `position: relative` — the same assumption trackProgress
 * already makes about the root's own offset.)
 */
function syncStage() {
  const viewport = window.innerHeight || 0
  const top = (root.value?.offsetTop ?? 0) + dom.debrief.offsetTop - window.scrollY
  const covered = top <= COVER_SLACK && top + dom.debrief.offsetHeight >= viewport - COVER_SLACK
  const visibility = covered ? 'hidden' : ''
  if (dom.stage.style.visibility !== visibility) dom.stage.style.visibility = visibility
}

/**
 * Give every scrim its copy block's opacity.
 *
 * The scrims have to be siblings of the copy rather than children, because the
 * contrast check hides a copy block and everything inside it to photograph the
 * frame underneath. Mirroring what the block paints keeps the two in step
 * without restating any window maths here — and carries the handoff with it, so
 * the closing plate dissolves on the same curve as the text it is protecting
 * rather than sitting lit behind copy that has already gone.
 */
function syncScrims(fade) {
  for (const { scrim, copy } of dom.scrims) {
    scrim.style.opacity = opacityOf(copy, fade).toFixed(3)
  }
}

/**
 * Keep faded-out copy out of the tab order, and out of the way of the mouse.
 * The engine stops pointer events on an invisible block but leaves it
 * focusable, which otherwise let a keyboard user reach the closing button from
 * the top of the page. `inert` also swallows clicks, which is what stops the
 * dissolving closing copy from being two invisible buttons layered over the
 * first screen of the debrief.
 */
function syncFocusability(fade) {
  for (const block of dom.copy) {
    const hidden = opacityOf(block, fade) <= 0.5
    if (block.inert !== hidden) block.inert = hidden
  }
}

/**
 * Reduced motion never loads the video, so without this the whole page would be
 * one frozen frame. These scene stills cross-dissolve at the same timecodes the
 * film cuts at, so the story still reads with no motion at all.
 */
function crossfadeStills(progress) {
  dom.stills.forEach((still, i) => {
    const scene = i + 1 // stills cover scenes 2..4; scene 1 is the base poster
    const from = sceneProgress(scene)
    const until = scene + 1 < SCENES.length ? sceneProgress(scene + 1) : 1
    const fadeOver = Math.max((until - from) * 0.12, 0.001)
    still.style.opacity = clamp01((progress - from) / fadeOver).toFixed(3)
  })
}

function render() {
  pendingFrame = 0
  const progress = trackProgress()
  const handoff = handoffProgress()
  const fade = 1 - smoothstep(handoff, HANDOFF_FADE.from, HANDOFF_FADE.to)

  syncScene(progress)
  syncHandoff(handoff, fade)
  syncScrims(fade)
  syncFocusability(fade)
  syncStage()
  if (prefersReducedMotion) crossfadeStills(progress)
}

function onScroll() {
  if (!pendingFrame) pendingFrame = requestAnimationFrame(render)
}

/**
 * The engine's stylesheet restyles body, headings, selection and the scrollbar,
 * so it is attached only while this route is open instead of being imported
 * globally. Loading is awaited because the stylesheet is what makes the stage
 * `position: fixed`, and the engine measures the stage as it mounts.
 */
function loadEngineStyles() {
  return new Promise((resolve) => {
    engineStyles = document.createElement('link')
    engineStyles.rel = 'stylesheet'
    engineStyles.href = '/story/scrollcraft.css'
    engineStyles.onload = resolve
    engineStyles.onerror = resolve
    document.head.appendChild(engineStyles)
  })
}

function cacheElements() {
  const el = root.value
  dom.stage = el.querySelector('[data-sc-world]')
  dom.copy = Array.from(el.querySelectorAll('[data-sc-copy]'))
  dom.stills = Array.from(el.querySelectorAll('[data-zt-still]'))
  dom.scrims = Array.from(el.querySelectorAll('[data-zt-scrim]'))
    .map((scrim) => ({
      scrim,
      copy: el.querySelector(`[data-zt-copy="${scrim.dataset.ztScrim}"]`)
    }))
    .filter(({ copy }) => copy)
  dom.handoff = el.querySelector('[data-zt-handoff]')
  dom.debrief = el.querySelector('.zt-debrief')
}

/**
 * The engine sizes the spacer from `window.innerHeight`. If that reports 0 at
 * mount, the spacer becomes 0px and the page silently has no scroll track at
 * all. A single resize event makes it measure again, so one is sent once layout
 * and webfonts have settled.
 */
function forceRelayout() {
  dispatchEvent(new Event('resize'))
}

onMounted(async () => {
  prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.documentElement.classList.add('zt-story-route')

  await loadEngineStyles()
  // Attaches window.ScrollCraft as a side effect; it exports nothing.
  await import('../components/story/engine/scrollcraft.js')

  cacheElements()
  paintScene(0)

  // Mounted on `document`, not on the mode root: the engine looks for the mode
  // root among its argument's DESCENDANTS, so handing it the element that
  // carries the attribute finds nothing and fails silently.
  engine = window.ScrollCraft.mount(document)

  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onScroll, { passive: true })
  addEventListener('load', forceRelayout)
  document.fonts?.ready.then(forceRelayout)
  requestAnimationFrame(forceRelayout)
  render()
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('zt-story-route')
  if (pendingFrame) cancelAnimationFrame(pendingFrame)
  removeEventListener('scroll', onScroll)
  removeEventListener('resize', onScroll)
  removeEventListener('load', forceRelayout)
  engine?.destroy()
  engineStyles?.remove()
})
</script>

<template>
  <Teleport to="body">
    <main class="zt-story" ref="root" data-sc-mode="worldflight" data-sc-lerp="0.12">
      <div data-sc-world>
        <div data-sc-segment :data-sc-w="TRACK_VH">
          <img
            class="sc-world__poster"
            src="/story/flight-changi.webp"
            alt=""
            width="1280"
            height="720"
            decoding="async"
          />
          <img
            v-for="scene in SCENES.slice(1)"
            :key="scene.id"
            data-zt-still
            :src="`/story/flight-${scene.id}.webp`"
            alt=""
            width="1280"
            height="720"
            decoding="async"
            style="opacity: 0"
          />
          <video data-sc-src="/story/flight.mp4"></video>
        </div>
      </div>

      <div data-sc-world-copy>
        <div
          v-for="beat in BEATS"
          :key="beat.id"
          class="zt-scrim"
          :class="[
            `zt-scrim--${beat.scrim}`,
            `zt-scrim--${beat.anchor}`,
            `zt-scrim--on${beat.ground}`
          ]"
          :data-zt-scrim="beat.id"
          aria-hidden="true"
        ></div>

        <div v-bind="beatAttrs('hero')">
          <img
            class="zt-wordmark"
            src="/brand/zoot-wordmark.png"
            alt="Zoot"
            width="581"
            height="282"
          />
          <h1 class="zt-h1">Eight hours in Singapore,<br />why waste time?</h1>
          <p class="zt-lede">
            Zoot helps you plan the day backwards from your boarding time, then walks you through it
            stop by stop, ensuring you reach back on time.
          </p>
          <button class="zt-cta" type="button" @click="router.push(CTA.to)">{{ CTA.label }}</button>
        </div>

        <div v-bind="beatAttrs('terminal')">
          <h2 class="zt-h2">Most people spend it in the terminal.</h2>
          <p class="zt-lede">
            Not because there’s nothing out there to explore, but because they’re too afraid of
            missing their flight.
          </p>
        </div>

        <div v-bind="beatAttrs('rain')">
          <h2 class="zt-h2">What if it rains suddenly?</h2>
          <p class="zt-lede">
            Zoot got you all covered, the plan moves indoors instead of falling apart and delaying
            you.
          </p>
        </div>

        <div v-bind="beatAttrs('clears')">
          <h2 class="zt-h2 zt-h2--big">And then it clears.</h2>
          <p class="zt-lede">
            You walk into the ring around a stop, and then chop lands stamps and achievements in
            your passport.
          </p>
        </div>

        <!-- The closing beat is the one the debrief has to take over from, so
				     its contents sit on a wrapper this file can lift and dissolve
				     without touching the opacity and transform the engine owns. -->
        <div v-bind="beatAttrs(HANDOFF_BEAT)">
          <div class="zt-handoff" data-zt-handoff>
            <h2 class="zt-h2">Back at the gate with 90 minutes to spare.</h2>
            <p class="zt-lede">
              Zoot refuses a plan that cuts it closer. That is the only promise it makes.
            </p>
            <div class="zt-pass">
              <div class="zt-pass__stub">
                <span class="zt-pass__key">Boarding</span>
                <b class="zt-pass__value">18:00</b>
              </div>
              <div class="zt-pass__main">
                <span class="zt-pass__key">Layover</span>
                <b class="zt-pass__value">Singapore · 8h</b>
              </div>
              <button class="zt-cta zt-cta--pass" type="button" @click="router.push(CTA.to)">
                {{ CTA.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div data-sc-spacer aria-hidden="true"></div>

      <!-- The last thing on the page, and the only part of it with a height of
			     its own: it slides up over the frozen final frame once the film ends. -->
      <section class="zt-debrief">
        <div class="zt-debrief__inner">
          <section class="zt-debrief__panel">
            <div class="zt-debrief__header">
              <h2 class="zt-display zt-debrief__title">What is Zoot?</h2>
              <button class="zt-cta" type="button" @click="router.push(CTA.to)">
                {{ CTA.label }}
              </button>
            </div>

            <ul class="zt-debrief__tags">
              <li v-for="tag in DEBRIEF_TAGS" :key="tag" class="zt-pill zt-debrief__tag">
                {{ tag }}
              </li>
            </ul>

            <ul class="zt-debrief__features">
              <li
                v-for="(feature, i) in DEBRIEF_FEATURES"
                :key="feature.title"
                class="zt-card zt-debrief__feature"
              >
                <span class="zt-pill zt-debrief__label">Feature {{ i + 1 }}</span>
                <span class="zt-debrief__icon" aria-hidden="true"
                  ><i class="bi" :class="feature.icon"></i
                ></span>
                <h3 class="zt-debrief__feature-title">{{ feature.title }}</h3>
                <p class="zt-debrief__feature-text">{{ feature.text }}</p>
              </li>
            </ul>
          </section>

          <section class="zt-debrief__panel">
            <div class="zt-debrief__persona">
              <div class="zt-debrief__brief">
                <span class="zt-pill ink zt-debrief__label">Meet Sam, 21</span>
                <h2 class="zt-display zt-debrief__title zt-debrief__title--persona">
                  He has an 8 hour layover in Singapore. What does he do?
                </h2>
                <p class="zt-debrief__text">
                  He stays in the terminal. Not because there’s nothing to do, but because he
                  doesn’t know what’s safe to try. With Zoot he gets this instead:
                </p>
              </div>

              <ol class="zt-debrief__timeline">
                <li v-for="stop in DEBRIEF_TIMELINE" :key="stop.time" class="zt-debrief__stop">
                  <b class="zt-debrief__time">{{ stop.time }}</b>
                  <span>{{ stop.text }}</span>
                  <span v-if="stop.tag" class="zt-pill zt-debrief__chip" :class="stop.tone">{{
                    stop.tag
                  }}</span>
                </li>
              </ol>
            </div>
          </section>

          <section class="zt-debrief__panel">
            <h2 class="zt-display zt-debrief__title">Endless options, ticking clock</h2>
            <ol class="zt-debrief__problems">
              <li
                v-for="(problem, i) in DEBRIEF_PROBLEMS"
                :key="problem"
                class="zt-band zt-debrief__problem"
              >
                <b class="zt-display zt-debrief__problem-no">{{ i + 1 }}</b>
                <span>{{ problem }}</span>
              </li>
            </ol>
          </section>

          <div class="zt-debrief__close">
            <img
              class="zt-debrief__mark"
              src="/brand/zoot-badge-192.png"
              alt=""
              width="44"
              height="44"
            />
          </div>
        </div>
      </section>
    </main>
  </Teleport>
</template>

<style>
/* the overscroll
   Not scoped, because this rule belongs on <html> and no component style can
   reach it: the scoped attribute is only written onto elements this template
   renders. It is still route-local — `zt-story-route` is added and removed with
   the component, which is how story.css limits its own <html> rules too.

   Overscrolling at the end of this page has nothing useful to reveal. Past the
   bottom is the canvas the film is letterboxed against, which under the light
   theme is a dark bar appearing under a cream panel, and until syncStage() was
   taught to ignore the bounce it was a band of gate lounge. Past the top is the
   first frame of the film, which the stage is already showing. So the whole
   gesture is suppressed rather than styled: there is no state behind this page
   that a bounce is supposed to hint at. */
html.zt-story-route,
html.zt-story-route body {
  overscroll-behavior-y: none;
}
</style>

<style scoped>
/* the handoff
   The wrapper the closing copy is lifted and dissolved on, so that the engine
   can go on owning opacity and transform on the block outside it. Only the
   pre-paint state is here; syncHandoff() writes the rest every frame. */
.zt-handoff {
  will-change: transform, opacity;
}

/* the debrief
   Everything above this block is fixed to the viewport and the engine's spacer
   is empty, so the debrief is the only element on the page with a height of its
   own. It therefore travels: it slides up over the last frame of the film.

   Three things it cannot inherit, all of them consequences of sitting inside a
   page the flight has already dressed. It has to clear the copy layer or the
   finale would print through it. It has to paint its own ground, because the
   route hands the document the film's near-black canvas. And it has to restate
   its ink, since colour inherits as an already computed value and the page is
   set in the film's light ink.

   Shapes are the app's own (zt-card, zt-pill, zt-band, zt-display in
   view/styles/app.css), so this reads as the rest of Zoot rather than as a
   second design system. The names added here only describe arrangement. */
.zt-debrief {
  /* The yellow surfaces below are brand colours that stay put in dark mode, so
	   the ink on them must too. app.css exposes --zt-on-yellow for exactly this. */
  --zt-ink-fixed: var(--zt-on-yellow, #111111);
  position: relative;
  /* --sc-z-copy is the fixed copy layer. One above it, named rather than 21. */
  z-index: calc(var(--sc-z-copy, 20) + 1);
  background: var(--zt-bg);
  color: var(--zt-ink);
  font-family: var(--bs-body-font-family);
  font-size: 0.95rem;
  line-height: 1.5;
  border-top: var(--zt-bw) solid var(--zt-line);
}

.zt-debrief__inner {
  max-width: 68rem;
  margin-inline: auto;
  padding: clamp(2.5rem, 7vw, 4.5rem) clamp(1.25rem, 5vw, 3rem) clamp(3rem, 8vw, 5rem);
}

.zt-debrief__panel + .zt-debrief__panel {
  margin-top: clamp(2.5rem, 7vw, 4rem);
}

/* type */

.zt-debrief__title {
  margin: 0 0 1rem;
  font-size: clamp(2.2rem, 6vw, 3.4rem);
  text-wrap: balance;
}

/* The panel's one action, set level with the first heading rather than after
   the last band: the reader who is already sold should not have to travel the
   length of the argument to act on it. It wraps below the heading on a narrow
   screen, which keeps it above every word of that argument either way. */
.zt-debrief__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  /* Enough that the wrapped button does not read as a fourth tag pill below. */
  margin-bottom: 1.35rem;
}

/* The pair's spacing belongs to the row now, not to the heading inside it. */
.zt-debrief__header .zt-debrief__title {
  margin: 0;
}

.zt-debrief__text {
  margin: 0;
  font-weight: 500;
  text-wrap: pretty;
}

/* The pills come styled; these only place them. `__tag` is the oversized
   variant used as a claim, `__label` captions a block, `__chip` sits inline. */
.zt-debrief__tag {
  padding: 6px 16px;
  font-size: 0.82rem;
  border-width: var(--zt-bw);
}

.zt-debrief__label {
  margin-bottom: 0.75rem;
}

.zt-debrief__chip {
  margin-left: 0.5rem;
  vertical-align: middle;
}

/* what is zoot */

.zt-debrief__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.zt-debrief__features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.zt-debrief__feature {
  padding: 1.5rem;
}

.zt-debrief__icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  font-size: 1.5rem;
  color: var(--zt-ink-fixed);
  background: var(--zt-yellow);
  border: var(--zt-bw) solid var(--zt-line);
  border-radius: 50%;
}

.zt-debrief__feature-title {
  margin: 0.85rem 0 0.4rem;
  font-size: 1.05rem;
}

.zt-debrief__feature-text {
  margin: 0;
  color: var(--zt-muted);
}

/* sam */

.zt-debrief__persona {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 1.5rem;
  align-items: center;
  padding: 1.75rem;
  /* Stated, not inherited: the card is yellow in both app themes, so its ink
	   is the one colour on this page that never flips. */
  color: var(--zt-ink-fixed);
  background: var(--zt-yellow-soft);
  border: var(--zt-bw) solid var(--zt-ink-fixed);
  border-radius: 26px;
  box-shadow: 6px 6px 0 var(--zt-shadow-color);
}

.zt-debrief__title--persona {
  margin: 0.25rem 0 0.5rem;
  font-size: clamp(1.8rem, 4.4vw, 2.6rem);
}

.zt-debrief__timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.zt-debrief__stop {
  position: relative;
  padding: 0.65rem 0 0.65rem 1.25rem;
  font-weight: 500;
  border-left: 3px solid var(--zt-ink-fixed);
}

.zt-debrief__stop::before {
  content: '';
  position: absolute;
  top: 0.9rem;
  left: -9px;
  width: 15px;
  height: 15px;
  background: var(--zt-yellow);
  border: 3px solid var(--zt-ink-fixed);
  border-radius: 50%;
}

.zt-debrief__time {
  margin-right: 0.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

/* the problems */

.zt-debrief__problems {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.zt-debrief__problem {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.15rem;
  font-family: var(--zt-font-head);
  font-weight: 600;
  line-height: 1.25;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 var(--zt-shadow-color);
}

.zt-debrief__problem-no {
  min-width: 26px;
  font-size: 2.4rem;
  line-height: 1;
}

/* the close */

.zt-debrief__close {
  display: grid;
  justify-items: center;
  margin-top: clamp(2rem, 5vw, 3rem);
  text-align: center;
}

.zt-debrief__mark {
  width: 44px;
  height: 44px;
}

/* phones */

@media (max-width: 767px) {
  .zt-debrief__persona {
    grid-template-columns: 1fr;
    padding: 1.25rem;
  }
}
</style>
