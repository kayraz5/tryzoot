import { writeFileSync } from 'node:fs'
import { test } from '../fixtures/harness.js'

const OUT = process.env.DUMP_OUT
const STOPS = [0, 0.12, 0.3, 0.52, 0.74, 0.93]
const PROPS = ['position', 'zIndex', 'maxWidth', 'textAlign', 'fontSize', 'lineHeight', 'letterSpacing',
  'left', 'right', 'top', 'bottom', 'objectFit', 'pointerEvents', 'backgroundColor', 'color',
  'fontFamily', 'overflowX', 'overflowY', 'willChange', 'marginTop', 'display', 'boxSizing']

test('dump deterministic layout of the story page', async ({ page }) => {
  test.slow()
  const dump = {}
  for (const [label, width] of [['desktop', 1280], ['phone', 600]]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const height = await page.evaluate(() => document.body.scrollHeight)
    dump[`${label}:scrollHeight`] = height
    for (const stop of STOPS) {
      await page.evaluate((y) => window.scrollTo(0, y), height * stop)
      await page.waitForTimeout(600)
      dump[`${label}@${stop}`] = await page.evaluate((props) => {
        const nodes = [document.documentElement, document.body,
          ...document.querySelectorAll('.sc-world, .sc-world__seg, .sc-world__poster, .sc-world__copy, .sc-world__spacer, .sc-copy, [data-sc-copy], .zt-scrim, .zt-h1, .zt-h2, .zt-lede, .zt-cta, video, img')]
        return nodes.map((el) => {
          const s = getComputedStyle(el)
          const style = {}
          for (const p of props) style[p] = s[p]
          return {
            id: `${el.tagName.toLowerCase()}.${el.className || ''}`.slice(0, 90),
            box: [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight],
            style
          }
        })
      }, PROPS)
    }
  }
  writeFileSync(OUT, JSON.stringify(dump, null, 1))
  console.log('wrote ' + OUT)
})
