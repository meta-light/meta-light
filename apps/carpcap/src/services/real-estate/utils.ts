export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

function toRad(degrees: number): number {return degrees * (Math.PI / 180);}

export function isWithinRadius(pointLat: number, pointLon: number, centerLat: number, centerLon: number, radiusMiles: number): boolean {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
  return distance <= radiusMiles;
}