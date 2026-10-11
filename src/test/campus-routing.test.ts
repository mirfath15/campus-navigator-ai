import { describe, expect, it } from "vitest";
import { nodes, rooms } from "@/lib/campus/data";
import { route, compare, ACCESSIBLE_UNAVAILABLE, type RouteOptions } from "@/lib/campus/routing";

describe("Campus Routing Engine", () => {
  const defaultOpts: RouteOptions = {
    accessible: false,
    closed: new Set<string>(),
  };

  it("calculates shortest path from Main Gate to Abdul Kalam Block room 860", () => {
    const room860 = rooms.find((r) => r.code === "860");
    expect(room860).toBeDefined();

    const res = route("gate", room860!.nodeId, defaultOpts);
    expect(res).not.toBeNull();
    expect(res!.path[0]).toBe("gate");
    expect(res!.path[res!.path.length - 1]).toBe(room860!.nodeId);
    expect(res!.distance).toBeGreaterThan(100);
    expect(res!.instructions.length).toBeGreaterThan(0);
  });

  it("calculates shortest path to Kirloskar Block and Anna Auditorium", () => {
    const kbRoom = rooms.find((r) => r.building === "kb" && r.code === "251");
    expect(kbRoom).toBeDefined();
    const resKb = route("gate", kbRoom!.nodeId, defaultOpts);
    expect(resKb).not.toBeNull();
    expect(resKb!.path.includes("kb-entrance")).toBe(true);

    const anRoom = rooms.find((r) => r.building === "an" && r.code === "1");
    expect(anRoom).toBeDefined();
    const resAn = route("gate", anRoom!.nodeId, defaultOpts);
    expect(resAn).not.toBeNull();
    expect(resAn!.path.includes("an-entrance")).toBe(true);
  });

  it("routes along designated walkways without cutting through Abdul Kalam Block to reach Anna Auditorium", () => {
    const anRoom = rooms.find((r) => r.building === "an" && r.code === "1");
    expect(anRoom).toBeDefined();

    const res = route("hub", anRoom!.nodeId, defaultOpts);
    expect(res).not.toBeNull();
    // Path must follow west walkway junctions south of the blocks
    expect(res!.path).toContain("j_west_1");
    expect(res!.path).toContain("j_west_2");
    expect(res!.path).toContain("an-entrance");
    // Path must NOT enter AK entrance or corridors when routing from hub to Anna Auditorium
    expect(res!.path).not.toContain("ak-entrance");
    expect(res!.path).not.toContain("ak-f0-stairs");
  });

  it("routes to newly mapped campus landmarks: Canteen, Temple, Sports, FCB, Visvesvaraya", () => {
    const canteen = rooms.find((r) => r.code === "CANTEEN");
    expect(canteen).toBeDefined();
    const resCanteen = route("gate", canteen!.nodeId, defaultOpts);
    expect(resCanteen).not.toBeNull();
    expect(resCanteen!.path).toContain("canteen-entrance");

    const temple = rooms.find((r) => r.code === "TEMPLE");
    expect(temple).toBeDefined();
    const resTemple = route("gate", temple!.nodeId, defaultOpts);
    expect(resTemple).not.toBeNull();
    expect(resTemple!.path).toContain("temple-entrance");

    const vBlock = rooms.find((r) => r.code === "913");
    expect(vBlock).toBeDefined();
    const resVb = route("gate", vBlock!.nodeId, defaultOpts);
    expect(resVb).not.toBeNull();
    expect(resVb!.path).toContain("vb-entrance");
  });

  it("accurately routes to Boys Hostel on the west side of campus matching verified OSM marker", () => {
    const boysHostel = rooms.find((r) => r.code === "BH-REC");
    expect(boysHostel).toBeDefined();
    expect(boysHostel!.building).toBe("hostel_b");

    const res = route("gate", boysHostel!.nodeId, defaultOpts);
    expect(res).not.toBeNull();
    expect(res!.path).toContain("hostel_b-entrance");
    expect(res!.path).toContain("j_west_bh");

    // Endpoint must be at the verified Boys Hostel location (lat ~13.1483, lng ~80.1908/80.1909)
    const endNode = nodes[res!.path[res!.path.length - 1]!];
    expect(endNode).toBeDefined();
    expect(Math.abs(endNode!.lat - 13.148343)).toBeLessThan(0.0001);
    expect(Math.abs(endNode!.lng - 80.190837)).toBeLessThan(0.0002);
  });

  it("accurately routes to Girls Hostel in the southwest matching verified OSM marker", () => {
    const girlsHostel = rooms.find((r) => r.code === "GH-REC");
    expect(girlsHostel).toBeDefined();
    expect(girlsHostel!.building).toBe("hostel_g");

    const res = route("gate", girlsHostel!.nodeId, defaultOpts);
    expect(res).not.toBeNull();
    expect(res!.path).toContain("hostel_g-entrance");
    expect(res!.path).toContain("j_gh");

    const endNode = nodes[res!.path[res!.path.length - 1]!];
    expect(endNode).toBeDefined();
    expect(Math.abs(endNode!.lat - 13.146933)).toBeLessThan(0.0001);
    expect(Math.abs(endNode!.lng - 80.191153)).toBeLessThan(0.0002);
  });

  it("handles same origin and same destination gracefully without errors", () => {
    const res = route("gate", "gate", defaultOpts);
    expect(res).not.toBeNull();
    expect(res!.distance).toBe(0);
    expect(res!.etaSeconds).toBe(0);
    expect(res!.path).toEqual(["gate"]);
    expect(res!.instructions).toContain("You are already at your destination.");
  });

  it("returns null safely for invalid or non-existent nodes without throwing", () => {
    const resInvalidFrom = route("non_existent_gate", "gate", defaultOpts);
    expect(resInvalidFrom).toBeNull();

    const resInvalidTo = route("gate", "non_existent_destination", defaultOpts);
    expect(resInvalidTo).toBeNull();
  });

  it("respects closed nodes and corridors", () => {
    const room860 = rooms.find((r) => r.code === "860")!;
    // Close the entrance to Abdul Kalam Block
    const closedOpts: RouteOptions = {
      accessible: false,
      closed: new Set(["ak-entrance"]),
    };
    const res = route("gate", room860.nodeId, closedOpts);
    expect(res).toBeNull();
  });

  it("supports accessible routes using lift in Anna Auditorium and denies inaccessible upper floors in blocks without lift", () => {
    // Anna Auditorium floor 1 room D1 (has elevator)
    const anUpperRoom = rooms.find((r) => r.building === "an" && r.floor === 1 && r.code === "D1");
    expect(anUpperRoom).toBeDefined();

    const accessibleOpts: RouteOptions = {
      accessible: true,
      closed: new Set(),
    };

    const resAn = route("gate", anUpperRoom!.nodeId, accessibleOpts);
    expect(resAn).not.toBeNull();
    // Must contain lift node
    expect(resAn!.path.some((nodeId) => nodeId.includes("lift"))).toBe(true);

    // Abdul Kalam Block floor 1 room 864 (no elevator)
    const akUpperRoom = rooms.find((r) => r.building === "ak" && r.floor === 1 && r.code === "864");
    expect(akUpperRoom).toBeDefined();

    const resAk = route("gate", akUpperRoom!.nodeId, accessibleOpts);
    expect(resAk).toBeNull(); // Accessible route impossible
  });

  it("ensures A* and Dijkstra parity in shortest distance", () => {
    const targetRoom = rooms.find((r) => r.code === "863")!;
    const astar = route("gate", targetRoom.nodeId, defaultOpts, "astar");
    const dijkstra = route("gate", targetRoom.nodeId, defaultOpts, "dijkstra");

    expect(astar).not.toBeNull();
    expect(dijkstra).not.toBeNull();
    expect(Math.round(astar!.distance)).toBe(Math.round(dijkstra!.distance));
  });

  it("runs comparison function without exceptions even with closures", () => {
    const room860 = rooms.find((r) => r.code === "860")!;
    const cmp = compare("gate", room860.nodeId, defaultOpts);
    expect(cmp.astar.res).not.toBeNull();
    expect(cmp.dijkstra.res).not.toBeNull();
    expect(cmp.astar.avgMs).toBeGreaterThanOrEqual(0);
  });
});
