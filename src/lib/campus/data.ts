// Campus data for Velammal Engineering College (VEC), Chennai.
// Reference coordinate: Main Campus Centroid (Surapet / Ambattur, Chennai).
// Buildings and outdoor road network mapped directly from OpenStreetMap (OSM)
// ground-truth survey and aerial geometries.
// Handwritten floor plans verified for Abdul Kalam Block, Kirloskar Block, and Anna Auditorium.

export type Status = "verified" | "approximate" | "unverified" | "requires_confirmation";
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
  note?: string;
  hasIndoorFloorPlan: boolean;
}

// Campus Reference Geolocation (Velammal Engineering College, Ambattur Redhills Rd, Chennai)
export const REF = { lat: 13.148828, lng: 80.192063 };

type RoomDef = [code: string, name: string, type: string, dept?: string, note?: string];

export interface BuildingDef extends Building {
  floors: RoomDef[][];
}

const BUILDING_DEFS: BuildingDef[] = [
  {
    id: "ak",
    name: "Abdul Kalam Block",
    lat: 13.148917,
    lng: 80.191155,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: true,
    note: "Academic block for Information Technology & MBA. Verified layout from college blueprints.",
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
    lat: 13.149278,
    lng: 80.192287,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: true,
    note: "Mechanical & CSE-CS academic block. Verified layout from college blueprints.",
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
        [
          "255",
          "CSE-CS Third Year A Classroom",
          "classroom",
          "CSE-CS",
          undefined,
          "Plan gives room 255 the same name as room 254 — needs confirmation.",
        ],
        ["256", "CSE-CS Third Year B Classroom", "classroom", "CSE-CS"],
        ["GR", "Girls Restroom", "restroom"],
      ],
    ],
  },
  {
    id: "an",
    name: "Anna Auditorium",
    lat: 13.149203,
    lng: 80.190915,
    hasLift: true,
    status: "verified",
    hasIndoorFloorPlan: true,
    note: "Main campus auditorium and advanced computing laboratories. Equipped with elevator.",
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
  {
    id: "fcb",
    name: "FCB / Founder Chairman Block",
    lat: 13.148897,
    lng: 80.191776,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Administrative offices, principal chamber, and board rooms.",
    floors: [
      [
        [
          "FCB-REC",
          "Administrative Reception & Information",
          "office",
          "Admin",
          "Administrative offices and reception desk.",
        ],
        [
          "FCB-PRIN",
          "Principal Chamber & Dean Office",
          "office",
          "Admin",
          "Principal chamber and dean offices.",
        ],
      ],
    ],
  },
  {
    id: "vb",
    name: "Visvesvaraya Block",
    lat: 13.149981,
    lng: 80.191615,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Academic block for Civil and Mechanical departments.",
    floors: [
      [
        ["913", "Classroom 913", "classroom", "Civil/Mech", "Engineering department classroom."],
        ["914", "Classroom 914", "classroom", "Civil/Mech", "Engineering department classroom."],
      ],
    ],
  },
  {
    id: "bg",
    name: "Bill Gates Block",
    lat: 13.148295,
    lng: 80.192374,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Computer Science & IT laboratories block, located east of the sports ground.",
    floors: [
      [
        [
          "BG-LAB",
          "Bill Gates Computing Centre",
          "lab",
          "CSE/IT",
          "Computing centre & advanced software lab.",
        ],
      ],
    ],
  },
  {
    id: "rt",
    name: "Ratan Tata Block",
    lat: 13.147491,
    lng: 80.192241,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Academic block & seminar halls, located south of Bill Gates Block.",
    floors: [
      [
        [
          "RT-HALL",
          "Ratan Tata Seminar Hall",
          "hall",
          "General",
          "Seminar hall & academic departments.",
        ],
      ],
    ],
  },
  {
    id: "temple",
    name: "Murugan Temple",
    lat: 13.150513,
    lng: 80.191539,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Campus landmark temple located near the north VOC Street entrance.",
    floors: [
      [
        [
          "TEMPLE",
          "Murugan Temple Sanctum",
          "landmark",
          "Campus",
          "Campus landmark near north entrance.",
        ],
      ],
    ],
  },
  {
    id: "canteen",
    name: "Campus Canteen",
    lat: 13.146821,
    lng: 80.192393,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Student cafeteria & food court near southern college bus parking.",
    floors: [
      [
        [
          "CANTEEN",
          "Main Cafeteria & Dining Hall",
          "cafeteria",
          "Amenities",
          "Main cafeteria & dining hall.",
        ],
      ],
    ],
  },
  {
    id: "hostel_b",
    name: "Boys Hostel",
    lat: 13.148343,
    lng: 80.190837,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Men's residential accommodation block, located west of the sports ground.",
    floors: [
      [
        [
          "BH-REC",
          "Boys Hostel Reception & Entrance",
          "office",
          "Hostel",
          "Men's residential accommodation entrance.",
        ],
      ],
    ],
  },
  {
    id: "hostel_g",
    name: "Girls Hostel",
    lat: 13.146933,
    lng: 80.191153,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Women's residential accommodation block, located in southwest campus.",
    floors: [
      [
        [
          "GH-REC",
          "Girls Hostel Reception & Entrance",
          "office",
          "Hostel",
          "Women's residential accommodation entrance.",
        ],
      ],
    ],
  },
  {
    id: "sports",
    name: "Sports Complex",
    lat: 13.147825,
    lng: 80.191476,
    hasLift: false,
    status: "verified",
    hasIndoorFloorPlan: false,
    note: "Central college sports ground, athletic pavilion, and outdoor facilities.",
    floors: [
      [
        [
          "SPORTS",
          "College Sports Ground & Pavilion",
          "amenity",
          "Physical Ed",
          "Athletic sports ground and pavilion.",
        ],
      ],
    ],
  },
  {
    id: "restrooms_campus",
    name: "Central Campus Restrooms",
    lat: 13.14782,
    lng: 80.19208,
    hasLift: false,
    status: "unverified",
    hasIndoorFloorPlan: false,
    note: "Ground-level central outdoor restrooms facility.",
    floors: [
      [
        [
          "CR-BOYS",
          "Central Boys Restroom",
          "restroom",
          "Amenities",
          "Ground floor outdoor restroom.",
        ],
        [
          "CR-GIRLS",
          "Central Girls Restroom",
          "restroom",
          "Amenities",
          "Ground floor outdoor restroom.",
        ],
      ],
    ],
  },
];

