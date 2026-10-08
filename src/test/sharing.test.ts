import { describe, expect, it } from "vitest";
import {
  createWhatsAppShareUrl,
  findNearestCampusPlace,
  formatCurrentLocationMessage,
  formatDestinationMessage,
  formatRouteMessage,
  getGoogleMapsDirectionsUrl,
  getGoogleMapsPointUrl,
  getOpenStreetMapDirectionsUrl,
  getOpenStreetMapPointUrl,
  isValidCoordinate,
} from "@/lib/campus/sharing";
import { REF, rooms } from "@/lib/campus/data";

describe("Sharing Utilities", () => {
  describe("isValidCoordinate", () => {
    it("validates correct lat/lng pairs", () => {
      expect(isValidCoordinate(13.148828, 80.192063)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it("rejects out of bounds coordinates", () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
    });

    it("rejects non-numeric and null/undefined values", () => {
      expect(isValidCoordinate(null, 80)).toBe(false);
      expect(isValidCoordinate(13, undefined)).toBe(false);
      expect(isValidCoordinate(NaN, 80)).toBe(false);
      expect(isValidCoordinate(Infinity, 80)).toBe(false);
    });
  });

  describe("findNearestCampusPlace", () => {
    it("identifies nearest campus landmark close to REF coordinates", () => {
      const nearest = findNearestCampusPlace(REF.lat, REF.lng);
      expect(nearest).not.toBeNull();
      expect(nearest?.distanceMeters).toBeLessThan(100);
      expect(nearest?.isCampus).toBe(true);
    });

    it("handles off-campus coordinates gracefully", () => {
      // Point 50 km away
      const farPoint = findNearestCampusPlace(REF.lat + 0.5, REF.lng + 0.5);
      expect(farPoint).not.toBeNull();
      expect(farPoint?.isCampus).toBe(false);
      expect(farPoint?.distanceMeters).toBeGreaterThan(1500);
    });
  });

  describe("Map link generation", () => {
    it("generates correct Google Maps and OSM point URLs", () => {
      const gUrl = getGoogleMapsPointUrl(13.148828, 80.192063);
      expect(gUrl).toBe("https://www.google.com/maps?q=13.148828,80.192063");

      const osmUrl = getOpenStreetMapPointUrl(13.148828, 80.192063);
      expect(osmUrl).toContain("https://www.openstreetmap.org/?mlat=13.148828&mlon=80.192063#map=18/13.148828/80.192063");
    });

    it("generates walking directions URLs with valid points", () => {
      const gDir = getGoogleMapsDirectionsUrl(13.14, 80.19, 13.15, 80.2);
      expect(gDir).toContain("https://www.google.com/maps/dir/?api=1&origin=");
      expect(gDir).toContain("travelmode=walking");

      const osmDir = getOpenStreetMapDirectionsUrl(13.14, 80.19, 13.15, 80.2);
      expect(osmDir).toContain("https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot");
    });

    it("returns empty string for invalid coordinates", () => {
      expect(getGoogleMapsPointUrl(NaN, 80.19)).toBe("");
      expect(getGoogleMapsDirectionsUrl(95, 80, 13, 80)).toBe("");
    });
  });

  describe("WhatsApp click-to-chat URL", () => {
    it("properly formats and URL-encodes messages with wa.me format", () => {
      const msg = "Hello! Location: 13.1488, 80.1920 & more";
      const url = createWhatsAppShareUrl(msg);
      expect(url.startsWith("https://wa.me/?text=")).toBe(true);
      expect(url).toContain(encodeURIComponent(msg));
      expect(url).not.toContain(" ");
    });
  });

  describe("Message formatting", () => {
    it("formats real GPS location message", () => {
      const msg = formatCurrentLocationMessage({
        lat: 13.148828,
        lng: 80.192063,
        accuracy: 4.8,
        nearestPlace: { name: "Central Junction", distanceMeters: 5, isCampus: true },
      });
      expect(msg).toContain("📍 *My Current Location (VEC Campus Navigator)*");
      expect(msg).toContain("Central Junction (~5 m away)");
      expect(msg).toContain("13.148828, 80.192063");
      expect(msg).toContain("±5 m");
      expect(msg).toContain("https://www.google.com/maps?q=");
    });

    it("formats destination message", () => {
      const sampleRoom = rooms[0]!;
      const msg = formatDestinationMessage({
        room: sampleRoom,
        coordinates: { lat: 13.1489, lng: 80.1911 },
      });
      expect(msg).toContain(sampleRoom.code);
      expect(msg).toContain(sampleRoom.name);
      expect(msg).toContain(sampleRoom.buildingName);
      expect(msg).toContain("https://www.google.com/maps?q=");
    });

    it("formats route message with steps and note", () => {
      const sampleRoom = rooms[0]!;
      const msg = formatRouteMessage({
        originLabel: "Main Gate",
        originCoords: { lat: 13.147, lng: 80.192 },
        destRoom: sampleRoom,
        destCoords: { lat: 13.148, lng: 80.191 },
        distanceMeters: 140,
        etaMinutes: 2,
        instructions: ["Walk 80 m along Main road.", "Enter through the entrance."],
      });
      expect(msg).toContain("🚶 *Campus Walking Route*");
      expect(msg).toContain("From: Main Gate");
      expect(msg).toContain(sampleRoom.code);
      expect(msg).toContain("~140 m");
      expect(msg).toContain("1. Walk 80 m along Main road.");
      expect(msg).toContain("External map links guide you to the building");
      expect(msg).toContain("https://www.google.com/maps/dir/?api=1");
      expect(msg).toContain("https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot");
    });

    it("omits directions URLs when origin or destination coordinates are missing", () => {
      const sampleRoom = rooms[0]!;
      const msg = formatRouteMessage({
        originLabel: "Main Gate",
        destRoom: sampleRoom,
        distanceMeters: 140,
        etaMinutes: 2,
      });
      expect(msg).toContain("From: Main Gate");
      expect(msg).not.toContain("https://www.google.com/maps/dir");
      expect(msg).not.toContain("openstreetmap.org/directions");
    });

    it("includes destination map link when origin coordinates are missing but destCoords is provided", () => {
      const sampleRoom = rooms[0]!;
      const msg = formatRouteMessage({
        originLabel: "Main Gate",
        destRoom: sampleRoom,
        destCoords: { lat: 13.1486, lng: 80.1921 },
        distanceMeters: 140,
        etaMinutes: 2,
      });
      expect(msg).toContain("From: Main Gate");
      expect(msg).toContain("Destination coordinates: 13.148600, 80.192100");
      expect(msg).toContain("https://www.google.com/maps?q=13.148600,80.192100");
      expect(msg).toContain("https://www.openstreetmap.org/?mlat=13.148600&mlon=80.192100");
    });

    it("omits map links when destination coordinates are unavailable", () => {
      const sampleRoom = rooms[0]!;
      const msg = formatDestinationMessage({ room: sampleRoom });
      expect(msg).toContain(sampleRoom.code);
      expect(msg).not.toContain("https://www.google.com/maps?q=");
    });
  });
});
