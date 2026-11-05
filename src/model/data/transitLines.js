// EDITOR: KAYRA
/**
 * How each rail line is named and coloured for travellers. Station order and positions
 * live in mrtNetwork.sg.json (pnpm sync:transit); this file is the hand-written part.
 * Names and colours are LTA's official ones, so directions and the map match station signage.
 * The Changi branch is signed as part of the East West Line, so it shares that name.
 * `loop` lines have no single terminus, so directions name the next stop instead.
 */
export const LINES = {
  NS: { name: 'North South Line', hex: '#d42e12' },
  EW: { name: 'East West Line', hex: '#009645' },
  CG: { name: 'East West Line', hex: '#009645' },
  NE: { name: 'North East Line', hex: '#9900aa' },
  CC: { name: 'Circle Line', hex: '#fa9e0d', loop: true },
  CE: { name: 'Circle Line', hex: '#fa9e0d' },
  DT: { name: 'Downtown Line', hex: '#005ec4' },
  TE: { name: 'Thomson-East Coast Line', hex: '#9d5b25' },
  SE: { name: 'Sentosa Express', hex: '#e2006a' }
}

export const BUS_HEX = '#2b9cff'
export const WALK_HEX = '#ff1dce' // the map's route pink; walking stays the "follow me" colour
