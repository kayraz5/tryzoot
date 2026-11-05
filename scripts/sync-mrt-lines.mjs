// EDITOR: MATTHEW
// pnpm sync:mrt-lines -> rewrites src/model/data/mrtLines.sg.json from cheeaun/sgraildata.
// Occasional manual run, not a live dependency; transit/mrt.js consumes the output.
import { writeFileSync } from 'node:fs'

const SOURCE_URL =
  'https://raw.githubusercontent.com/cheeaun/sgraildata/master/data/v1/sg-rail.geojson'
const OUT_FILE = new URL('../src/model/data/mrtLines.sg.json', import.meta.url)

// 'CG' (Changi branch) and 'CE' (Circle Line extension) are physically part of the
// East West / Circle Line tracks in this dataset, not separate lines.
const LINE_ALIASES = {
  'East West Line': ['EW', 'CG'],
  'North South Line': ['NS'],
  'North East Line': ['NE'],
  'Circle Line': ['CC', 'CE'],
  'Downtown Line': ['DT'],
  'Thomson-East Coast Line': ['TE']
}
// Sentosa Express ('SE') is outside this dataset - run by Sentosa Leisure Group, no
// geometry source found. transit/mrt.js handles that gap.
const KNOWN_GAP_CODES = ['SE']

const res = await fetch(SOURCE_URL)
if (!res.ok) {
  console.error(`[sync-mrt-lines] fetch failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const geo = await res.json()

const lines = {}
for (const f of geo.features) {
  if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue
  const codes = LINE_ALIASES[f.properties.name]
  if (!codes) continue
  const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
  for (const code of codes)
    lines[code] = { name: f.properties.name, color: f.properties.line_color, parts }
}

const expected = Object.values(LINE_ALIASES).flat()
const missing = expected.filter((code) => !lines[code])
if (missing.length)
  console.warn(
    `[sync-mrt-lines] no geometry found for: ${missing.join(', ')} (expected all of: ${expected.join(', ')})`
  )
console.warn(`[sync-mrt-lines] known gap, no source yet: ${KNOWN_GAP_CODES.join(', ')}`)

writeFileSync(OUT_FILE, JSON.stringify(lines, null, 2) + '\n')
console.log(
  `[sync-mrt-lines] wrote ${Object.keys(lines).length} line codes to ${OUT_FILE.pathname}`
)
