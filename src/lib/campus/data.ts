// Campus data for Velammal Engineering College (VEC), Chennai.
// Room names/numbers/floors come from the supplied handwritten floor plans.
// Building placement is approximate and every indoor coordinate is a placeholder
// (status "requires_confirmation") until an admin places it in a floor-plan editor.

export type Status = "verified" | "unverified" | "requires_confirmation";
export type NodeKind = "gate" | "junction" | "entrance" | "corridor" | "room" | "stairs" | "lift";
export type EdgeKind = "outdoor" | "entrance" | "corridor" | "door" | "stairs" | "lift";

export interface GNode {
  id: string;
  label: string;
  kind: NodeKind;
  lat: number;
  lng: number;
  building?: string;
  floor?: number;
  status: Status;
}

export interface Edge {
  id: string;
  a: string;
  b: string;
  kind: EdgeKind;
  length: number; // metres
  status: Status;
  label: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  building: string;
  buildingName: string;
  floor: number;
  type: string;
  dept?: string | undefined;
  nodeId: string;
  status: Status;
  note?: string | undefined;
}

export interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hasLift: boolean;
  status: Status;
}

export const REF = { lat: 13.148828, lng: 80.192063 };

type RoomDef = [code: string, name: string, type: string, dept?: string];

const BUILDING_DEFS: (Building & { floors: RoomDef[][] })[] = [
  {
    id: "ak",
    name: "Abdul Kalam Block",
    lat: REF.lat + 0.00013,
    lng: REF.lng - 0.0009,
    hasLift: false,
    status: "unverified",
    floors: [
      [
        ["868", "Girls Restroom", "restroom"],
        ["860", "Second Year IT A Section Classroom", "classroom", "IT"],
        ["861", "Second Year IT B Section Classroom", "classroom", "IT"],
        ["871", "Third Year IT A Classroom", "classroom", "IT"],
      ],
      [
        ["869", "Lab-1", "lab", "IT"],
        ["862", "Third Year IT B Classroom", "classroom", "IT"],
        ["863", "Final Year IT A Section Classroom", "classroom", "IT"],
        ["864", "Lab-2", "lab", "IT"],
      ],
      [
        ["870", "Boys Restroom", "restroom"],
        ["865", "Staffroom-1, IT Department", "staffroom", "IT"],
        ["866", "Staffroom-2, IT Department", "staffroom", "IT"],
        ["867", "MBA Department Classroom", "classroom", "MBA"],
      ],
    ],
  },
  {
    id: "kb",
    name: "Kirloskar Block",
    lat: REF.lat + 0.00042,
    lng: REF.lng + 0.00025,
    hasLift: false,
    status: "unverified",
    floors: [
      [
        ["LB1", "Mechanical Lab 1", "lab", "Mechanical"],
        ["LB2", "Mechanical Lab 2", "lab", "Mechanical"],
      ],
      [
        ["251", "CSE-CS First Year A Classroom", "classroom", "CSE-CS"],
        ["252", "CSE-CS First Year B Classroom", "classroom", "CSE-CS"],
        ["253", "CSE-CS Second Year A Classroom", "classroom", "CSE-CS"],
        ["COE", "COE Office", "office"],
      ],
      [
        ["DSR", "CSE-CS Staff Room", "staffroom", "CSE-CS"],
        ["254", "CSE-CS Third Year A Classroom", "classroom", "CSE-CS"],
        ["255", "CSE-CS Third Year A Classroom", "classroom", "CSE-CS"],
        ["256", "CSE-CS Third Year B Classroom", "classroom", "CSE-CS"],
        ["GR", "Girls Restroom", "restroom"],
      ],
    ],
  },
  {
    id: "an",
    name: "Anna Auditorium",
    lat: REF.lat + 0.00029,
    lng: REF.lng - 0.00113,
    hasLift: true,
    status: "unverified",
    floors: [
      [
        ["GR", "Girls Restroom", "restroom"],
        ["1", "Thermal Lab", "lab", "Mechanical"],
        ["2", "Mechanical Lab", "lab", "Mechanical"],
        ["3", "EEE Lab", "lab", "EEE"],
        ["AIDS Lab 1", "AIDS Lab 1", "lab", "AI & DS"],
      ],
      [
        ["BR", "Boys Restroom", "restroom"],
        ["D1", "Door 1", "door"],
        ["D2", "Door 2", "door"],
        ["D3", "Door 3", "door"],
        ["AIDS Lab 2", "AIDS Lab 2", "lab", "AI & DS"],
      ],
    ],
  },
];

const R = 6371000;
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const nodes: Record<string, GNode> = {};
export const edges: Edge[] = [];
export const rooms: Room[] = [];
export const buildings: Building[] = BUILDING_DEFS.map(({ floors: _f, ...b }) => b);

export function N(id: string): GNode {
  const n = nodes[id];
  if (!n) throw new Error(`Unknown node ${id}`);
  return n;
}

