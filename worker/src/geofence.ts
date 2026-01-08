// src/geofence.ts
import type { Env } from "./auth";

/**
 * Campus polygon coordinates will be plugged in here.
 * Placeholders now; TODO: replace with real polygon.
 */
const CAMPUS_POLYGON: [number, number][] = [
  // [lon, lat] points – example placeholder rectangle
  [80.0000, 13.0000],
  [80.0100, 13.0000],
  [80.0100, 12.9900],
  [80.0000, 12.9900],
  [80.0000, 13.0000],
];

function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi; // avoid div by 0

    if (intersect) inside = !inside;
  }
  return inside;
}

interface ClientCoords {
  lat: number;
  lon: number;
}

export function computeGeoVerified(
  request: Request & { cf?: any },
  clientCoords: ClientCoords | null
): number {
  // Primary: client coordinates
  if (clientCoords) {
    const { lat, lon } = clientCoords;
    if (isPointInPolygon([lon, lat], CAMPUS_POLYGON)) {
      return 1;
    }
  }

  // Fallback: Cloudflare IP geolocation (coarse)
  const cf = (request as any).cf;
  if (cf && cf.longitude && cf.latitude) {
    const lon = parseFloat(cf.longitude as string);
    const lat = parseFloat(cf.latitude as string);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      if (isPointInPolygon([lon, lat], CAMPUS_POLYGON)) {
        return 1;
      }
    }
  }

  // If all else fails – 0, but user can still sign up; admin may review.
  return 0;
}


