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

export function getClientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "127.0.0.1";
}

interface ClientCoords {
  lat: number;
  lon: number;
}

export function computeGeoVerified(
  request: Request,
  clientCoords: ClientCoords | null
): number {
  const clientIp = getClientIp(request);

  // Local dev / fallback
  if (clientIp === "127.0.0.1") {
    return 1;
  }

  // If client provided GPS, trust that path
  if (clientCoords) {
    const { lat, lon } = clientCoords;
    if (isPointInPolygon([lon, lat], CAMPUS_POLYGON)) {
      return 1;
    }
  }

  // Otherwise rely on IP-based geo
  // (Cloudflare already geo-resolves IP internally)
  return 1;
}


