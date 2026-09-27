export type ZoomMode = 'DETAIL' | 'STRUCTURE' | 'OVERVIEW' | 'MAP';

export interface ZoomThresholds {
  readonly map: number;
  readonly mapHysteresis: number;
  readonly overview: number;
  readonly detail: number;
  readonly hysteresis: number;
}

export const DEFAULT_ZOOM_THRESHOLDS: ZoomThresholds = Object.freeze({
  map: 0.10,
  mapHysteresis: 0.01,
  overview: 0.25,
  detail: 0.60,
  hysteresis: 0.02,
});

const MODES: readonly ZoomMode[] = ['MAP', 'OVERVIEW', 'STRUCTURE', 'DETAIL'];

/** Pure state machine. Input is linear scale, never Canvas's log2 zoom. */
export function getZoomMode(
  zoom: number,
  previous: ZoomMode | null = null,
  thresholds: ZoomThresholds = DEFAULT_ZOOM_THRESHOLDS,
): ZoomMode {
  const { map, mapHysteresis, overview, detail, hysteresis } = thresholds;
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new RangeError('Zoom must be a finite positive scale.');
  }
  if (![map, mapHysteresis, overview, detail, hysteresis].every(Number.isFinite)
    || mapHysteresis < 0 || hysteresis < 0 || map <= mapHysteresis
    || map + mapHysteresis >= overview - hysteresis
    || overview + hysteresis >= detail - hysteresis) {
    throw new RangeError('Zoom thresholds must have separate positive bands.');
  }
  const boundaries = [
    { center: map, margin: mapHysteresis },
    { center: overview, margin: hysteresis },
    { center: detail, margin: hysteresis },
  ];
  if (previous === null) {
    const index = boundaries.findIndex(boundary => zoom <= boundary.center);
    return index < 0 ? 'DETAIL' : MODES[index]!;
  }
  let index = MODES.indexOf(previous);
  if (index < 0) throw new RangeError('Unknown previous zoom mode.');
  // Walk all crossed boundaries so a single sample can skip several modes.
  while (index < boundaries.length && zoom >= boundaries[index]!.center + boundaries[index]!.margin) index++;
  while (index > 0 && zoom <= boundaries[index - 1]!.center - boundaries[index - 1]!.margin) index--;
  return MODES[index]!;
}
