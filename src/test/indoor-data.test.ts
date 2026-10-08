import { describe, expect, it } from "vitest";
import { buildings, nodes, edges, rooms, N, startPoints } from "@/lib/campus/data";
import { route } from "@/lib/campus/routing";
import { parse, searchRooms } from "@/lib/campus/assistant";

describe("Indoor Data Integration", () => {
  it("includes all 5 campus buildings including FCB Block and Visvesvaraya Block", () => {
    const buildingIds = buildings.map((b) => b.id);
    expect(buildingIds).toContain("ak");
    expect(buildingIds).toContain("kb");
    expect(buildingIds).toContain("an");
    expect(buildingIds).toContain("fcb");
    expect(buildingIds).toContain("vb");
  });

  it("has unique IDs for every room and node with zero collisions", () => {
    const roomIds = new Set<string>();
    for (const r of rooms) {
      expect(roomIds.has(r.id)).toBe(false);
      roomIds.add(r.id);
      expect(nodes[r.nodeId]).toBeDefined();
    }

    const nodeIds = Object.keys(nodes);
    const uniqueNodeIds = new Set(nodeIds);
    expect(nodeIds.length).toBe(uniqueNodeIds.size);
  });

  it("contains all specified rooms and labs in Founder Chairman Block (FCB)", () => {
    const fcbRooms = rooms.filter((r) => r.building === "fcb");
    expect(fcbRooms.length).toBeGreaterThanOrEqual(14);

    const fcbCodes = fcbRooms.map((r) => r.code);
    expect(fcbCodes).toContain("401"); // Civil Lab 1
    expect(fcbCodes).toContain("402"); // Civil Lab 2
    expect(fcbCodes).toContain("403"); // Civil Lab 3
    expect(fcbCodes).toContain("503"); // Civil IV Year - C
    expect(fcbCodes).toContain("MSR"); // Mathematics Staff Room
    expect(fcbCodes).toContain("201"); // CSE-A
    expect(fcbCodes).toContain("202"); // CSE-B
    expect(fcbCodes).toContain("203"); // CSE-C
    expect(fcbCodes).toContain("501"); // Civil IV Year-A
    expect(fcbCodes).toContain("502"); // Civil IV Year-B
    expect(fcbCodes).toContain("301"); // IT-A
    expect(fcbCodes).toContain("302"); // IT-B
    expect(fcbCodes).toContain("CSR"); // Chemistry Staff Room

    // Floors 0, 1, 2, 3 represented
    const fcbFloors = new Set(fcbRooms.map((r) => r.floor));
    expect(fcbFloors.has(0)).toBe(true);
    expect(fcbFloors.has(1)).toBe(true);
    expect(fcbFloors.has(2)).toBe(true);
    expect(fcbFloors.has(3)).toBe(true);
  });

  it("contains all specified rooms and labs in Visvesvaraya Block (VB)", () => {
    const vbRooms = rooms.filter((r) => r.building === "vb");
    expect(vbRooms.length).toBeGreaterThanOrEqual(30);

    const vbCodes = vbRooms.map((r) => r.code);
    expect(vbCodes).toContain("601");
    expect(vbCodes).toContain("602");
    expect(vbCodes).toContain("701");
    expect(vbCodes).toContain("702");
    expect(vbCodes).toContain("801");
    expect(vbCodes).toContain("901");
    expect(vbCodes).toContain("821");
    expect(vbCodes).toContain("411");
    expect(vbCodes).toContain("101");
    expect(vbCodes).toContain("121");
    expect(vbCodes).toContain("911");
    expect(vbCodes).toContain("913");
    expect(vbCodes).toContain("914");
    expect(vbCodes).toContain("LB1"); // Comm Lab 1
    expect(vbCodes).toContain("LB2"); // Comm Lab 2

    // Floors 0, 1, 2, 3, 4 represented
    const vbFloors = new Set(vbRooms.map((r) => r.floor));
    expect(vbFloors.has(0)).toBe(true);
    expect(vbFloors.has(1)).toBe(true);
    expect(vbFloors.has(2)).toBe(true);
    expect(vbFloors.has(3)).toBe(true);
    expect(vbFloors.has(4)).toBe(true);

    // EEE 1st Year D room 914 is present and flagged requires_confirmation
    const room914 = vbRooms.find((r) => r.code === "914");
    expect(room914).toBeDefined();
    expect(room914?.status).toBe("requires_confirmation");
  });

  it("connects all FCB and Visvesvaraya Block rooms to outdoor entrance and main gate", () => {
    // Route from Main Gate to FCB Civil Lab 1 (Floor 0)
    const civilLab = rooms.find((r) => r.building === "fcb" && r.code === "401")!;
    const r1 = route("gate", civilLab.nodeId, { accessible: false, closed: new Set() });
    expect(r1).not.toBeNull();
    expect(r1!.path.length).toBeGreaterThan(3);
    expect(r1!.distance).toBeGreaterThan(0);
    expect(r1!.instructions.length).toBeGreaterThan(0);

    // Route from Main Gate to FCB 3rd Floor IT-A (Floor 3 via stairs)
    const fcbTop = rooms.find((r) => r.building === "fcb" && r.code === "301")!;
    const r2 = route("gate", fcbTop.nodeId, { accessible: false, closed: new Set() });
    expect(r2).not.toBeNull();
    expect(r2!.instructions.some((inst) => inst.includes("stairs"))).toBe(true);

    // Route from Main Gate to Visvesvaraya Block Floor 4 Communication Lab
    const commLab = rooms.find((r) => r.building === "vb" && r.code === "LB1")!;
    const r3 = route("gate", commLab.nodeId, { accessible: false, closed: new Set() });
    expect(r3).not.toBeNull();
    expect(r3!.instructions.some((inst) => inst.includes("stairs"))).toBe(true);
  });

  it("searches and parses queries for newly added rooms in FCB and Visvesvaraya Block", () => {
    const fcbMatches = searchRooms("Founder Chairman");
    expect(fcbMatches.length).toBeGreaterThanOrEqual(14);

    const vbMatches = searchRooms("Visvesvaraya");
    expect(vbMatches.length).toBeGreaterThanOrEqual(30);

    const lab401 = searchRooms("401");
    expect(lab401.length).toBe(1);
    expect(lab401[0]?.name).toBe("Civil Lab 1");

    const lab914 = searchRooms("914");
    expect(lab914.length).toBe(1);
    expect(lab914[0]?.name).toContain("EEE 1st Year");

    // Assistant intent parsing
    const intent1 = parse("Take me to room 401");
    expect(intent1.type).toBe("navigate");
    if (intent1.type === "navigate") {
      expect(intent1.room.code).toBe("401");
    }

    const intent2 = parse("Where is Civil Lab 2");
    expect(intent2.type === "navigate" || intent2.type === "search").toBe(true);
  });

  it("handles accessible mode: ground floor works, multi-floor without lift is rejected", () => {
    // FCB ground floor room has no stairs needed
    const fcbGround = rooms.find((r) => r.building === "fcb" && r.floor === 0)!;
    const rGround = route("fcb-entrance", fcbGround.nodeId, { accessible: true, closed: new Set() });
    expect(rGround).not.toBeNull();

    // FCB floor 3 room requires stairs; since FCB has no lift, accessible mode returns null
    const fcbTop = rooms.find((r) => r.building === "fcb" && r.floor === 3)!;
    const rTop = route("fcb-entrance", fcbTop.nodeId, { accessible: true, closed: new Set() });
    expect(rTop).toBeNull();
  });
});
