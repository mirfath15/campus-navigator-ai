import { buildings, floorName, haversine, nodes, type Room } from "./data";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GpsLocationResult {
  coords: Coordinates;
  accuracy: number;
  timestamp: number;
  nearestPlace?: {
    name: string;
    distanceMeters: number;
    isCampus: boolean;
  };
}

/**
 * Validates that latitude and longitude are valid finite numbers within real earth ranges.
 */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Finds the nearest campus building or major landmark to a set of coordinates.
 */
export function findNearestCampusPlace(lat: number, lng: number): {
  name: string;
  distanceMeters: number;
  isCampus: boolean;
} | null {
  if (!isValidCoordinate(lat, lng)) return null;

  const target = { lat, lng };
  let closestName = "";
  let minDistance = Infinity;

  // Check buildings
  for (const b of buildings) {
    const dist = haversine(target, { lat: b.lat, lng: b.lng });
    if (dist < minDistance) {
      minDistance = dist;
      closestName = b.name;
    }
  }

  // Check key nodes (gate, hub, entrances)
  for (const node of Object.values(nodes)) {
    if (node.kind === "gate" || node.kind === "entrance" || node.kind === "junction") {
      const dist = haversine(target, { lat: node.lat, lng: node.lng });
      if (dist < minDistance) {
        minDistance = dist;
        closestName = node.label;
      }
    }
  }

  if (minDistance === Infinity) return null;

  const roundedDistance = Math.round(minDistance);
  // If within ~1.5 km of VEC landmarks, consider it campus proximity
  const isCampus = roundedDistance <= 1500;

  return {
    name: closestName,
    distanceMeters: roundedDistance,
    isCampus,
  };
}

/**
 * Generates an OpenStreetMap URL for a single coordinate point.
 */
export function getOpenStreetMapPointUrl(lat: number, lng: number, zoom = 18): string {
  if (!isValidCoordinate(lat, lng)) return "";
  const fLat = lat.toFixed(6);
  const fLng = lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${fLat}&mlon=${fLng}#map=${zoom}/${fLat}/${fLng}`;
}

/**
 * Generates a Google Maps URL for a single coordinate point.
 */
