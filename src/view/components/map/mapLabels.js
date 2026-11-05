// EDITOR: MATTHEW

// The only font stacks OpenFreeMap serves glyphs for; regular covers what bold does not.
const LABEL_FONTS = {
  bold: ['Noto Sans Bold', 'Noto Sans Regular'],
  italic: ['Noto Sans Italic', 'Noto Sans Regular']
}

const LABEL_THEMES = {
  theme: {
    ink: '#fff4c2',
    poi: '#ffe680',
    road: '#fff4c2',
    water: '#a9dcff',
    halo: '#111111',
    haloWidth: 2.2
  },
  simple: {
    ink: '#171717',
    poi: '#4b4432',
    road: '#2b2b2b',
    water: '#2e5a80',
    halo: '#fffdf4',
    haloWidth: 1.8
  }
}

const LABEL_SIZES = {
  poi: ['interpolate', ['linear'], ['zoom'], 14, 12, 17, 14, 19, 15],
  road: ['interpolate', ['linear'], ['zoom'], 12, 11, 15, 12.5, 18, 15],
  place: ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 12.5, 17, 14.5],
  water: ['interpolate', ['linear'], ['zoom'], 10, 13, 16, 15]
}

const PLACE_LAYERS = new Set(['airport', 'label_other', 'label_village', 'label_town'])

/** Returns null for layers to leave untouched (one-way arrows, road shields). */
function labelKind(layerId) {
  if (layerId.startsWith('water')) return 'water'
  if (layerId.startsWith('poi')) return 'poi'
  if (layerId.startsWith('highway-name')) return 'road'
  if (PLACE_LAYERS.has(layerId)) return 'place'
  if (layerId.startsWith('label_')) return 'heading'
  return null
}

export function applyMapLabelStyle(map, isDark) {
  if (!map?.isStyleLoaded()) return

  const theme = isDark ? LABEL_THEMES.theme : LABEL_THEMES.simple

  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue

    const kind = labelKind(layer.id)
    if (!kind) continue

// "place" and "heading" have no own colour and fall back to the base ink.
    const color = theme[kind] ?? theme.ink
    const size = LABEL_SIZES[kind]

    map.setLayoutProperty(layer.id, 'text-font', kind === 'water' ? LABEL_FONTS.italic : LABEL_FONTS.bold)
    if (size) map.setLayoutProperty(layer.id, 'text-size', size)
    map.setPaintProperty(layer.id, 'text-color', color)
    map.setPaintProperty(layer.id, 'text-halo-color', theme.halo)
    map.setPaintProperty(layer.id, 'text-halo-width', theme.haloWidth)
    map.setPaintProperty(layer.id, 'text-halo-blur', 0)
  }
}