const R = 6371000;
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
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

function addEdge(
  a: string,
  b: string,
  kind: EdgeKind,
  status: Status,
  label: string,
  fixedLength?: number,
) {
  if (!nodes[a]) throw new Error(`Cannot add edge: start node ${a} does not exist`);
  if (!nodes[b]) throw new Error(`Cannot add edge: end node ${b} does not exist`);
  const length = fixedLength ?? Math.max(1, haversine(N(a), N(b)));
  edges.push({ id: `${a}~${b}`, a, b, kind, length, status, label });
}

const STEP = 0.00005; // corridor room spacing
const FLOOR_HEIGHT_STAIRS = 12; // walking distance per flight of stairs
const LIFT_LENGTH = 4; // wait & travel penalty equivalent for elevator

// ==========================================
// 1. OUTDOOR PEDESTRIAN WALKWAY GRAPH
// Derived from OpenStreetMap roads and walkways:
// - Central Avenue (Way 403011456)
// - Central Footpath (Way 1534185972)
// - West Campus Road (Way 403012259)
// - South Campus Road (Way 673294349)
// - North-Central Road (Way 1534185973)
// - North Walkway (Way 403011457 / Way 403012255)
// ==========================================

// Central Avenue (North-South spine)
addNode({
  id: "gate",
  label: "Main Gate",
  kind: "gate",
  lat: 13.150714,
  lng: 80.191628,
  status: "verified",
});

addNode({
  id: "j_bg",
  label: "Central Avenue (Bill Gates Approach)",
  kind: "junction",
  lat: 13.148295,
  lng: 80.19211,
  status: "verified",
});

addNode({
  id: "hub",
  label: "Central Campus Junction",
  kind: "junction",
  lat: 13.148763,
  lng: 80.192116,
  status: "verified",
});

addNode({
  id: "j_fcb_kb",
  label: "North-Central Junction (FCB / Kirloskar)",
  kind: "junction",
  lat: 13.149073,
  lng: 80.192111,
  status: "verified",
});

