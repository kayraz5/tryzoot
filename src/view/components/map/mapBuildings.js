// EDITOR: MATTHEW

export const BUILDING_LAYERS = {
  flat: 'building',
  extruded: 'building-3d'
}

// Flat footprints stop at zoom 14 in the basemap; the quest map runs at 16-18.
const FLAT_ZOOM_RANGE = [13, 24]

/* Keep the flat layer visible at fill-opacity 0 rather than hiding it: MapLibre
   only prepares overzoomed features while a layer using them is visible during tile
   loading, so hiding it makes the flat style unrevealable at street zoom later. */
export function applyBuildingLayers(map, { visible, extruded }) {
  if (!map) return

  if (map.getLayer(BUILDING_LAYERS.flat)) {
    map.setLayerZoomRange(BUILDING_LAYERS.flat, ...FLAT_ZOOM_RANGE)
    map.setLayoutProperty(BUILDING_LAYERS.flat, 'visibility', 'visible')
    map.setPaintProperty(BUILDING_LAYERS.flat, 'fill-opacity', visible && !extruded ? 1 : 0)
  }

  if (map.getLayer(BUILDING_LAYERS.extruded)) {
    map.setLayoutProperty(
      BUILDING_LAYERS.extruded,
      'visibility',
      visible && extruded ? 'visible' : 'none'
    )
  }
}
