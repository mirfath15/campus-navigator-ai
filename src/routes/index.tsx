import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  Mic,
  Navigation,
  Search,
  Bot,
  Construction,
  Satellite,
  Volume2,
  VolumeX,
  RotateCcw,
  MapPin,
  Footprints,
  Clock,
  Share2,
  Smartphone,
  Play,
  Square,
} from "lucide-react";
import { edges, nodes, floorName, startPoints, type Room } from "@/lib/campus/data";
import { compare, route, ACCESSIBLE_UNAVAILABLE, type RouteResult } from "@/lib/campus/routing";
import { describe, parse, searchRooms } from "@/lib/campus/assistant";
import { ShareLocationDialog } from "@/components/campus/ShareLocationDialog";
import { useCampusNavigation } from "@/hooks/use-campus-navigation";

const CampusMap = lazy(() =>
  import("@/components/campus/CampusMap").then((m) => ({ default: m.CampusMap })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Navigator AI — Velammal Engineering College" },
      {
        name: "description",
        content:
          "Find any room or building at Velammal Engineering College and get step-by-step turn-by-turn walking directions.",
      },
      { property: "og:title", content: "Campus Navigator AI — VEC" },
      {
        property: "og:description",
        content:
          "Search rooms, get accessible routes, hands-free turn-by-turn navigation, and ask the campus assistant at VEC, Chennai.",
      },
    ],
  }),
  component: Index,
});

type Tab = "search" | "assistant" | "closures" | "position";
type Msg = { from: "you" | "bot"; text: string; room?: Room };

