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
 * Inside, four things in order. The stage is one segment holding one clip,
 * because a single segment cannot have a seam; its poster carries the first
 * frame until the video can paint, and the scene stills behind it are what
 * reduced motion cross-dissolves instead of the film. The copy layer is fixed
 * above the stage and nothing in it scrolls. The spacer is last, empty, and the
 * only element in document flow — the engine sets its height.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

import './story.css'

const router = useRouter()

// ---------------------------------------------------------------- the film

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
 * colours in that scene. Portrait phones letterbox the 16:9 frame, and these
 * fill the space above and below it, so the fill matches the pixel row it
 * continues instead of showing an unrelated ground.
 */
const SCENES = [
	{ id: 'changi', startsAt: 0.0, skyColour: '#dcc49f', groundColour: '#968c87' }, // Changi T3
	{ id: 'rain', startsAt: 2.9, skyColour: '#5f656d', groundColour: '#4f545b' }, // the grey
	{ id: 'domes', startsAt: 7.1, skyColour: '#ddbf87', groundColour: '#444935' }, // the domes
	{ id: 'gate', startsAt: 12.3, skyColour: '#5d5959', groundColour: '#746355' } // Gate B14
]

/** Where a scene begins as a fraction of the scroll track (0 to 1). */
const sceneProgress = (i) => SCENES[i].startsAt / CLIP_SECONDS

// --------------------------------------------------------------- the beats

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
	{ id: 'terminal', anchor: 'trail', ground: 'light', scrim: 'corner', window: '0.118 0.182 0.3 0.22' },
	{ id: 'rain', anchor: 'lead', ground: 'dark', scrim: 'corner', window: '0.205 0.44 0.2 0.22' },
	{ id: 'clears', anchor: 'lead', ground: 'dark', scrim: 'corner', window: '0.485 0.78 0.2 0.2' },
	{ id: 'finale', anchor: 'center', ground: 'light', scrim: 'plate', window: '0.825 1 0.16 0', raised: true }
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

// ---------------------------------------------------------------- the view

const root = ref(null)
const currentScene = ref(0)

/** Elements cached at mount and then written to every frame. */
const dom = { stage: null, scrims: [], copy: [], stills: [] }

let engine = null
let engineStyles = null
let pendingFrame = 0
let prefersReducedMotion = false

/** How far through the flight we are, 0 to 1. */
function trackProgress() {
	const viewport = window.innerHeight || 1
	const scrolled = (window.scrollY - (root.value?.offsetTop ?? 0)) / viewport
	return Math.min(Math.max(scrolled / TRACK_VH, 0), 1)
}

/**
 * Track which scene we are in, so the letterbox fill above and below the frame
 * follows the film's own edge colours.
 *
 * Derived from scroll rather than from the engine's `sc:waypoint` event, because
 * that event only fires when the scene *changes*: scene one is already current
 * at the top of the page, so its colours would never be applied. Deriving it
 * also means reloading halfway down restores the right fill.
 */
function updateScene(progress) {
	let scene = 0
	for (let i = 0; i < SCENES.length; i++) {
		if (progress >= sceneProgress(i)) scene = i
	}

	if (scene !== currentScene.value) {
		currentScene.value = scene
		dom.stage?.style.setProperty('--zt-sky', SCENES[scene].skyColour)
		dom.stage?.style.setProperty('--zt-ground', SCENES[scene].groundColour)
	}
}

/**
 * Give every scrim its copy block's opacity.
 *
 * The scrims have to be siblings of the copy rather than children, because the
 * contrast check hides a copy block and everything inside it to photograph the
 * frame underneath. Mirroring the engine's own inline opacity keeps the two in
 * step without restating any window maths here.
 */
function syncScrims() {
	for (const { scrim, copy } of dom.scrims) {
		scrim.style.opacity = copy.style.opacity || '0'
	}
}

/**
 * Keep faded-out copy out of the tab order. The engine stops pointer events on
 * an invisible block but leaves it focusable, which otherwise let a keyboard
 * user reach the closing button from the top of the page.
 */
function syncFocusability() {
	for (const block of dom.copy) {
		const hidden = parseFloat(block.style.opacity || '0') <= 0.5
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
		still.style.opacity = Math.min(Math.max((progress - from) / fadeOver, 0), 1).toFixed(3)
	})
}

function render() {
	pendingFrame = 0
	const progress = trackProgress()
	updateScene(progress)
	syncScrims()
	syncFocusability()
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
		.map((scrim) => ({ scrim, copy: el.querySelector(`[data-zt-copy="${scrim.dataset.ztScrim}"]`) }))
		.filter(({ copy }) => copy)
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
	await import('./engine/scrollcraft.js')

	cacheElements()
	dom.stage.style.setProperty('--zt-sky', SCENES[0].skyColour)
	dom.stage.style.setProperty('--zt-ground', SCENES[0].groundColour)

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
					:class="[`zt-scrim--${beat.scrim}`, `zt-scrim--${beat.anchor}`, `zt-scrim--on${beat.ground}`]"
					:data-zt-scrim="beat.id"
					aria-hidden="true"
				></div>

				<div v-bind="beatAttrs('hero')">
					<img class="zt-wordmark" src="/brand/zoot-wordmark.png" alt="Zoot" width="581" height="282" />
					<h1 class="zt-h1">Eight hours in Singapore,<br />why waste time?</h1>
					<p class="zt-lede">Zoot helps you plan the day backwards from your boarding time, then walks you through it stop by stop, ensuring you reach back on time.</p>
					<button class="zt-cta" type="button" @click="router.push('/plan')">Start a layover</button>
				</div>

				<div v-bind="beatAttrs('terminal')">
					<h2 class="zt-h2">Most people spend it in the terminal.</h2>
					<p class="zt-lede">Not because there’s nothing out there to explore, but because they’re too afraid of missing their flight.</p>
				</div>

				<div v-bind="beatAttrs('rain')">
					<h2 class="zt-h2">What if it rains suddenly?</h2>
					<p class="zt-lede">Zoot got you all covered, the plan moves indoors instead of falling apart and delaying you.</p>
				</div>

				<div v-bind="beatAttrs('clears')">
					<h2 class="zt-h2 zt-h2--big">And then it clears.</h2>
					<p class="zt-lede">You walk into the ring around a stop, and then chop lands stamps and achievements in your passport.</p>
				</div>

				<div v-bind="beatAttrs('finale')">
					<h2 class="zt-h2">Back at the gate with 90 minutes to spare.</h2>
					<p class="zt-lede">Zoot refuses a plan that cuts it closer. That is the only promise it makes.</p>
					<div class="zt-pass">
						<div class="zt-pass__stub">
							<span class="zt-pass__key">Boarding</span>
							<b class="zt-pass__value">18:00</b>
						</div>
						<div class="zt-pass__main">
							<span class="zt-pass__key">Layover</span>
							<b class="zt-pass__value">Singapore · 8h</b>
						</div>
						<button class="zt-cta zt-cta--pass" type="button" @click="router.push('/plan')">Start a layover</button>
					</div>
				</div>
			</div>

			<div data-sc-spacer aria-hidden="true"></div>
		</main>
	</Teleport>
</template>