addNode({
  id: "j_north",
  label: "North Avenue Junction",
  kind: "junction",
  lat: 13.149931,
  lng: 80.192087,
  status: "verified",
});

addNode({
  id: "j_rt",
  label: "Central Avenue (Ratan Tata Approach)",
  kind: "junction",
  lat: 13.147491,
  lng: 80.192117,
  status: "verified",
});

addNode({
  id: "j_south",
  label: "South Avenue Junction (Canteen)",
  kind: "junction",
  lat: 13.146821,
  lng: 80.192117,
  status: "verified",
});

// Central Avenue edges
addEdge("gate", "j_bg", "outdoor", "verified", "Main Central Avenue");
addEdge("j_bg", "hub", "outdoor", "verified", "Main Central Avenue");
addEdge("hub", "j_fcb_kb", "outdoor", "verified", "Main Central Avenue");
addEdge("j_fcb_kb", "j_north", "outdoor", "verified", "Main Central Avenue");
addEdge("gate", "j_rt", "outdoor", "verified", "Main Central Avenue");
addEdge("j_rt", "j_south", "outdoor", "verified", "Main Central Avenue");

// Central East-West Footpath (Way 1534185972)
addNode({
  id: "j_path_mid",
  label: "Central Campus Footpath",
  kind: "junction",
  lat: 13.148751,
  lng: 80.191674,
  status: "verified",
});

addNode({
  id: "j_west_1",
  label: "West Campus Walkway (AK Approach)",
  kind: "junction",
  lat: 13.148738,
  lng: 80.191237,
  status: "verified",
});

addNode({
  id: "j_west_2",
  label: "Auditorium Walkway Junction",
  kind: "junction",
  lat: 13.148945,
  lng: 80.19115,
  status: "verified",
});

addEdge("hub", "j_path_mid", "outdoor", "verified", "Campus Footpath");
addEdge("j_path_mid", "j_west_1", "outdoor", "verified", "Campus Footpath");
addEdge("j_west_1", "j_west_2", "outdoor", "verified", "Auditorium Walkway");

// West Campus Road (Way 403012259)
addNode({
  id: "j_west_bh",
  label: "West Campus Road (Boys Hostel Approach)",
  kind: "junction",
  lat: 13.148343,
  lng: 80.191,
  status: "verified",
});

addNode({
  id: "j_sw",
  label: "Southwest Road Junction",
  kind: "junction",
  lat: 13.147394,
  lng: 80.190592,
  status: "verified",
});

addEdge("j_west_1", "j_west_bh", "outdoor", "verified", "West Campus Road");
addEdge("j_west_bh", "j_sw", "outdoor", "verified", "West Campus Road");

// South Campus Road (Way 673294349)
addNode({
  id: "j_gh",
  label: "South Campus Road (Girls Hostel Approach)",
  kind: "junction",
  lat: 13.14705,
  lng: 80.1912,
  status: "verified",
});

addNode({
  id: "j_stadium",
  label: "South Campus Road (Indoor Stadium)",
  kind: "junction",
  lat: 13.14695,
  lng: 80.19165,
  status: "verified",
});

addEdge("j_sw", "j_gh", "outdoor", "verified", "South Campus Road");
addEdge("j_gh", "j_stadium", "outdoor", "verified", "South Campus Road");
addEdge("j_stadium", "j_south", "outdoor", "verified", "South Campus Road");

// North-Central Road (Way 1534185973)
addNode({
  id: "j_north_mid",
  label: "North Road (Anna Auditorium Approach)",
  kind: "junction",
  lat: 13.148945,
  lng: 80.191259,
  status: "verified",
});

addEdge("j_fcb_kb", "j_north_mid", "outdoor", "verified", "North-Central Road");
addEdge("j_north_mid", "j_west_2", "outdoor", "verified", "North Road Connector");

// North Road to Visvesvaraya & Murugan Temple (Way 403011457 / Way 403012255)
addNode({
  id: "j_visv",
  label: "North Road (Visvesvaraya Approach)",
  kind: "junction",
  lat: 13.14995,
  lng: 80.191615,
  status: "verified",
});