export function getGoogleMapsPointUrl(lat: number, lng: number): string {
  if (!isValidCoordinate(lat, lng)) return "";
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Generates a Google Maps walking directions URL between two valid coordinates.
 */
export function getGoogleMapsDirectionsUrl(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  if (!isValidCoordinate(fromLat, fromLng) || !isValidCoordinate(toLat, toLng)) return "";
  const origin = `${fromLat.toFixed(6)},${fromLng.toFixed(6)}`;
  const destination = `${toLat.toFixed(6)},${toLng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

/**
 * Generates an OpenStreetMap walking directions URL between two valid coordinates.
 */
export function getOpenStreetMapDirectionsUrl(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  if (!isValidCoordinate(fromLat, fromLng) || !isValidCoordinate(toLat, toLng)) return "";
  const fromStr = `${fromLat.toFixed(6)},${fromLng.toFixed(6)}`;
  const toStr = `${toLat.toFixed(6)},${toLng.toFixed(6)}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(`${fromStr};${toStr}`)}`;
}

/**
 * Generates the official WhatsApp click-to-chat URL with properly encoded message.
 * https://wa.me/?text=ENCODED_MESSAGE
 */
export function createWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Formats a friendly message for sharing current real device GPS location.
 */
export function formatCurrentLocationMessage(params: {
  lat: number;
  lng: number;
  accuracy?: number;
  nearestPlace?: { name: string; distanceMeters: number; isCampus: boolean } | null;
}): string {
  const { lat, lng, accuracy, nearestPlace } = params;
  const fLat = lat.toFixed(6);
  const fLng = lng.toFixed(6);

  let landmarkText = "";
  if (nearestPlace) {
    if (nearestPlace.isCampus) {
      landmarkText = `🏷️ Nearest campus spot: ${nearestPlace.name} (~${nearestPlace.distanceMeters} m away)\n`;
    } else {
      const km = (nearestPlace.distanceMeters / 1000).toFixed(1);
      landmarkText = `🏷️ Proximity: ~${km} km from Velammal Engineering College (${nearestPlace.name})\n`;
    }
  }

  const accuracyText = accuracy ? ` (GPS accuracy: ±${Math.round(accuracy)} m)` : "";

  return [
    `📍 *My Current Location (VEC Campus Navigator)*`,
    landmarkText.trim(),
    `📌 Coordinates: ${fLat}, ${fLng}${accuracyText}`,
    `🗺️ Google Maps: ${getGoogleMapsPointUrl(lat, lng)}`,
    `🗺️ OpenStreetMap: ${getOpenStreetMapPointUrl(lat, lng)}`,
    ``,
    `_Shared from Campus Navigator AI — Velammal Engineering College, Chennai._`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Formats a friendly message for sharing a selected campus destination.
 */
export function formatDestinationMessage(params: {
  room: Room;
  coordinates?: Coordinates | null;
}): string {
  const { room, coordinates } = params;
  const hasCoords = coordinates && isValidCoordinate(coordinates.lat, coordinates.lng);

  const lines = [
    `🏛️ *Campus Destination: ${room.code} · ${room.name}*`,
    `🏢 Building: ${room.buildingName}`,
    `📍 Location: ${floorName(room.floor)}${room.dept ? ` (${room.dept} Dept)` : ""}`,
  ];

  if (room.note) {
    lines.push(`ℹ️ Note: ${room.note}`);
  }

  if (hasCoords) {
    lines.push(
      `📌 Coordinates: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`,
      `🗺️ Google Maps: ${getGoogleMapsPointUrl(coordinates.lat, coordinates.lng)}`,
      `🗺️ OpenStreetMap: ${getOpenStreetMapPointUrl(coordinates.lat, coordinates.lng)}`,
    );
  }

  lines.push(
    ``,
    `_Search rooms & get walking directions at Campus Navigator AI (VEC)_`,
  );

  return lines.join("\n");
}

/**
 * Formats a friendly message for sharing a navigation route.
 */
export function formatRouteMessage(params: {
  originLabel: string;
  originCoords?: Coordinates | null;
  destRoom: Room;
  destCoords?: Coordinates | null;
  distanceMeters: number;
  etaMinutes: number;
  instructions?: string[];
}): string {
  const {
    originLabel,
    originCoords,
    destRoom,
    destCoords,
    distanceMeters,
    etaMinutes,
    instructions,
  } = params;

  const hasBothCoords =
    originCoords &&
    destCoords &&
    isValidCoordinate(originCoords.lat, originCoords.lng) &&
    isValidCoordinate(destCoords.lat, destCoords.lng);

  const lines = [
    `🚶 *Campus Walking Route*`,
    `🚩 From: ${originLabel}`,
    `🎯 To: ${destRoom.code} · ${destRoom.name} (${destRoom.buildingName}, ${floorName(destRoom.floor)})`,
    `📏 Distance: ~${Math.round(distanceMeters)} m (approx. ${Math.max(1, etaMinutes)} min walk)`,
  ];

  if (hasBothCoords) {
    lines.push(
      `🗺️ Outdoor walking directions (Google Maps): ${getGoogleMapsDirectionsUrl(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)}`,
      `🗺️ Outdoor walking directions (OpenStreetMap): ${getOpenStreetMapDirectionsUrl(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)}`,
    );
  } else if (destCoords && isValidCoordinate(destCoords.lat, destCoords.lng)) {
    lines.push(
      `📌 Destination coordinates: ${destCoords.lat.toFixed(6)}, ${destCoords.lng.toFixed(6)}`,
      `🗺️ Destination map (Google Maps): ${getGoogleMapsPointUrl(destCoords.lat, destCoords.lng)}`,
      `🗺️ Destination map (OpenStreetMap): ${getOpenStreetMapPointUrl(destCoords.lat, destCoords.lng)}`,
    );
  }

  if (instructions && instructions.length > 0) {
    lines.push(``, `*Step-by-step route:*`);
    // Include up to first 6 key steps so WhatsApp message is clean and readable
    const stepsToShow = instructions.slice(0, 6);
    stepsToShow.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    if (instructions.length > 6) {
      lines.push(`...and ${instructions.length - 6} more steps inside the app.`);
    }
  }

  lines.push(
    ``,
    `*Note on routing:* External map links guide you to the building. Step-by-step indoor walking paths are provided inside Campus Navigator AI.`,
    `_Shared from Campus Navigator AI · Velammal Engineering College._`,
  );

  return lines.join("\n");
}
