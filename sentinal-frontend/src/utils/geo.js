// A real lookup instead of a binary RU/China guess.
// Extend this as you add more allowed_territory / location codes.
export const COUNTRY_COORDS = {
  RU: { lat: 61.5240, lng: 105.3188 },
  CN: { lat: 35.8617, lng: 104.1954 },
  US: { lat: 37.0902, lng: -95.7129 },
  IN: { lat: 20.5937, lng: 78.9629 },
  BR: { lat: -14.2350, lng: -51.9253 },
  DE: { lat: 51.1657, lng: 10.4515 },
  GB: { lat: 55.3781, lng: -3.4360 },
  FR: { lat: 46.2276, lng: 2.2137 },
  JP: { lat: 36.2048, lng: 138.2529 },
  AU: { lat: -25.2744, lng: 133.7751 },
  CA: { lat: 56.1304, lng: -106.3468 },
  ZA: { lat: -30.5595, lng: 22.9375 },
  MX: { lat: 23.6345, lng: -102.5528 },
  IT: { lat: 41.8719, lng: 12.5674 },
  ES: { lat: 40.4637, lng: -3.7492 },
  KR: { lat: 35.9078, lng: 127.7669 },
  SG: { lat: 1.3521, lng: 103.8198 },
  UNKNOWN: null,
};

export function getCoordsForLocation(code) {
  return COUNTRY_COORDS[code?.toUpperCase()] ?? null;
}
