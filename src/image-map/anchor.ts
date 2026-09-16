import { Place } from '../types';
import { CoordinateTransformer } from '../map/transformer';

/**
 * Image-space place anchor.
 * Applies place.markerMapOffsetX / place.markerMapOffsetY in map/image space pixels.
 * Strictly used for Custom Image Basemaps (Free-Image, Equirectangular, Calibrated).
 */
export function getPlaceImageAnchor(
  place: Place,
  transformer: CoordinateTransformer
): [number, number] | null {
  const pt = transformer.project(place.lon, place.lat, place);
  if (!pt) return null;

  const offX = place.markerMapOffsetX ?? place.manualOffsetX ?? 0;
  const offY = place.markerMapOffsetY ?? place.manualOffsetY ?? 0;

  return [pt[0] + offX, pt[1] + offY];
}