const MODES = { FIXED: 0.02, FLOAT: 0.5, SINGLE: 3.0, INDOOR: 0 } as const;
type Mode = keyof typeof MODES;

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
    if (!r)
      return {
        error: accessible
          ? ACCESSIBLE_UNAVAILABLE
          : "No route is available with the current closures.",
      } as const;
    return { route: r, cmp: compare(from, target.nodeId, opts) } as const;
  }, [target, from, accessible, closed]);

  const activeRoute: RouteResult | null = result && "route" in result ? result.route : null;

  // Real GPS & simulated positions for map rendering
  const [simPosition, setSimPosition] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    raw: number;
    idx: number;
  } | null>(null);

  const [realGpsPosition, setRealGpsPosition] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp?: number;
  } | null>(null);

  // Position Simulator Mode selection
  const [mode, setMode] = useState<Mode>("FIXED");

  // Hands-free turn-by-turn navigation hook
  const nav = useCampusNavigation({
    activeRoute,
    targetRoom: target,
    onPositionUpdate: (pos, isSimulation) => {
      if (isSimulation) {
        setSimPosition({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          raw: 0,
          idx: 0,
        });
      } else {
        setRealGpsPosition({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          timestamp: pos.timestamp,
        });
      }
    },
  });

  // Location Sharing Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTab, setShareTab] = useState<"gps" | "destination" | "route">("destination");

  const openShare = (
    defaultTab: "gps" | "destination" | "route" = "destination",
    roomToShare?: Room,
  ) => {
    if (roomToShare) {
      setTarget(roomToShare);
    }
    setShareTab(defaultTab);
    setShareOpen(true);
  };

  const navigateTo = (r: Room, acc?: boolean) => {
    setTarget(r);
    if (acc !== undefined) setAccessible(acc);
    nav.stopNavigation();
    setSimPosition(null);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Navigation className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">
              Campus Navigator <span className="text-route">AI</span>
            </h1>
            <p className="text-xs text-muted-foreground">Velammal Engineering College · Chennai</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openShare("gps")}
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-muted"
            title="Share real device GPS or campus destination via WhatsApp"
            aria-label="Share location via WhatsApp"
          >
            <Share2 className="h-3.5 w-3.5" /> Share Location
          </button>
          <Link
            to="/how-it-works"
            className="rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-muted"
          >
            How it works
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex min-h-0 w-full flex-col border-r bg-card md:w-[420px]">
          <nav className="grid grid-cols-4 gap-1 border-b p-2">
            {(
              [
                ["search", "Directions", Search],
                ["assistant", "Assistant", Bot],
                ["closures", "Closures", Construction],
                ["position", "Position", Satellite],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-semibold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {/* Active Turn-by-Turn Navigation HUD Card */}
            {nav.isNavigating && (
              <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                      nav.navSource === "gps"
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {nav.navSource === "gps" ? (
                      <>
                        <Navigation className="h-3 w-3 animate-pulse text-blue-600" />
                        <span>LIVE GPS NAVIGATION</span>
                        {nav.currentPosition && (
                          <span className="font-mono text-[10px]">
                            ±{Math.round(nav.currentPosition.accuracy)}m
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Satellite className="h-3 w-3 text-amber-600" />
                        <span>SIMULATION MODE</span>
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={nav.toggleMute}
                      className="rounded-lg border bg-background p-1.5 hover:bg-muted transition-colors"
                      title={nav.isMuted ? "Unmute spoken directions" : "Mute spoken directions"}
                      aria-label={
                        nav.isMuted ? "Unmute spoken directions" : "Mute spoken directions"
                      }
                    >
                      {nav.isMuted ? (
                        <VolumeX className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={nav.repeatInstruction}
                      className="rounded-lg border bg-background p-1.5 hover:bg-muted transition-colors"
                      title="Repeat instruction aloud"
                      aria-label="Repeat instruction aloud"
                    >
                      <RotateCcw className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={nav.stopNavigation}
                      className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground hover:opacity-90 transition-opacity"
                      title="Stop navigation"
                      aria-label="Stop navigation"
                    >
                      <Square className="h-3 w-3 fill-current" /> Stop
                    </button>
                  </div>
                </div>

                {/* Instruction step banner */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Step {nav.currentStepIndex + 1} of {nav.totalSteps}
                    </span>
                    <span className="font-semibold text-foreground">
                      ~{nav.remainingDistance} m to destination
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground leading-snug">
                    {nav.currentInstruction || "Proceed along the mapped walking path."}
                  </p>
                  {nav.nextInstruction && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">Next:</span>{" "}
                      {nav.nextInstruction}
                    </p>
                  )}
                </div>

                {nav.gpsError && (
                  <p className="rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-xs font-semibold text-destructive">
                    {nav.gpsError}
                  </p>
                )}
              </div>
            )}

            {tab === "search" && (
              <SearchTab
                query={query}
                setQuery={setQuery}
                from={from}
                setFrom={setFrom}
                accessible={accessible}
                setAccessible={setAccessible}
                onNavigate={navigateTo}
                onShareRoom={(r) => openShare("destination", r)}
                onShareRoute={() => openShare("route")}
                target={target}
                result={result}
                isNavigating={nav.isNavigating}
                onStartGpsNav={nav.startGpsNavigation}
                onStartSimNav={nav.startSimulationNavigation}
                onStopNav={nav.stopNavigation}
              />
            )}
            {tab === "assistant" && (
              <AssistantTab
                onNavigate={(r, a) => {
                  navigateTo(r, a);
                }}
                hydrated={hydrated}
                activeRoute={activeRoute}
                onStartGpsNav={nav.startGpsNavigation}
                isNavigating={nav.isNavigating}
              />
            )}
            {tab === "closures" && <ClosuresTab closed={closed} setClosed={setClosed} />}
            {tab === "position" && (
              <PositionTab
                mode={mode}
                setMode={setMode}
                simOn={nav.isNavigating && nav.navSource === "simulation"}
                onToggleSim={() => {
                  if (nav.isNavigating && nav.navSource === "simulation") {
                    nav.stopNavigation();
                  } else {
                    nav.startSimulationNavigation();
                  }
                }}
                position={simPosition}
                hasRoute={!!activeRoute}
                onOpenRealGps={() => openShare("gps")}
                onStartRealGpsNav={nav.startGpsNavigation}
              />
            )}
          </div>
        </aside>

        <section className="relative min-h-[50vh] flex-1">
          {hydrated && (
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-muted-foreground">
                  Loading map…
                </div>
              }
            >
              <CampusMap
                path={activeRoute?.path ?? null}
                closed={closed}
                position={simPosition}
                realGpsPosition={realGpsPosition}
              />
            </Suspense>
          )}

          {/* Quick share action button on map */}
          <div className="absolute top-3 right-3 z-[400] flex gap-2">
            <button
              type="button"
              onClick={() => openShare(activeRoute ? "route" : "gps")}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-panel backdrop-blur hover:bg-card transition-colors"
              title="Share your location or campus route via WhatsApp"
              aria-label={
                activeRoute ? "Share walking route via WhatsApp" : "Share location via WhatsApp"
              }
            >
              <Share2 className="h-3.5 w-3.5 text-primary" />
              <span>Share {activeRoute ? "Route" : "Location"}</span>
            </button>
          </div>
        </section>
      </div>

      <ShareLocationDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        defaultTab={shareTab}
        target={target}
        activeRoute={activeRoute}
        fromNodeId={from}
        onSelectDestination={(r) => setTarget(r)}
        realGpsPosition={realGpsPosition}
        onRealGpsAcquired={(p) => setRealGpsPosition(p)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "requires_confirmation"
      ? "Needs confirmation"
      : status === "verified"
        ? "Verified"
        : status === "approximate"
          ? "Approximate"
          : "Unverified";
  const cls =
    status === "verified"
      ? "bg-secondary text-secondary-foreground"
      : status === "requires_confirmation"
        ? "bg-warning text-warning-foreground"
        : status === "approximate"
          ? "bg-muted text-muted-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function SearchTab(p: {
  query: string;
  setQuery: (s: string) => void;
  from: string;
  setFrom: (s: string) => void;
  accessible: boolean;
  setAccessible: (b: boolean) => void;
  onNavigate: (r: Room) => void;
  onShareRoom: (r: Room) => void;
  onShareRoute: () => void;
  target: Room | null;
  result: ResultT;
  isNavigating: boolean;
  onStartGpsNav: () => void;
  onStartSimNav: () => void;
  onStopNav: () => void;
}) {
  const list = searchRooms(p.query);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          value={p.query}
          onChange={(e) => p.setQuery(e.target.value)}
          placeholder="Search any room, lab, canteen, hostel, block…"
          className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <select
          value={p.from}
          onChange={(e) => p.setFrom(e.target.value)}
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        >
          {startPoints.map((s) => (
            <option key={s.id} value={s.id}>
              From: {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => p.setAccessible(!p.accessible)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${p.accessible ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Accessibility className="h-4 w-4" /> {p.accessible ? "Accessible" : "Normal"}
        </button>
      </div>

      {p.target && p.result && (
        <RoutePanel
          target={p.target}
          result={p.result}
          onShareRoute={p.onShareRoute}
          isNavigating={p.isNavigating}
          onStartGpsNav={p.onStartGpsNav}
          onStartSimNav={p.onStartSimNav}
          onStopNav={p.onStopNav}
        />
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {list.length} campus rooms & landmarks
        </p>
        {list.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border p-3 ${p.target?.id === r.id ? "border-primary bg-secondary" : "bg-background"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  <span className="text-route">{r.code}</span> · {r.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.buildingName} · {floorName(r.floor)}
                  {r.dept ? ` · ${r.dept}` : ""}
                </p>
                {r.note && <p className="mt-1 text-xs text-warning-foreground">{r.note}</p>}
              </div>
              {r.status === "requires_confirmation" && <StatusBadge status={r.status} />}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => p.onNavigate(r)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <MapPin className="h-3 w-3" /> Navigate here
              </button>
              <button
                type="button"
                onClick={() => p.onShareRoom(r)}
                className="inline-flex items-center gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Share room via WhatsApp"
                aria-label={`Share ${r.code} ${r.name} via WhatsApp`}
              >
                <Share2 className="h-3 w-3" /> Share
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// type helper for the memoised result
type ResultT = { error: string } | { route: RouteResult; cmp: ReturnType<typeof compare> } | null;

function RoutePanel({
  target,
  result,
  onShareRoute,
  isNavigating,
  onStartGpsNav,
  onStartSimNav,
  onStopNav,
}: {
  target: Room;
  result: NonNullable<ResultT>;
  onShareRoute: () => void;
  isNavigating: boolean;
  onStartGpsNav: () => void;
  onStartSimNav: () => void;
  onStopNav: () => void;
}) {
  if ("error" in result) {
    return (
      <div className="rounded-xl border border-destructive bg-background p-3 text-sm font-semibold text-destructive">
        {result.error}
      </div>
    );
  }
  const r = result.route;
  const { astar, dijkstra } = result.cmp;
  return (
    <div className="space-y-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-panel">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider opacity-80">Route to</p>
        <button
          type="button"
          onClick={onShareRoute}
          className="inline-flex items-center gap-1.5 rounded-lg bg-card text-card-foreground px-2.5 py-1 text-xs font-bold shadow hover:bg-card/90 transition-colors"
          title="Share route via WhatsApp"
          aria-label="Share walking route via WhatsApp"
        >
          <Share2 className="h-3.5 w-3.5 text-route" /> Share Route
        </button>
      </div>
      <h2 className="text-lg font-bold leading-tight">
        {target.code} · {target.name}
      </h2>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1">
          <Footprints className="h-4 w-4" /> {Math.round(r.distance)} m
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" /> {Math.max(1, Math.round(r.etaSeconds / 60))} min walk
        </span>
      </div>

      {/* Hands-Free Navigation Action Controls */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        {!isNavigating ? (
          <>
            <button
              type="button"
              onClick={onStartGpsNav}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-card text-card-foreground px-3 py-2 text-xs font-bold hover:bg-card/90 transition-colors shadow"
              aria-label="Start hands-free live GPS navigation"
            >
              <Navigation className="h-3.5 w-3.5 text-blue-600" /> Start Live GPS Nav
            </button>
            <button
              type="button"
              onClick={onStartSimNav}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/15 border border-primary-foreground/30 px-3 py-2 text-xs font-bold hover:bg-primary-foreground/25 transition-colors"
              aria-label="Start simulated navigation walk"
            >
              <Play className="h-3.5 w-3.5" /> Sim Walk
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStopNav}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive text-destructive-foreground px-3 py-2 text-xs font-bold hover:opacity-90 transition-opacity shadow"
            aria-label="Stop navigation"
          >
            <Square className="h-3.5 w-3.5 fill-current" /> Stop Active Navigation
          </button>
        )}
      </div>

      <ol className="space-y-1.5 rounded-xl bg-card p-3 text-sm text-card-foreground">
        {r.instructions.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-bold text-route">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-xl bg-card p-3 text-xs text-card-foreground">
        <p className="mb-2 font-semibold">Speed comparison (avg of 200 runs)</p>
        <table className="w-full">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-medium">Method</th>
              <th className="text-right font-medium">Time</th>
              <th className="text-right font-medium">Nodes checked</th>
              <th className="text-right font-medium">Distance</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["A*", astar],
              ["Dijkstra", dijkstra],
            ].map(([n, v]) => {
              const x = v as typeof astar;
              return (
                <tr key={n as string}>
                  <td className="font-semibold">{n as string}</td>
                  <td className="text-right">{x.avgMs.toFixed(3)} ms</td>
                  <td className="text-right">{x.res?.visited ?? 0}</td>
                  <td className="text-right">{Math.round(x.res?.distance ?? 0)} m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] opacity-80">
        Indoor distances are estimates from placeholder layouts.
      </p>
    </div>
  );
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// Strongly-typed SpeechRecognition interface to eliminate any errors
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function AssistantTab({
  onNavigate,
  hydrated,
  activeRoute,
  onStartGpsNav,
  isNavigating,
}: {
  onNavigate: (r: Room, acc: boolean) => void;
  hydrated: boolean;
  activeRoute: RouteResult | null;
  onStartGpsNav: () => void;
  isNavigating: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "bot",
      text: "Hi! Ask me “Where is room 860?”, “Take me to Canteen”, or “Directions to room 864 without stairs”.",
    },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const pending = useRef<{ room: Room; acc: boolean } | null>(null);

  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const text = activeRoute
      ? `Route to ${p.room.code}: ${Math.round(activeRoute.distance)} metres, about ${Math.max(1, Math.round(activeRoute.etaSeconds / 60))} minutes. ${activeRoute.instructions.join(" ")}`
      : p.acc
        ? ACCESSIBLE_UNAVAILABLE
        : "No route is available with the current closures.";
    setMsgs((m) => [...m, { from: "bot", text, room: p.room }]);
  }, [activeRoute]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    const intent = parse(text);
    const next: Msg[] = [{ from: "you", text }];
    if (intent.type === "navigate") {
      next.push({
        from: "bot",
        text: `${describe(intent.room)} ${intent.accessible ? "Planning a step-free route…" : "Planning your route…"}`,
        room: intent.room,
      });
      pending.current = { room: intent.room, acc: intent.accessible };
      onNavigate(intent.room, intent.accessible);
    } else if (intent.type === "search") {
      intent.matches
        .slice(0, 4)
        .forEach((r) => next.push({ from: "bot", text: describe(r), room: r }));
    } else next.push({ from: "bot", text: intent.text });
    setMsgs((m) => [...m, ...next]);
    setInput("");
  };

  const listen = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setMsgs((m) => [
        ...m,
        { from: "bot", text: "Voice input isn't supported in this browser. Try Chrome or Edge." },
      ]);
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onresult = (e: SpeechRecognitionEvent) => ask(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.from === "you" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <p>{m.text}</p>
            {m.from === "bot" && (
              <div className="mt-1 flex flex-wrap gap-2 pt-1 border-t border-current/10">
                <button
                  onClick={() => speak(m.text)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <Volume2 className="h-3 w-3" /> Read aloud
                </button>
                {m.room && (
                  <button
                    onClick={() => onNavigate(m.room!, false)}
                    className="text-xs font-semibold text-route"
                  >
                    Select destination →
                  </button>
                )}
                {m.room && activeRoute && !isNavigating && (
                  <button
                    onClick={onStartGpsNav}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Navigation className="h-3 w-3" /> Start GPS Nav
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 flex gap-2 bg-card pt-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any room or building…"
          className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {hydrated && (
          <button
            type="button"
            onClick={listen}
            aria-label="Speak voice question"
            className={`rounded-xl border px-3 ${listening ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Ask
        </button>
      </form>
    </div>
  );
}

function ClosuresTab({
  closed,
  setClosed,
}: {
  closed: Set<string>;
  setClosed: (s: Set<string>) => void;
}) {
  const groups: [string, { id: string; label: string }[]][] = [
    [
      "Entrances",
      Object.values(nodes)
        .filter((n) => n.kind === "entrance")
        .map((n) => ({ id: n.id, label: n.label })),
    ],
    ["Stairs", edges.filter((e) => e.kind === "stairs").map((e) => ({ id: e.id, label: e.label }))],
    ["Lifts", edges.filter((e) => e.kind === "lift").map((e) => ({ id: e.id, label: e.label }))],
    [
      "Outdoor paths",
      edges.filter((e) => e.kind === "outdoor").map((e) => ({ id: e.id, label: e.label })),
    ],
    [
      "Corridors",
      Array.from(
        new Map(edges.filter((e) => e.kind === "corridor").map((e) => [e.label, e])).values(),
      ).map((e) => ({ id: `corr:${e.label}`, label: e.label })),
    ],
  ];
  const corridorIds = (label: string) =>
    edges.filter((e) => e.kind === "corridor" && e.label === label).map((e) => e.id);
  const isClosed = (id: string) =>
    id.startsWith("corr:") ? corridorIds(id.slice(5)).every((x) => closed.has(x)) : closed.has(id);
  const toggle = (id: string) => {
    const n = new Set(closed);
    const ids = id.startsWith("corr:") ? corridorIds(id.slice(5)) : [id];
    const close = !isClosed(id);
    ids.forEach((x) => (close ? n.add(x) : n.delete(x)));
    setClosed(n);
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Close anything that's blocked. Routes avoid it right away. Closures reset when the page
        reloads.
      </p>
      {groups.map(([title, items]) => (
        <div key={title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div className="space-y-1.5">
            {items.map((it) => (
              <label
                key={it.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span>{it.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold ${isClosed(it.id) ? "text-destructive" : "text-success"}`}
                  >
                    {isClosed(it.id) ? "Closed" : "Open"}
                  </span>
                  <input
                    type="checkbox"
                    checked={isClosed(it.id)}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4 accent-[var(--destructive)]"
                  />
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionTab(p: {
  mode: Mode;
  setMode: (m: Mode) => void;
  simOn: boolean;
  onToggleSim: () => void;
  position: { accuracy: number; raw: number } | null;
  hasRoute: boolean;
  onOpenRealGps: () => void;
  onStartRealGpsNav: () => void;
}) {
  const desc: Record<Mode, string> = {
    FIXED: "Simulated RTK fixed · ~2 cm noise",
    FLOAT: "Simulated RTK float · ~0.5 m noise",
    SINGLE: "Standard consumer GPS · ~3 m noise (snapped to path)",
    INDOOR: "Indoor mode · zero satellite signal (follows path)",
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs font-semibold text-amber-900 dark:text-amber-200 space-y-1">
        <p className="font-bold">⚠️ SENSOR SIMULATION ENGINE</p>
        <p className="text-[11px] font-normal leading-relaxed">
          The walk below simulates positioning noise profiles. Consumer smartphones achieve ~3–5 m
          accuracy via standard GPS. Genuine centimetre-level RTK requires external dual-frequency
          GNSS antenna hardware with differential NTRIP base stations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => p.setMode(m)}
            className={`rounded-xl border p-3 text-left transition-colors ${p.mode === m ? "border-primary bg-secondary" : "hover:bg-muted"}`}
          >
            <p className="font-bold">{m}</p>
            <p className="text-xs text-muted-foreground">{desc[m]}</p>
          </button>
        ))}
      </div>

      <button
        disabled={!p.hasRoute}
        onClick={p.onToggleSim}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 transition-opacity"
      >
        {p.simOn ? "Stop simulated walk" : "Start simulated walk"}
      </button>

      {!p.hasRoute && (
        <p className="text-xs text-muted-foreground">
          Pick a destination in Directions first, then start the walk.
        </p>
      )}

      {p.position && (
        <div className="rounded-xl border bg-background p-3 text-sm space-y-1">
          <p>
            Shown accuracy: <b>{p.position.accuracy.toFixed(2)} m</b>
          </p>
          <p>
            Raw error this fix: <b>{p.position.raw.toFixed(2)} m</b>
          </p>
          <p className="text-xs text-muted-foreground">
            Inside buildings, satellite positioning switches off automatically.
          </p>
        </div>
      )}

      {/* Real Device Hardware GPS section */}
      <div className="rounded-xl border bg-card p-3 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5 text-foreground">
            <Smartphone className="h-3.5 w-3.5 text-primary" /> Real Hardware Device GPS
          </span>
          <button
            type="button"
            onClick={p.onOpenRealGps}
            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
            aria-label="Acquire real device GPS and share via WhatsApp"
          >
            <Share2 className="h-3 w-3" /> Acquire & Share
          </button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          To track your real hardware GPS position live while walking around campus with spoken
          turn-by-turn guidance:
        </p>
        <button
          type="button"
          disabled={!p.hasRoute}
          onClick={p.onStartRealGpsNav}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold transition-colors disabled:opacity-40"
        >
          <Navigation className="h-3.5 w-3.5" /> Start Live Device GPS Navigation
        </button>
      </div>
    </div>
  );
}
