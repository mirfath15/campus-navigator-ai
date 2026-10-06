import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, Mic, Navigation, Search, Bot, Construction, Satellite, Volume2, MapPin, Footprints, Clock } from "lucide-react";
import { edges, nodes, N, floorName, startPoints, type Room } from "@/lib/campus/data";
import { compare, route, ACCESSIBLE_UNAVAILABLE, type RouteResult } from "@/lib/campus/routing";
import { describe, parse, searchRooms } from "@/lib/campus/assistant";

const CampusMap = lazy(() => import("@/components/campus/CampusMap").then((m) => ({ default: m.CampusMap })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Navigator AI — Velammal Engineering College" },
      { name: "description", content: "Find any room in Abdul Kalam Block, Kirloskar Block or Anna Auditorium and get step-by-step walking directions." },
      { property: "og:title", content: "Campus Navigator AI — VEC" },
      { property: "og:description", content: "Search rooms, get accessible routes, and ask the campus assistant at VEC, Chennai." },
    ],
  }),
  component: Index,
});

type Tab = "search" | "assistant" | "closures" | "position";
type Msg = { from: "you" | "bot"; text: string; room?: Room };

const MODES = { FIXED: 0.02, FLOAT: 0.5, SINGLE: 3.0, INDOOR: 0 } as const;
type Mode = keyof typeof MODES;

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function Index() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("gate");
  const [target, setTarget] = useState<Room | null>(null);
  const [accessible, setAccessible] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const result = useMemo(() => {
    if (!target) return null;
    const opts = { accessible, closed };
    const r = route(from, target.nodeId, opts);
    if (!r) return { error: accessible ? ACCESSIBLE_UNAVAILABLE : "No route is available with the current closures." } as const;
    return { route: r, cmp: compare(from, target.nodeId, opts) } as const;
  }, [target, from, accessible, closed]);

  const activeRoute: RouteResult | null = result && "route" in result ? result.route : null;

  // ---- Position simulator ----
  const [mode, setMode] = useState<Mode>("FIXED");
  const [simOn, setSimOn] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number; raw: number; idx: number } | null>(null);
  const stepRef = useRef(0);
  useEffect(() => {
    if (!simOn || !activeRoute) return;
    stepRef.current = 0;
    const pts = activeRoute.path.map((id) => N(id));
    const id = setInterval(() => {
      const t = stepRef.current;
      const seg = Math.min(Math.floor(t), pts.length - 2);
      const f = Math.min(t - seg, 1);
      const a = pts[seg]!, b = pts[seg + 1]!;
      const truth = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
      const indoor = mode === "INDOOR" || !!b.building;
      const sd = indoor ? 0 : MODES[mode];
      const m = 1 / 111320;
      const noisy = { lat: truth.lat + gauss() * sd * m, lng: truth.lng + gauss() * sd * m };
      const raw = Math.sqrt(((noisy.lat - truth.lat) / m) ** 2 + ((noisy.lng - truth.lng) / m) ** 2);
      // snap: route-constrained position is the projection onto the active route
      setPosition({ ...(sd > 1 ? truth : noisy), accuracy: indoor ? 3 : Math.max(sd, 0.3), raw: indoor ? 0 : raw, idx: seg });
      stepRef.current = t + 0.25;
      if (t >= pts.length - 1) setSimOn(false);
    }, 400);
    return () => clearInterval(id);
  }, [simOn, activeRoute, mode]);

  const navigateTo = (r: Room, acc?: boolean) => {
    setTarget(r);
    if (acc !== undefined) setAccessible(acc);
    setSimOn(false);
    setPosition(null);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Navigation className="h-4 w-4" /></div>
          <div>
            <h1 className="text-xl font-bold leading-none">Campus Navigator <span className="text-route">AI</span></h1>
            <p className="text-xs text-muted-foreground">Velammal Engineering College · Chennai</p>
          </div>
        </div>
        <Link to="/how-it-works" className="rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-muted">How it works</Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex min-h-0 w-full flex-col border-r bg-card md:w-[420px]">
          <nav className="grid grid-cols-4 gap-1 border-b p-2">
            {([
              ["search", "Directions", Search],
              ["assistant", "Assistant", Bot],
              ["closures", "Closures", Construction],
              ["position", "Position", Satellite],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-semibold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "search" && (
              <SearchTab query={query} setQuery={setQuery} from={from} setFrom={setFrom} accessible={accessible}
                setAccessible={setAccessible} onNavigate={navigateTo} target={target} result={result} />
            )}
            {tab === "assistant" && <AssistantTab onNavigate={(r, a) => { navigateTo(r, a); }} hydrated={hydrated} activeRoute={activeRoute} />}
            {tab === "closures" && <ClosuresTab closed={closed} setClosed={setClosed} />}
            {tab === "position" && (
              <PositionTab mode={mode} setMode={setMode} simOn={simOn} setSimOn={setSimOn} position={position} hasRoute={!!activeRoute} />
            )}
          </div>
        </aside>

        <section className="relative min-h-[50vh] flex-1">
          {hydrated && (
            <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Loading map…</div>}>
              <CampusMap path={activeRoute?.path ?? null} closed={closed} position={position} />
            </Suspense>
          )}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-xs rounded-xl bg-warning px-3 py-2 text-xs text-warning-foreground shadow-panel">
            Building spots are approximate. Indoor layouts and entrances need confirmation.
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "requires_confirmation" ? "Needs confirmation" : status === "verified" ? "Verified" : "Unverified";
  const cls = status === "verified" ? "bg-secondary text-secondary-foreground" : status === "requires_confirmation" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>;
}

function SearchTab(p: {
  query: string; setQuery: (s: string) => void; from: string; setFrom: (s: string) => void;
  accessible: boolean; setAccessible: (b: boolean) => void; onNavigate: (r: Room) => void; target: Room | null;
  result: ResultT;
}) {
  const list = searchRooms(p.query);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input value={p.query} onChange={(e) => p.setQuery(e.target.value)} placeholder="Room number, name, department, block…"
          className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex gap-2">
        <select value={p.from} onChange={(e) => p.setFrom(e.target.value)} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm">
          {startPoints.map((s) => <option key={s.id} value={s.id}>From: {s.label}</option>)}
        </select>
        <button onClick={() => p.setAccessible(!p.accessible)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${p.accessible ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          <Accessibility className="h-4 w-4" /> {p.accessible ? "Accessible" : "Normal"}
        </button>
      </div>

      {p.target && p.result && <RoutePanel target={p.target} result={p.result} />}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{list.length} rooms</p>
        {list.map((r) => (
          <div key={r.id} className={`rounded-xl border p-3 ${p.target?.id === r.id ? "border-primary bg-secondary" : "bg-background"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold"><span className="text-route">{r.code}</span> · {r.name}</p>
                <p className="text-xs text-muted-foreground">{r.buildingName} · {floorName(r.floor)}{r.dept ? ` · ${r.dept}` : ""}</p>
                {r.note && <p className="mt-1 text-xs text-warning-foreground">{r.note}</p>}
              </div>
              {r.status === "requires_confirmation" && <StatusBadge status={r.status} />}
            </div>
            <button onClick={() => p.onNavigate(r)} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <MapPin className="h-3 w-3" /> Navigate here
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// type helper for the memoised result
type ResultT = { error: string } | { route: RouteResult; cmp: ReturnType<typeof compare> } | null;

function RoutePanel({ target, result }: { target: Room; result: NonNullable<ResultT> }) {
  if ("error" in result) {
    return <div className="rounded-xl border border-destructive bg-background p-3 text-sm font-semibold text-destructive">{result.error}</div>;
  }
  const r = result.route;
  const { astar, dijkstra } = result.cmp;
  return (
    <div className="space-y-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-panel">
      <p className="text-xs uppercase tracking-wider opacity-80">Route to</p>
      <h2 className="text-lg font-bold leading-tight">{target.code} · {target.name}</h2>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1"><Footprints className="h-4 w-4" /> {Math.round(r.distance)} m</span>
        <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {Math.max(1, Math.round(r.etaSeconds / 60))} min walk</span>
      </div>
      <ol className="space-y-1.5 rounded-xl bg-card p-3 text-sm text-card-foreground">
        {r.instructions.map((s, i) => (
          <li key={i} className="flex gap-2"><span className="font-bold text-route">{i + 1}.</span><span>{s}</span></li>
        ))}
      </ol>
      <div className="rounded-xl bg-card p-3 text-xs text-card-foreground">
        <p className="mb-2 font-semibold">Speed comparison (avg of 200 runs)</p>
        <table className="w-full">
          <thead className="text-muted-foreground"><tr><th className="text-left font-medium">Method</th><th className="text-right font-medium">Time</th><th className="text-right font-medium">Nodes checked</th><th className="text-right font-medium">Distance</th></tr></thead>
          <tbody>
            {[["A*", astar], ["Dijkstra", dijkstra]].map(([n, v]) => {
              const x = v as typeof astar;
              return <tr key={n as string}><td className="font-semibold">{n as string}</td><td className="text-right">{x.avgMs.toFixed(3)} ms</td><td className="text-right">{x.res?.visited}</td><td className="text-right">{Math.round(x.res?.distance ?? 0)} m</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] opacity-80">Indoor distances are estimates from placeholder layouts.</p>
    </div>
  );
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function AssistantTab({ onNavigate, hydrated, activeRoute }: { onNavigate: (r: Room, acc: boolean) => void; hydrated: boolean; activeRoute: RouteResult | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Hi! Ask me “Where is room 860?” or “Take me to room 864 without stairs”." }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const pending = useRef<{ room: Room; acc: boolean } | null>(null);

  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const text = activeRoute
      ? `Route to ${p.room.code}: ${Math.round(activeRoute.distance)} metres, about ${Math.max(1, Math.round(activeRoute.etaSeconds / 60))} minutes. ${activeRoute.instructions.join(" ")}`
      : p.acc ? ACCESSIBLE_UNAVAILABLE : "No route is available with the current closures.";
    setMsgs((m) => [...m, { from: "bot", text }]);
  }, [activeRoute]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    const intent = parse(text);
    const next: Msg[] = [{ from: "you", text }];
    if (intent.type === "navigate") {
      next.push({ from: "bot", text: `${describe(intent.room)} ${intent.accessible ? "Planning a step-free route…" : "Planning your route…"}` });
      pending.current = { room: intent.room, acc: intent.accessible };
      onNavigate(intent.room, intent.accessible);
    } else if (intent.type === "search") {
      intent.matches.slice(0, 4).forEach((r) => next.push({ from: "bot", text: describe(r), room: r }));
    } else next.push({ from: "bot", text: intent.text });
    setMsgs((m) => [...m, ...next]);
    setInput("");
  };

  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { from: "bot", text: "Voice input isn't supported in this browser. Try Chrome or Edge." }]); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onresult = (e: any) => ask(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.from === "you" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
            <p>{m.text}</p>
            {m.from === "bot" && (
              <div className="mt-1 flex gap-2">
                <button onClick={() => speak(m.text)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Volume2 className="h-3 w-3" /> Read aloud</button>
                {m.room && <button onClick={() => onNavigate(m.room!, false)} className="text-xs font-semibold text-route">Navigate here →</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-0 flex gap-2 bg-card pt-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about any room…" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        {hydrated && (
          <button type="button" onClick={listen} aria-label="Speak" className={`rounded-xl border px-3 ${listening ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}><Mic className="h-4 w-4" /></button>
        )}
        <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Ask</button>
      </form>
    </div>
  );
}

function ClosuresTab({ closed, setClosed }: { closed: Set<string>; setClosed: (s: Set<string>) => void }) {
  const groups: [string, { id: string; label: string }[]][] = [
    ["Entrances", Object.values(nodes).filter((n) => n.kind === "entrance").map((n) => ({ id: n.id, label: n.label }))],
    ["Stairs", edges.filter((e) => e.kind === "stairs").map((e) => ({ id: e.id, label: e.label }))],
    ["Lifts", edges.filter((e) => e.kind === "lift").map((e) => ({ id: e.id, label: e.label }))],
    ["Outdoor paths", edges.filter((e) => e.kind === "outdoor").map((e) => ({ id: e.id, label: e.label }))],
    ["Corridors", Array.from(new Map(edges.filter((e) => e.kind === "corridor").map((e) => [e.label, e])).values()).map((e) => ({ id: `corr:${e.label}`, label: e.label }))],
  ];
  const corridorIds = (label: string) => edges.filter((e) => e.kind === "corridor" && e.label === label).map((e) => e.id);
  const isClosed = (id: string) => id.startsWith("corr:") ? corridorIds(id.slice(5)).every((x) => closed.has(x)) : closed.has(id);
  const toggle = (id: string) => {
    const n = new Set(closed);
    const ids = id.startsWith("corr:") ? corridorIds(id.slice(5)) : [id];
    const close = !isClosed(id);
    ids.forEach((x) => (close ? n.add(x) : n.delete(x)));
    setClosed(n);
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Close anything that's blocked. Routes avoid it right away. Closures reset when the page reloads.</p>
      {groups.map(([title, items]) => (
        <div key={title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="space-y-1.5">
            {items.map((it) => (
              <label key={it.id} className="flex cursor-pointer items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                <span>{it.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isClosed(it.id) ? "text-destructive" : "text-success"}`}>{isClosed(it.id) ? "Closed" : "Open"}</span>
                  <input type="checkbox" checked={isClosed(it.id)} onChange={() => toggle(it.id)} className="h-4 w-4 accent-[var(--destructive)]" />
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionTab(p: { mode: Mode; setMode: (m: Mode) => void; simOn: boolean; setSimOn: (b: boolean) => void; position: { accuracy: number; raw: number } | null; hasRoute: boolean }) {
  const desc: Record<Mode, string> = {
    FIXED: "RTK fixed · about 2 cm error",
    FLOAT: "RTK float · about 0.5 m error",
    SINGLE: "Standard GPS · about 3 m error (snapped to route)",
    INDOOR: "No satellite signal · position follows the route",
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-warning p-3 text-xs font-semibold text-warning-foreground">Simulation only. This is not real RTK positioning.</div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} onClick={() => p.setMode(m)} className={`rounded-xl border p-3 text-left ${p.mode === m ? "border-primary bg-secondary" : "hover:bg-muted"}`}>
            <p className="font-bold">{m}</p>
            <p className="text-xs text-muted-foreground">{desc[m]}</p>
          </button>
        ))}
      </div>
      <button disabled={!p.hasRoute} onClick={() => p.setSimOn(!p.simOn)}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
        {p.simOn ? "Stop walk" : "Start simulated walk"}
      </button>
      {!p.hasRoute && <p className="text-xs text-muted-foreground">Pick a destination first, then start the walk.</p>}
      {p.position && (
        <div className="rounded-xl border bg-background p-3 text-sm">
          <p>Shown accuracy: <b>{p.position.accuracy.toFixed(2)} m</b></p>
          <p>Raw error this fix: <b>{p.position.raw.toFixed(2)} m</b></p>
          <p className="mt-1 text-xs text-muted-foreground">Inside buildings, satellite positioning switches off automatically.</p>
        </div>
      )}
    </div>
  );
}
