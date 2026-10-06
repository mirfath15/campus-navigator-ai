import { edges, haversine, N, floorName, buildings, type Edge } from "./data";

export const ACCESSIBLE_UNAVAILABLE = "Accessible route is not available from the current verified campus data.";
const WALK_SPEED = 1.3; // m/s
const LIFT_PENALTY = 20; // metres-equivalent for waiting

export interface RouteOptions {
  accessible: boolean;
  closed: Set<string>; // node ids or edge ids
}

export interface RouteResult {
  path: string[];
  edges: Edge[];
  distance: number;
  etaSeconds: number;
  visited: number;
  runtimeMs: number;
  instructions: string[];
}

type Adj = Map<string, { to: string; edge: Edge; cost: number }[]>;

function buildAdj(opts: RouteOptions): Adj {
  const adj: Adj = new Map();
  for (const e of edges) {
    if (opts.closed.has(e.id) || opts.closed.has(e.a) || opts.closed.has(e.b)) continue;
    if (opts.accessible && e.kind === "stairs") continue;
    const cost = e.length + (e.kind === "lift" ? LIFT_PENALTY : 0);
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, edge: e, cost });
    adj.get(e.b)!.push({ to: e.a, edge: e, cost });
  }
  return adj;
}

class MinHeap {
  private a: [number, string][] = [];
  get size() { return this.a.length; }
  push(v: [number, string]) {
    const a = this.a; a.push(v);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p]![0] <= a[i]![0]) break; const t = a[p]!; a[p] = a[i]!; a[i] = t; i = p; }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l]![0] < a[m]![0]) m = l;
        if (r < a.length && a[r]![0] < a[m]![0]) m = r;
        if (m === i) break; const t = a[m]!; a[m] = a[i]!; a[i] = t; i = m;
      }
    }
    return top;
  }
}

function search(from: string, to: string, opts: RouteOptions, useHeuristic: boolean) {
  const adj = buildAdj(opts);
  const g = new Map<string, number>([[from, 0]]);
  const came = new Map<string, { prev: string; edge: Edge }>();
  const done = new Set<string>();
  const h = (id: string) => (useHeuristic ? haversine(N(id), N(to)) : 0); // f(n) = g(n) + h(n)
  const open = new MinHeap();
  open.push([h(from), from]);
  while (open.size) {
    const [, cur] = open.pop()!;
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === to) break;
    for (const { to: nb, edge, cost } of adj.get(cur) ?? []) {
      const ng = g.get(cur)! + cost;
      if (ng < (g.get(nb) ?? Infinity)) {
        g.set(nb, ng);
        came.set(nb, { prev: cur, edge });
        open.push([ng + h(nb), nb]);
      }
    }
  }
  if (!done.has(to)) return { found: false as const, visited: done.size };
  const path = [to];
  const pathEdges: Edge[] = [];
  let c = to;
  while (c !== from) { const s = came.get(c)!; pathEdges.unshift(s.edge); path.unshift(s.prev); c = s.prev; }
  return { found: true as const, visited: done.size, path, pathEdges };
}

function bearing(a: string, b: string) {
  const A = N(a), B = N(b);
  return (Math.atan2(B.lng - A.lng, B.lat - A.lat) * 180) / Math.PI;
}

function instructionsFor(path: string[], pathEdges: Edge[]): string[] {
  const out: string[] = [];
  const bName = (id?: string) => buildings.find((b) => b.id === id)?.name ?? "";
  let i = 0;
  let lastBearing: number | null = null;
  while (i < pathEdges.length) {
    const e = pathEdges[i]!;
    if (e.kind === "stairs" || e.kind === "lift") {
      let j = i; while (j < pathEdges.length && pathEdges[j]!.kind === e.kind) j++;
      const from = N(path[i]!).floor ?? 0, to = N(path[j]!).floor ?? 0;
      out.push(`Take the ${e.kind === "lift" ? "lift" : "stairs"} ${to > from ? "up" : "down"} to the ${floorName(to).toLowerCase()}.`);
      i = j; lastBearing = null; continue;
    }
    if (e.kind === "entrance") {
      const n = N(path[i + 1]!);
      const entering = N(path[i]!).kind === "entrance";
      out.push(entering ? `Enter ${bName(n.building)} through the entrance (ground floor).` : `Exit ${bName(N(path[i]!).building)} through the entrance.`);
      i++; lastBearing = null; continue;
    }
    if (e.kind === "door") {
      const n = N(path[i + 1]!);
      if (n.kind === "room") out.push(`Arrive at ${n.label} on the ${floorName(n.floor ?? 0).toLowerCase()}.`);
      else out.push("Step out of the room into the corridor.");
      i++; lastBearing = null; continue;
    }
    // walking segments (outdoor or corridor) — merge same-kind runs
    let j = i; let dist = 0;
    while (j < pathEdges.length && pathEdges[j]!.kind === e.kind) { dist += pathEdges[j]!.length; j++; }
    const br = bearing(path[i]!, path[j]!);
    let turn = "";
    if (lastBearing !== null) {
      const d = ((br - lastBearing + 540) % 360) - 180;
      turn = d > 35 ? "Turn right and " : d < -35 ? "Turn left and " : "Continue and ";
    }
    const target = N(path[j]!);
    const verb = turn ? turn + "walk" : "Walk";
    out.push(e.kind === "outdoor"
      ? `${verb} ${Math.round(dist)} m along the campus path toward ${target.label}.`
      : `${verb} ${Math.round(dist)} m along the corridor.`);
    lastBearing = br;
    i = j;
  }
  return out;
}

export function route(from: string, to: string, opts: RouteOptions, algorithm: "astar" | "dijkstra" = "astar"): RouteResult | null {
  const t0 = performance.now();
  const r = search(from, to, opts, algorithm === "astar");
  const runtimeMs = performance.now() - t0;
  if (!r.found) return null;
  const distance = r.pathEdges.reduce((s, e) => s + e.length, 0);
  const eta = r.pathEdges.reduce((s, e) => s + (e.kind === "stairs" ? 20 : e.kind === "lift" ? 35 : e.length / WALK_SPEED), 0);
  return { path: r.path, edges: r.pathEdges, distance, etaSeconds: eta, visited: r.visited, runtimeMs, instructions: instructionsFor(r.path, r.pathEdges) };
}

/** Runs both algorithms repeatedly to get a stable timing comparison. */
export function compare(from: string, to: string, opts: RouteOptions) {
  const runs = 200;
  const time = (alg: "astar" | "dijkstra") => {
    let res: RouteResult | null = null;
    const t0 = performance.now();
    for (let k = 0; k < runs; k++) res = route(from, to, opts, alg);
    return { res, avgMs: (performance.now() - t0) / runs };
  };
  return { astar: time("astar"), dijkstra: time("dijkstra") };
}
