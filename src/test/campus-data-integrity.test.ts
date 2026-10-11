import { describe, expect, it } from "vitest";
import {
  buildings,
  edges,
  nodes,
  rooms,
  startPoints,
  getCampusDataCoverage,
} from "@/lib/campus/data";
import { route } from "@/lib/campus/routing";

describe("Campus Data Integrity & Coverage Audit", () => {
  it("ensures every edge connects valid nodes that exist in nodes dictionary", () => {
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(nodes[e.a], `Edge ${e.id} start node ${e.a} must exist in nodes`).toBeDefined();
      expect(nodes[e.b], `Edge ${e.id} end node ${e.b} must exist in nodes`).toBeDefined();
      expect(e.length, `Edge ${e.id} length must be positive`).toBeGreaterThan(0);
    }
  });

  it("ensures all node coordinates are valid finite geographic coordinates", () => {
    const allNodes = Object.values(nodes);
    expect(allNodes.length).toBeGreaterThan(0);
    for (const n of allNodes) {
      expect(Number.isFinite(n.lat), `Node ${n.id} lat must be finite`).toBe(true);
      expect(Number.isFinite(n.lng), `Node ${n.id} lng must be finite`).toBe(true);
      expect(n.lat, `Node ${n.id} lat in range`).toBeGreaterThan(12);
      expect(n.lat, `Node ${n.id} lat in range`).toBeLessThan(14);
      expect(n.lng, `Node ${n.id} lng in range`).toBeGreaterThan(79);
      expect(n.lng, `Node ${n.id} lng in range`).toBeLessThan(81);
    }
  });

  it("ensures every room references an existing node in the graph", () => {
    expect(rooms.length).toBeGreaterThan(0);
    for (const r of rooms) {
      expect(nodes[r.nodeId], `Room ${r.code} nodeId ${r.nodeId} must exist`).toBeDefined();
      expect(r.building, `Room ${r.code} must have building id`).toBeTruthy();
      expect(r.buildingName, `Room ${r.code} must have building name`).toBeTruthy();
      expect(r.floor, `Room ${r.code} floor must be non-negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers all required campus buildings and landmarks", () => {
    const requiredBuildingIds = [
      "ak", // Abdul Kalam Block
      "kb", // Kirloskar Block
      "an", // Anna Auditorium
      "fcb", // Founder Chairman Block
      "vb", // Visvesvaraya Block
      "bg", // Bill Gates Block
      "rt", // Ratan Tata Block
      "temple", // Murugan Temple
      "canteen", // Campus Canteen
      "hostel_b", // Boys Hostel
      "hostel_g", // Girls Hostel
      "sports", // Sports Complex
      "restrooms_campus", // Central Restrooms
    ];

    const currentIds = buildings.map((b) => b.id);
    for (const reqId of requiredBuildingIds) {
      expect(currentIds, `Building ID ${reqId} must be registered`).toContain(reqId);
    }
  });

  it("ensures all building entrances are reachable from Main Gate", () => {
    for (const b of buildings) {
      const entranceId = `${b.id}-entrance`;
      expect(nodes[entranceId], `Entrance ${entranceId} must exist`).toBeDefined();

      const res = route("gate", entranceId, { accessible: false, closed: new Set() });
      expect(
        res,
        `Building ${b.name} entrance ${entranceId} must be reachable from gate`,
      ).not.toBeNull();
      expect(res!.distance).toBeGreaterThan(0);
    }
  });

  it("provides transparent data audit separating verified plans from provisional layouts", () => {
    const audit = getCampusDataCoverage();
    expect(audit.totalBuildings).toBeGreaterThanOrEqual(13);
    // 3 verified blocks: AK, KB, AN
    expect(audit.verifiedPlanBuildings).toBe(3);
    expect(audit.provisionalBuildings).toBeGreaterThanOrEqual(10);
    // Provisional blocks list should include FCB, Visvesvaraya, Bill Gates, etc.
    expect(audit.missingFloorPlans).toContain("FCB / Founder Chairman Block");
    expect(audit.missingFloorPlans).toContain("Bill Gates Block");
    expect(audit.missingFloorPlans).toContain("Campus Canteen");
  });

  it("includes all building entrances in start points selector", () => {
    const startPointIds = startPoints.map((s) => s.id);
    expect(startPointIds).toContain("gate");
    expect(startPointIds).toContain("hub");
    for (const b of buildings) {
      expect(startPointIds).toContain(`${b.id}-entrance`);
    }
  });
});