addNode({
  id: "j_temple",
  label: "North Road (Murugan Temple Approach)",
  kind: "junction",
  lat: 13.150513,
  lng: 80.1916,
  status: "verified",
});

addEdge("j_north", "j_visv", "outdoor", "verified", "North Campus Road");
addEdge("j_visv", "j_temple", "outdoor", "verified", "North Campus Avenue");

// Helper map to associate each building with its corresponding approach walkway junction
const BUILDING_APPROACH_JUNCTIONS: Record<
  string,
  { jId: string; entranceLat: number; entranceLng: number }
> = {
  ak: { jId: "j_west_1", entranceLat: 13.14885, entranceLng: 80.1912 },
  kb: { jId: "j_fcb_kb", entranceLat: 13.149278, entranceLng: 80.19215 },
  an: { jId: "j_west_2", entranceLat: 13.149203, entranceLng: 80.191 },
  fcb: { jId: "j_fcb_kb", entranceLat: 13.148897, entranceLng: 80.19185 },
  bg: { jId: "j_bg", entranceLat: 13.148295, entranceLng: 80.1922 },
  rt: { jId: "j_rt", entranceLat: 13.147491, entranceLng: 80.19218 },
  temple: { jId: "j_temple", entranceLat: 13.150513, entranceLng: 80.19155 },
  canteen: { jId: "j_south", entranceLat: 13.146821, entranceLng: 80.19225 },
  sports: { jId: "j_path_mid", entranceLat: 13.147825, entranceLng: 80.1916 },
  vb: { jId: "j_visv", entranceLat: 13.149981, entranceLng: 80.19165 },
  hostel_b: { jId: "j_west_bh", entranceLat: 13.148343, entranceLng: 80.1909 },
  hostel_g: { jId: "j_gh", entranceLat: 13.146933, entranceLng: 80.19118 },
  restrooms_campus: {
    jId: "j_bg",
    entranceLat: 13.14782,
    entranceLng: 80.19208,
  },
};

// ==========================================
// 2. BUILDING ENTRANCES, FLOORS, CORRIDORS & ROOMS
// ==========================================