function addNode(n: GNode) {
  nodes[n.id] = n;
  return n;
}
function addEdge(a: string, b: string, kind: EdgeKind, status: Status, label: string, fixedLength?: number) {
  const length = fixedLength ?? Math.max(1, haversine(N(a), N(b)));
  edges.push({ id: `${a}~${b}`, a, b, kind, length, status, label });
}

const STEP = 0.00005; // placeholder spacing along a corridor
const FLOOR_HEIGHT_STAIRS = 12; // metres of walking per flight (estimate)
const LIFT_LENGTH = 4;

// Outdoor network (approximate; verify against OpenStreetMap before marking verified)
addNode({ id: "gate", label: "Main Gate", kind: "gate", lat: REF.lat - 0.0011, lng: REF.lng + 0.0001, status: "unverified" });
addNode({ id: "hub", label: "Central Junction", kind: "junction", lat: REF.lat, lng: REF.lng, status: "unverified" });
addEdge("gate", "hub", "outdoor", "unverified", "Main road");

for (const b of BUILDING_DEFS) {
  const junction = addNode({
    id: `${b.id}-j`, label: `${b.name} approach`, kind: "junction",
    lat: b.lat - 0.00018, lng: b.lng - 0.00005, status: "unverified",
  });
  addEdge("hub", junction.id, "outdoor", "unverified", `Path to ${b.name}`);
  addNode({
    id: `${b.id}-entrance`, label: `${b.name} entrance`, kind: "entrance", building: b.id, floor: 0,
    lat: b.lat - 0.0001, lng: b.lng - 3 * STEP, status: "requires_confirmation",
  });
  addEdge(junction.id, `${b.id}-entrance`, "outdoor", "unverified", `Walkway to ${b.name}`);

  b.floors.forEach((floorRooms, f) => {
    const n = floorRooms.length;
    const stairs = addNode({
      id: `${b.id}-f${f}-stairs`, label: `${b.name} stairs (floor ${f})`, kind: "stairs", building: b.id, floor: f,
      lat: b.lat, lng: b.lng - 3 * STEP, status: "requires_confirmation",
    });
    let prev = stairs.id;
    floorRooms.forEach(([code, name, type, dept], i) => {
      const c = addNode({
        id: `${b.id}-f${f}-c${i}`, label: `${b.name} floor ${f} corridor`, kind: "corridor", building: b.id, floor: f,
        lat: b.lat, lng: b.lng + (i - 2.5) * STEP, status: "requires_confirmation",
      });
      addEdge(prev, c.id, "corridor", "requires_confirmation", `${b.name} floor ${f} corridor`);
      prev = c.id;
      const rid = `${b.id}-${code.replace(/\s+/g, "_")}`;
      const r = addNode({
        id: `${rid}-door`, label: `${code} — ${name}`, kind: "room", building: b.id, floor: f,
        lat: b.lat + (i % 2 ? 1 : -1) * 0.00003, lng: c.lng, status: "requires_confirmation",
      });
      addEdge(c.id, r.id, "door", "requires_confirmation", `Door of ${code}`);
      const dup = b.id === "kb" && code === "255";
      rooms.push({
        id: rid, code, name, building: b.id, buildingName: b.name, floor: f, type, dept, nodeId: r.id,
        status: dup ? "requires_confirmation" : "unverified",
        note: dup ? "Plan gives room 255 the same name as room 254 — needs confirmation." : undefined,
      });
    });
    if (b.hasLift) {
      addNode({
        id: `${b.id}-f${f}-lift`, label: `${b.name} lift (floor ${f})`, kind: "lift", building: b.id, floor: f,
        lat: b.lat, lng: b.lng + (n - 2.5) * STEP, status: "requires_confirmation",
      });
      addEdge(prev, `${b.id}-f${f}-lift`, "corridor", "requires_confirmation", `${b.name} floor ${f} corridor`);
    }
    if (f > 0) {
      addEdge(`${b.id}-f${f - 1}-stairs`, stairs.id, "stairs", "verified", `${b.name} stairs ${f - 1}↔${f}`, FLOOR_HEIGHT_STAIRS);
      if (b.hasLift) addEdge(`${b.id}-f${f - 1}-lift`, `${b.id}-f${f}-lift`, "lift", "verified", `${b.name} lift ${f - 1}↔${f}`, LIFT_LENGTH);
    }
  });
  addEdge(`${b.id}-entrance`, `${b.id}-f0-stairs`, "entrance", "requires_confirmation", `${b.name} entrance`);
}

export function floorName(f: number) {
  return f === 0 ? "Ground floor" : f === 1 ? "First floor" : f === 2 ? "Second floor" : `Floor ${f}`;
}

export const startPoints = [
  { id: "gate", label: "Main Gate" },
  ...buildings.map((b) => ({ id: `${b.id}-entrance`, label: `${b.name} entrance` })),
];
