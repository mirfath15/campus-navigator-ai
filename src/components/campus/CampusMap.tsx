import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { buildings, edges, N, REF } from "@/lib/campus/data";

interface Props {
  path: string[] | null;
  closed: Set<string>;
  position: { lat: number; lng: number; accuracy: number } | null;
  realGpsPosition?: { lat: number; lng: number; accuracy: number } | null;
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function CampusMap({ path, closed, position, realGpsPosition }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const dyn = useRef<Leaflet.LayerGroup | null>(null);
  const pos = useRef<Leaflet.LayerGroup | null>(null);
  const gps = useRef<Leaflet.LayerGroup | null>(null);
  const ready = useRef(false);
  const latest = useRef({ path, closed, position, realGpsPosition });
  latest.current = { path, closed, position, realGpsPosition };

  function drawDynamic() {
    const l = L.current, m = map.current, g = dyn.current;
    if (!l || !m || !g) return;
    g.clearLayers();
    const { path, closed } = latest.current;
    const danger = cssVar("--destructive");
    const routeColor = cssVar("--route");
    for (const e of edges) {
      const isClosed = closed.has(e.id) || closed.has(e.a) || closed.has(e.b);
      if (!isClosed || e.kind === "door") continue;
      l.polyline([[N(e.a).lat, N(e.a).lng], [N(e.b).lat, N(e.b).lng]], { color: danger, weight: 6, dashArray: "4 6" }).addTo(g);
    }
    if (path && path.length) {
      const pts = path.map((id) => [N(id).lat, N(id).lng] as [number, number]);
      l.polyline(pts, { color: routeColor, weight: 9, opacity: 0.25 }).addTo(g);
      l.polyline(pts, { color: routeColor, weight: 4 }).addTo(g);
      l.circleMarker(pts[0]!, { radius: 8, color: routeColor, fillColor: cssVar("--background"), fillOpacity: 1, weight: 3 }).addTo(g).bindTooltip("Start");
      l.circleMarker(pts[pts.length - 1]!, { radius: 9, color: routeColor, fillColor: routeColor, fillOpacity: 1 }).addTo(g).bindTooltip(N(path[path.length - 1]!).label, { permanent: true, direction: "top" });
      m.fitBounds(l.latLngBounds(pts), { padding: [60, 60], maxZoom: 19 });
    }
  }

  function drawPosition() {
    const l = L.current, g = pos.current;
    if (!l || !g) return;
    g.clearLayers();
    const p = latest.current.position;
    if (!p) return;
    const c = cssVar("--accent");
    l.circle([p.lat, p.lng], { radius: Math.max(p.accuracy, 0.5), color: c, fillColor: c, fillOpacity: 0.2, weight: 1 }).addTo(g);
    l.circleMarker([p.lat, p.lng], { radius: 7, color: cssVar("--foreground"), fillColor: c, fillOpacity: 1, weight: 2 }).addTo(g);
  }

  function drawRealGps() {
    const l = L.current, g = gps.current;
    if (!l || !g) return;
    g.clearLayers();
    const gp = latest.current.realGpsPosition;
    if (!gp) return;
    // Blue indicator for real hardware GPS - distinct from simulated positioning
    const gpsBlue = "#2563eb";
    l.circle([gp.lat, gp.lng], {
      radius: Math.max(gp.accuracy, 3),
      color: gpsBlue,
      fillColor: gpsBlue,
      fillOpacity: 0.15,
      weight: 1.5,
      dashArray: "3 4",
    }).addTo(g);
    l.circleMarker([gp.lat, gp.lng], {
      radius: 8,
      color: "#ffffff",
      fillColor: gpsBlue,
      fillOpacity: 1,
      weight: 2.5,
    })
      .addTo(g)
      .bindTooltip(`📍 Real Device GPS (±${Math.round(gp.accuracy)}m)`, { permanent: false, direction: "top" });
  }

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const l = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = l;
      const m = l.map(el.current, { zoomControl: true, attributionControl: true }).setView([REF.lat, REF.lng], 18);
      l.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m);
      const muted = cssVar("--muted-foreground");
      for (const e of edges) {
        if (e.kind !== "outdoor") continue;
        l.polyline([[N(e.a).lat, N(e.a).lng], [N(e.b).lat, N(e.b).lng]], { color: muted, weight: 3, dashArray: "2 6" }).addTo(m);
      }
      for (const b of buildings) {
        const d = 0.00019;
        l.rectangle([[b.lat - 0.00008, b.lng - d], [b.lat + 0.00008, b.lng + d]], { color: cssVar("--primary"), weight: 2, fillOpacity: 0.12 })
          .addTo(m)
          .bindTooltip(`${b.name} · approximate placement`, { permanent: true, direction: "center", className: "building-label" });
      }
      l.circleMarker([N("gate").lat, N("gate").lng], { radius: 6, color: cssVar("--primary"), fillOpacity: 1 }).addTo(m).bindTooltip("Main Gate");
      dyn.current = l.layerGroup().addTo(m);
      pos.current = l.layerGroup().addTo(m);
      gps.current = l.layerGroup().addTo(m);
      map.current = m;
      ready.current = true;
      drawDynamic();
      drawPosition();
      drawRealGps();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => { if (ready.current) drawDynamic(); }, [path, closed]);
  useEffect(() => { if (ready.current) drawPosition(); }, [position]);
  useEffect(() => { if (ready.current) drawRealGps(); }, [realGpsPosition]);

  return <div ref={el} className="h-full w-full" />;
}

