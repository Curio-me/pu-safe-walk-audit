export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface SimpleRectBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Exact tilted polygon vertices for Panjab University Sector 14 Main Campus
 * Bounded by:
 * - NE: Madhya Marg (Gate No. 1 / PGI Chowk to Vidya Path corner)
 * - SE: Vidya Path (Sector 14 / Sector 15 dividing road, passing PU Gate No. 2 to Gate No. 3)
 * - SW: Dakshin Marg (dividing PU Sector 14 from PU Sector 25 South Campus)
 * - NW: Vigyan Path / Botanical Garden boundary road
 */
export const PU_SECTOR_14_POLYGON: LatLngLiteral[] = [
  { lat: 30.7680, lng: 76.7722 }, // North Corner: PU Gate No. 1 (Madhya Marg)
  { lat: 30.7596, lng: 76.7802 }, // East Corner: Madhya Marg & Vidya Path Junction
  { lat: 30.7580, lng: 76.7782 }, // PU Gate No. 2 (Vidya Path / Sec 14-15 Boundary)
  { lat: 30.7496, lng: 76.7664 }, // South Corner: PU Gate No. 3 (Vidya Path & Dakshin Marg)
  { lat: 30.7586, lng: 76.7568 }, // West Corner: Dakshin Marg & Vigyan Path (Botanical Garden)
];

/**
 * Exact tilted polygon vertices for Panjab University Sector 25 South Campus
 * (UIET, Dr. Harvansh Singh Judge Institute of Dental Sciences, Hostels 8, 9 & 10)
 * Bounded by:
 * - NE: Dakshin Marg
 * - SE: Vidya Path (dividing PU Sector 25 from Sector 24)
 * - SW: Sector 25 internal dividing road (south of UIET & Hostels 8-10)
 * - NW: Sector 25 West boundary road
 */
export const PU_SECTOR_25_POLYGON: LatLngLiteral[] = [
  { lat: 30.7496, lng: 76.7664 }, // East Corner: Dakshin Marg & Vidya Path (opp. Gate 3)
  { lat: 30.7428, lng: 76.7570 }, // South Corner: Vidya Path & Sector 25 South Campus boundary
  { lat: 30.7495, lng: 76.7478 }, // West Corner: Behind UIET / Boys Hostel 8
  { lat: 30.7586, lng: 76.7568 }, // North Corner: Dakshin Marg & West boundary
];

/**
 * Combined outer perimeter of the entire Panjab University Campus (Sector 14 + Sector 25)
 * traced clockwise so it can be used as an interior cutout hole in the Google Maps mask polygon
 * and for fast point-in-polygon testing.
 */
export const PU_WHOLE_CAMPUS_POLYGON: LatLngLiteral[] = [
  { lat: 30.7680, lng: 76.7722 }, // 1. North Corner (PU Gate No. 1, Madhya Marg)
  { lat: 30.7596, lng: 76.7802 }, // 2. East Corner (Madhya Marg & Vidya Path)
  { lat: 30.7580, lng: 76.7782 }, // 3. PU Gate No. 2 (Vidya Path — excludes Sector 15 to the SE)
  { lat: 30.7496, lng: 76.7664 }, // 4. PU Gate No. 3 (Dakshin Marg & Vidya Path)
  { lat: 30.7428, lng: 76.7570 }, // 5. South Corner of PU Sector 25 South Campus
  { lat: 30.7495, lng: 76.7478 }, // 6. West Corner of PU Sector 25 (UIET)
  { lat: 30.7586, lng: 76.7568 }, // 7. West Corner of PU Sector 14 (Botanical Garden / BH-7)
];

/**
 * Maximum allowed buffer distance outside Panjab University's perimeter (in meters)
 * where students can map dark spots on approach roads and surrounding areas.
 */
export const PU_OUTER_BUFFER_METERS = 500;

/**
 * Camera viewport bounds covering the entire Panjab University Campus (Sector 14 + Sector 25)
 * plus a 500-meter buffer (~0.0045° latitude, ~0.0052° longitude) outside the PU perimeter.
 */
export const PU_WHOLE_CAMPUS_BOUNDS: SimpleRectBox = {
  north: 30.7725, // 30.7680 (Gate 1) + 500m
  south: 30.7383, // 30.7428 (Sec 25 South boundary) - 500m
  east: 76.7854,  // 76.7802 (Madhya Marg / Vidya Path corner) + 500m
  west: 76.7426,  // 76.7478 (Sec 25 UIET West boundary) - 500m
};

export const PU_SECTOR_14_BOUNDS: SimpleRectBox = {
  north: 30.7725,
  south: 30.7451,
  east: 76.7854,
  west: 76.7516,
};

export const PU_SECTOR_25_BOUNDS: SimpleRectBox = {
  north: 30.7631,
  south: 30.7383,
  east: 76.7716,
  west: 76.7426,
};

/**
 * Ray-casting algorithm for exact Point-in-Polygon check.
 */
export function isPointInPolygon(
  point: LatLngLiteral,
  polygon: LatLngLiteral[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const METERS_PER_DEG_LAT = 111132; // at ~30.75° N (Chandigarh)
const METERS_PER_DEG_LNG = 95500;  // cos(30.75°) * 111320

/**
 * Calculates the shortest distance in meters from a point to a polygon's interior or boundary.
 * Returns 0 if the point is inside the polygon.
 */
export function distanceToPolygonMeters(
  point: LatLngLiteral,
  polygon: LatLngLiteral[]
): number {
  if (isPointInPolygon(point, polygon)) {
    return 0;
  }

  let minDistSq = Infinity;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = (polygon[j].lng - point.lng) * METERS_PER_DEG_LNG;
    const ay = (polygon[j].lat - point.lat) * METERS_PER_DEG_LAT;
    const bx = (polygon[i].lng - point.lng) * METERS_PER_DEG_LNG;
    const by = (polygon[i].lat - point.lat) * METERS_PER_DEG_LAT;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    }

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const distSq = projX * projX + projY * projY;

    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }

  return Math.sqrt(minDistSq);
}

/**
 * Checks whether a coordinate is inside Panjab University (Sector 14 Main Campus
 * or Sector 25 South Campus) OR within 500 meters outside the Panjab University perimeter.
 */
export function isInsidePUJurisdiction(point: LatLngLiteral | null | undefined): boolean {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return false;
  }
  return (
    distanceToPolygonMeters(point, PU_WHOLE_CAMPUS_POLYGON) <= PU_OUTER_BUFFER_METERS ||
    distanceToPolygonMeters(point, PU_SECTOR_14_POLYGON) <= PU_OUTER_BUFFER_METERS ||
    distanceToPolygonMeters(point, PU_SECTOR_25_POLYGON) <= PU_OUTER_BUFFER_METERS
  );
}

/**
 * Detects if a text label, address, or search query refers to a distant Chandigarh sector
 * well beyond the 500m perimeter buffer around Panjab University (Sectors 11, 12, 14, 15, 24, 25, 38
 * border PU within 500m and are validated via exact GPS distance).
 */
const DISTANT_SECTOR_REGEX =
  /\b(?:sector|sec)[\s-]*([1-9]|10|13|1[6-9]|2[0-3]|2[6-9]|3[0-7]|39|[4-9]\d)[a-d]?\b/i;

export function isOutsidePUSectorText(text: string | undefined | null): boolean {
  if (!text) return false;
  return DISTANT_SECTOR_REGEX.test(text);
}