for (const b of BUILDING_DEFS) {
  const approach = BUILDING_APPROACH_JUNCTIONS[b.id] ?? {
    jId: "hub",
    entranceLat: b.lat,
    entranceLng: b.lng,
  };

  // Building Entrance Node
  addNode({
    id: `${b.id}-entrance`,
    label: `${b.name} entrance`,
    kind: "entrance",
    building: b.id,
    floor: 0,
    lat: approach.entranceLat,
    lng: approach.entranceLng,
    status: b.hasIndoorFloorPlan ? "verified" : "unverified",
  });

  // Edge from walkway junction to entrance
  addEdge(approach.jId, `${b.id}-entrance`, "outdoor", b.status, `Walkway to ${b.name}`);

  // Indoor floors processing
  b.floors.forEach((floorRooms, f) => {
    const n = floorRooms.length;
    const stairs = addNode({
      id: `${b.id}-f${f}-stairs`,
      label: `${b.name} stairs (floor ${f})`,
      kind: "stairs",
      building: b.id,
      floor: f,
      lat: b.hasIndoorFloorPlan ? b.lat : approach.entranceLat,
      lng: b.hasIndoorFloorPlan ? b.lng - 3 * STEP : approach.entranceLng,
      status: b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
    });

    let prev = stairs.id;
    floorRooms.forEach(([code, name, type, dept, customNote], i) => {
      const c = addNode({
        id: `${b.id}-f${f}-c${i}`,
        label: `${b.name} floor ${f} corridor`,
        kind: "corridor",
        building: b.id,
        floor: f,
        lat: b.hasIndoorFloorPlan ? b.lat : approach.entranceLat,
        lng: b.hasIndoorFloorPlan ? b.lng + (i - 2.5) * STEP : approach.entranceLng,
        status: b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
      });
      addEdge(
        prev,
        c.id,
        "corridor",
        b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
        `${b.name} floor ${f} corridor`,
      );
      prev = c.id;

      const rid = `${b.id}-${code.replace(/\s+/g, "_")}`;
      const r = addNode({
        id: `${rid}-door`,
        label: `${code} — ${name}`,
        kind: "room",
        building: b.id,
        floor: f,
        lat: b.hasIndoorFloorPlan ? b.lat + (i % 2 ? 1 : -1) * 0.00003 : approach.entranceLat,
        lng: b.hasIndoorFloorPlan ? c.lng : approach.entranceLng,
        status: b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
      });
      addEdge(
        c.id,
        r.id,
        "door",
        b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
        `Door of ${code}`,
      );

      const dup = b.id === "kb" && code === "255";
      rooms.push({
        id: rid,
        code,
        name,
        building: b.id,
        buildingName: b.name,
        floor: f,
        type,
        dept,
        nodeId: r.id,
        status: dup ? "requires_confirmation" : b.hasIndoorFloorPlan ? "verified" : "unverified",
        note:
          customNote ??
          (dup ? "Plan gives room 255 the same name as room 254 — needs confirmation." : undefined),
      });
    });

    if (b.hasLift) {
      addNode({
        id: `${b.id}-f${f}-lift`,
        label: `${b.name} lift (floor ${f})`,
        kind: "lift",
        building: b.id,
        floor: f,
        lat: b.lat,
        lng: b.lng + (n - 2.5) * STEP,
        status: "requires_confirmation",
      });
      addEdge(
        prev,
        `${b.id}-f${f}-lift`,
        "corridor",
        "requires_confirmation",
        `${b.name} floor ${f} corridor`,
      );
    }

    if (f > 0) {
      addEdge(
        `${b.id}-f${f - 1}-stairs`,
        stairs.id,
        "stairs",
        "verified",
        `${b.name} stairs ${f - 1}↔${f}`,
        FLOOR_HEIGHT_STAIRS,
      );
      if (b.hasLift) {
        addEdge(
          `${b.id}-f${f - 1}-lift`,
          `${b.id}-f${f}-lift`,
          "lift",
          "verified",
          `${b.name} lift ${f - 1}↔${f}`,
          LIFT_LENGTH,
        );
      }
    }
  });

  // Connect entrance to ground floor entrance lobby / stairs
  if (nodes[`${b.id}-f0-stairs`]) {
    addEdge(
      `${b.id}-entrance`,
      `${b.id}-f0-stairs`,
      "entrance",
      b.hasIndoorFloorPlan ? "requires_confirmation" : "unverified",
      `${b.name} entrance`,
    );
  }
}

// Connect Visvesvaraya approach to Anna Auditorium north entrance
if (nodes["an-entrance"]) {
  addEdge("j_visv", "an-entrance", "outdoor", "verified", "Auditorium Walkway");
}

export function floorName(f: number) {
  return f === 0
    ? "Ground floor"
    : f === 1
      ? "First floor"
      : f === 2
        ? "Second floor"
        : `Floor ${f}`;
}

export const startPoints = [
  { id: "gate", label: "Main Gate" },
  { id: "hub", label: "Central Campus Junction" },
  ...buildings.map((b) => ({ id: `${b.id}-entrance`, label: `${b.name} entrance` })),
];

export interface CampusDataAudit {
  totalBuildings: number;
  verifiedPlanBuildings: number;
  provisionalBuildings: number;
  totalRooms: number;
  verifiedPlanRooms: number;
  provisionalRooms: number;
  missingFloorPlans: string[];
}

/**
 * Returns a comprehensive data integrity audit of campus buildings and floor plans.
 */
export function getCampusDataCoverage(): CampusDataAudit {
  const missingFloorPlans = buildings.filter((b) => !b.hasIndoorFloorPlan).map((b) => b.name);

  const verifiedPlanBuildings = buildings.filter((b) => b.hasIndoorFloorPlan).length;
  const provisionalBuildings = buildings.length - verifiedPlanBuildings;

  const verifiedPlanRooms = rooms.filter((r) => {
    const b = buildings.find((x) => x.id === r.building);
    return b?.hasIndoorFloorPlan ?? false;
  }).length;
  const provisionalRooms = rooms.length - verifiedPlanRooms;

  return {
    totalBuildings: buildings.length,
    verifiedPlanBuildings,
    provisionalBuildings,
    totalRooms: rooms.length,
    verifiedPlanRooms,
    provisionalRooms,
    missingFloorPlans,
  };
}
