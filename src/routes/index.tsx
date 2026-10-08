import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Construction,
  Footprints,
  MapPin,
  Mic,
  Navigation,
  Play,
  RotateCcw,
  Satellite,
  Search,
  Share2,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { edges, nodes, N, floorName, startPoints, type Room } from "@/lib/campus/data";
import { compare, route, ACCESSIBLE_UNAVAILABLE, type RouteResult } from "@/lib/campus/routing";
import { describe, parse, searchRooms } from "@/lib/campus/assistant";
import { ShareLocationDialog } from "@/components/campus/ShareLocationDialog";

const CampusMap = lazy(() => import("@/components/campus/CampusMap").then((m) => ({ default: m.CampusMap })));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Navigator AI — Velammal Engineering College" },
      {
        name: "description",
        content:
          "Find any room in Abdul Kalam Block, Kirloskar Block, Anna Auditorium, Founder Chairman Block (FCB) or Visvesvaraya Block with spoken hands-free walking directions.",
      },
      { property: "og:title", content: "Campus Navigator AI — VEC" },
      {
        property: "og:description",
        content: "Search rooms, get accessible routes, voice guidance, and WhatsApp route sharing at VEC, Chennai.",
      },
    ],
  }),
  component: Index,
});

type Tab = "search" | "assistant" | "closures" | "position";
type Msg = { from: "you" | "bot"; text: string; room?: Room; canStartNav?: boolean };

const MODES = { FIXED: 0.02, FLOAT: 0.5, SINGLE: 3.0, INDOOR: 0 } as const;
type Mode = keyof typeof MODES;

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.onerror = () => {
      // Non-blocking fallback if speech is interrupted or unavailable
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful non-blocking fallback
  }
}

export function Index() {
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

  // ---- Hands-Free Live Navigation state ----
  const [navigating, setNavigating] = useState(false);
  const [navStep, setNavStep] = useState(0);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [gpsTrackingStatus, setGpsTrackingStatus] = useState<"idle" | "tracking" | "denied" | "unavailable" | "unsupported">("idle");
  const watchIdRef = useRef<number | null>(null);

  // ---- Position simulator ----
  const [mode, setMode] = useState<Mode>("FIXED");
  const [simOn, setSimOn] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number; raw: number; idx: number } | null>(null);
  const stepRef = useRef(0);

  // ---- Real device GPS & WhatsApp Location Sharing state ----
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTab, setShareTab] = useState<"gps" | "destination" | "route">("destination");
  const [realGpsPosition, setRealGpsPosition] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp?: number;
  } | null>(null);

  const openShare = (defaultTab: "gps" | "destination" | "route" = "destination", roomToShare?: Room) => {
    if (roomToShare) {
      setTarget(roomToShare);
    }
    setShareTab(defaultTab);
    setShareOpen(true);
  };

  // Start live hands-free navigation
  const startNavigation = () => {
    if (!activeRoute || !target) return;
    setNavigating(true);
    setNavStep(0);
    if (!voiceMuted) {
      speak(`Starting navigation to ${target.code}, ${target.name}. Step 1: ${activeRoute.instructions[0] || "Follow the marked route."}`);
    }

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setGpsTrackingStatus("idle");
      try {
        const wid = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            setRealGpsPosition({
              lat: latitude,
              lng: longitude,
              accuracy,
              timestamp: pos.timestamp,
            });
            setGpsTrackingStatus("tracking");
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setGpsTrackingStatus("denied");
            } else {
              setGpsTrackingStatus("unavailable");
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000,
          }
        );
        watchIdRef.current = wid;
      } catch {
        setGpsTrackingStatus("unavailable");
      }
    } else {
      setGpsTrackingStatus("unsupported");
    }
  };

  // Stop active navigation
  const stopNavigation = () => {
    setNavigating(false);
    setNavStep(0);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsTrackingStatus("idle");
  };

  const goToStep = (stepIdx: number) => {
    if (!activeRoute || !target) return;
    const clamped = Math.max(0, Math.min(stepIdx, activeRoute.instructions.length - 1));
    setNavStep(clamped);
    if (!voiceMuted) {
      if (clamped >= activeRoute.instructions.length - 1) {
        speak(`Final step: ${activeRoute.instructions[clamped]}. Arriving at ${target.code}.`);
      } else {
        speak(`Step ${clamped + 1}: ${activeRoute.instructions[clamped]}`);
      }
    }
  };

  const nextStep = () => {
    if (!activeRoute) return;
    if (navStep < activeRoute.instructions.length - 1) {
      goToStep(navStep + 1);
    } else {
      if (!voiceMuted && target) {
        speak(`You have reached your destination: ${target.code}, ${target.name}.`);
      }
      stopNavigation();
    }
  };

  const prevStep = () => {
    if (navStep > 0) {
      goToStep(navStep - 1);
    }
  };

  const repeatCurrentStep = () => {
    if (!activeRoute) return;
    speak(`Step ${navStep + 1}: ${activeRoute.instructions[navStep]}`);
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Position simulation loop
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

      // Advance navigation step automatically if walking in simulated mode
      if (navigating && activeRoute && activeRoute.instructions.length > 0) {
        const stepProgress = Math.min(
          Math.floor((t / (pts.length - 1)) * activeRoute.instructions.length),
          activeRoute.instructions.length - 1
        );
        setNavStep((curr) => {
          if (stepProgress > curr) {
            if (!voiceMuted) {
              speak(`Step ${stepProgress + 1}: ${activeRoute.instructions[stepProgress]}`);
            }
            return stepProgress;
          }
          return curr;
        });
      }

      if (t >= pts.length - 1) {
        setSimOn(false);
        if (navigating && target && !voiceMuted) {
          speak(`Arrived at destination: ${target.code}, ${target.name}.`);
        }
      }
    }, 400);
    return () => clearInterval(id);
  }, [simOn, activeRoute, mode, navigating, voiceMuted, target]);

  const navigateTo = (r: Room, acc?: boolean) => {
    stopNavigation();
    setTarget(r);
    if (acc !== undefined) setAccessible(acc);
    setSimOn(false);
    setPosition(null);
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
          <Link to="/how-it-works" className="rounded-full border px-4 py-1.5 text-sm font-semibold hover:bg-muted">
            How it works
          </Link>
        </div>
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
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
                navigating={navigating}
                navStep={navStep}
                onStartNav={startNavigation}
                onStopNav={stopNavigation}
                onNextStep={nextStep}
                onPrevStep={prevStep}
                onRepeatStep={repeatCurrentStep}
                voiceMuted={voiceMuted}
                onToggleMute={() => {
                  const nm = !voiceMuted;
                  setVoiceMuted(nm);
                  if (!nm && activeRoute) speak(activeRoute.instructions[navStep]);
                  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
                }}
                gpsTrackingStatus={gpsTrackingStatus}
                gpsAccuracy={realGpsPosition?.accuracy}
                simOn={simOn}
                onToggleSim={() => setSimOn(!simOn)}
              />
            )}
            {tab === "assistant" && (
              <AssistantTab
                onNavigate={(r, a) => {
                  navigateTo(r, a);
                }}
                onStartNav={startNavigation}
                hydrated={hydrated}
                activeRoute={activeRoute}
                navigating={navigating}
              />
            )}
            {tab === "closures" && <ClosuresTab closed={closed} setClosed={setClosed} />}
            {tab === "position" && (
              <PositionTab
                mode={mode}
                setMode={setMode}
                simOn={simOn}
                setSimOn={setSimOn}
                position={position}
                hasRoute={!!activeRoute}
                onOpenRealGps={() => openShare("gps")}
              />
            )}
          </div>
        </aside>

        <section className="relative min-h-[50vh] flex-1">
          {hydrated && (
            <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Loading map…</div>}>
              <CampusMap
                path={activeRoute?.path ?? null}
                closed={closed}
                position={position}
                realGpsPosition={realGpsPosition}
              />
            </Suspense>
          )}

          {/* Floating Navigation HUD Banner above Map during active navigation */}
          {navigating && activeRoute && target && (
            <div className="absolute top-3 left-3 right-16 z-[450] max-w-lg rounded-2xl bg-card/95 p-3 shadow-panel backdrop-blur border text-card-foreground">
              <div className="flex items-center justify-between text-xs pb-1 mb-1 border-b">
                <span className="font-bold flex items-center gap-1 text-primary">
                  <Navigation className="h-3.5 w-3.5" /> Step {navStep + 1} of {activeRoute.instructions.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={repeatCurrentStep}
                    className="p-1 rounded-lg hover:bg-muted"
                    title="Repeat spoken instruction"
                    aria-label="Repeat spoken instruction"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMute = !voiceMuted;
                      setVoiceMuted(nextMute);
                      if (!nextMute) speak(activeRoute.instructions[navStep]);
                      else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
                    }}
                    className="p-1 rounded-lg hover:bg-muted"
                    title={voiceMuted ? "Unmute spoken directions" : "Mute spoken directions"}
                    aria-label={voiceMuted ? "Unmute voice" : "Mute voice"}
                  >
                    {voiceMuted ? <VolumeX className="h-3.5 w-3.5 text-destructive" /> : <Volume2 className="h-3.5 w-3.5 text-primary" />}
                  </button>
                  <button
                    type="button"
                    onClick={stopNavigation}
                    className="ml-1 inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground hover:opacity-90"
                    aria-label="Stop navigation"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" /> Stop
                  </button>
                </div>
              </div>
              <p className="text-xs font-bold leading-snug">{activeRoute.instructions[navStep]}</p>
              <div className="flex justify-end gap-2 pt-1.5 mt-1 border-t text-[11px]">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={navStep === 0}
                  className="px-2 py-0.5 rounded border disabled:opacity-40"
                  aria-label="Previous step"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-2.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold"
                  aria-label="Next step"
                >
                  {navStep >= activeRoute.instructions.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 z-[400] flex gap-2">
            <button
              type="button"
              onClick={() => openShare(activeRoute ? "route" : "gps")}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-panel backdrop-blur hover:bg-card transition-colors"
              title="Share your location or campus route via WhatsApp"
              aria-label={activeRoute ? "Share walking route via WhatsApp" : "Share location via WhatsApp"}
            >
              <Share2 className="h-3.5 w-3.5 text-primary" />
              <span>Share {activeRoute ? "Route" : "Location"}</span>
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-xs rounded-xl bg-warning px-3 py-2 text-xs text-warning-foreground shadow-panel">
            Building spots are approximate. Indoor layouts and entrances need confirmation.
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
        : "Unverified";
  const cls =
    status === "verified"
      ? "bg-secondary text-secondary-foreground"
      : status === "requires_confirmation"
        ? "bg-warning text-warning-foreground"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{label}</span>;
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
  navigating: boolean;
  navStep: number;
  onStartNav: () => void;
  onStopNav: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onRepeatStep: () => void;
  voiceMuted: boolean;
  onToggleMute: () => void;
  gpsTrackingStatus: "idle" | "tracking" | "denied" | "unavailable" | "unsupported";
  gpsAccuracy?: number;
  simOn: boolean;
  onToggleSim: () => void;
}) {
  const list = searchRooms(p.query);
  const activeRoute = p.result && "route" in p.result ? p.result.route : null;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          value={p.query}
          onChange={(e) => p.setQuery(e.target.value)}
          placeholder="Room number, name, department, block…"
          className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <select value={p.from} onChange={(e) => p.setFrom(e.target.value)} className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm">
          {startPoints.map((s) => (
            <option key={s.id} value={s.id}>
              From: {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => p.setAccessible(!p.accessible)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
            p.accessible ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          <Accessibility className="h-4 w-4" /> {p.accessible ? "Accessible" : "Normal"}
        </button>
      </div>

      {/* Render Active Navigation HUD or Route Summary Panel */}
      {p.target && p.result && (
        p.navigating && activeRoute ? (
          <NavigationHUD
            target={p.target}
            route={activeRoute}
            currentStep={p.navStep}
            totalSteps={activeRoute.instructions.length}
            onNext={p.onNextStep}
            onPrev={p.onPrevStep}
            onStop={p.onStopNav}
            onRepeat={p.onRepeatStep}
            voiceMuted={p.voiceMuted}
            onToggleMute={p.onToggleMute}
            trackingStatus={p.gpsTrackingStatus}
            accuracy={p.gpsAccuracy}
            simOn={p.simOn}
            onToggleSim={p.onToggleSim}
            onShareRoute={p.onShareRoute}
          />
        ) : (
          <RoutePanel
            target={p.target}
            result={p.result}
            onShareRoute={p.onShareRoute}
            onStartNavigation={p.onStartNav}
          />
        )
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{list.length} rooms</p>
        {list.map((r) => (
          <div key={r.id} className={`rounded-xl border p-3 ${p.target?.id === r.id ? "border-primary bg-secondary" : "bg-background"}`}>
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
  onStartNavigation,
}: {
  target: Room;
  result: NonNullable<ResultT>;
  onShareRoute: () => void;
  onStartNavigation: () => void;
}) {
  if ("error" in result) {
    return <div className="rounded-xl border border-destructive bg-background p-3 text-sm font-semibold text-destructive">{result.error}</div>;
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

      {/* Start Hands-Free Navigation button */}
      <button
        type="button"
        onClick={onStartNavigation}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-card text-card-foreground py-2.5 text-xs font-bold shadow hover:bg-card/90 transition-colors"
        aria-label="Start hands-free turn-by-turn voice navigation"
      >
        <Play className="h-3.5 w-3.5 fill-current text-route" /> Start Hands-Free Navigation
      </button>

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
                  <td className="text-right">{x.res?.visited}</td>
                  <td className="text-right">{Math.round(x.res?.distance ?? 0)} m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] opacity-80">Indoor distances are estimates from placeholder layouts.</p>
    </div>
  );
}

function NavigationHUD(p: {
  target: Room;
  route: RouteResult;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
  onRepeat: () => void;
  voiceMuted: boolean;
  onToggleMute: () => void;
  trackingStatus: "idle" | "tracking" | "denied" | "unavailable" | "unsupported";
  accuracy?: number;
  simOn: boolean;
  onToggleSim: () => void;
  onShareRoute: () => void;
}) {
  const currentInstruction = p.route.instructions[p.currentStep] ?? "Arrive at destination.";
  const nextInstruction = p.route.instructions[p.currentStep + 1];
  const isLast = p.currentStep >= p.totalSteps - 1;

  return (
    <div className="space-y-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-panel">
      {/* Top Bar with Step index, status & Stop Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 items-center rounded-full bg-card px-2.5 text-xs font-bold text-card-foreground">
            Step {p.currentStep + 1} of {p.totalSteps}
          </span>
          {p.simOn ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              🎮 Simulated Walk
            </span>
          ) : p.trackingStatus === "tracking" ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
              📍 GPS ±{Math.round(p.accuracy ?? 5)}m
            </span>
          ) : p.trackingStatus === "denied" ? (
            <span className="rounded-full bg-card/20 px-2 py-0.5 text-[10px] font-medium text-primary-foreground/80">
              Manual step
            </span>
          ) : (
            <span className="rounded-full bg-card/20 px-2 py-0.5 text-[10px] font-medium text-primary-foreground/80">
              Indoor/Manual
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={p.onStop}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground hover:opacity-90 transition-colors shadow"
          title="Stop active hands-free navigation"
          aria-label="Stop navigation"
        >
          <Square className="h-3 w-3 fill-current" /> Stop
        </button>
      </div>

      {/* Target heading */}
      <div>
        <p className="text-[11px] uppercase tracking-wider opacity-80">Guiding you to</p>
        <h2 className="text-base font-bold leading-tight">
          {p.target.code} · {p.target.name}
        </h2>
        <p className="text-xs opacity-90">
          {p.target.buildingName} · {floorName(p.target.floor)}
        </p>
      </div>

      {/* Main Instruction Card */}
      <div className="rounded-xl bg-card p-3.5 text-card-foreground shadow space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Footprints className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold leading-snug">{currentInstruction}</p>
            {nextInstruction && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Next:</span> {nextInstruction}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons inside card */}
        <div className="flex items-center justify-between pt-2 border-t text-xs">
          <button
            type="button"
            onClick={p.onRepeat}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            title="Repeat spoken instruction"
            aria-label="Repeat spoken instruction"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Repeat
          </button>
          <button
            type="button"
            onClick={p.onToggleMute}
            className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
            title={p.voiceMuted ? "Unmute spoken directions" : "Mute spoken directions"}
            aria-label={p.voiceMuted ? "Unmute spoken directions" : "Mute spoken directions"}
          >
            {p.voiceMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5 text-destructive" /> Muted
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-primary" /> Spoken on
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stepping controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={p.onPrev}
          disabled={p.currentStep === 0}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-primary-foreground/30 bg-primary/20 py-2 text-xs font-bold disabled:opacity-30 hover:bg-primary/40 transition-colors"
          aria-label="Previous navigation step"
        >
          <ChevronLeft className="h-4 w-4" /> Prev Step
        </button>
        <button
          type="button"
          onClick={p.onNext}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-card text-card-foreground py-2 text-xs font-bold shadow hover:bg-card/90 transition-colors"
          aria-label={isLast ? "Complete navigation" : "Next navigation step"}
        >
          {isLast ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" /> Finish
            </>
          ) : (
            <>
              Next Step <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Simulated walk toggle & notes */}
      <div className="flex items-center justify-between text-[11px] pt-1 opacity-90">
        <button
          type="button"
          onClick={p.onToggleSim}
          className="underline hover:opacity-100"
          title="Toggle simulated positioning walk"
        >
          {p.simOn ? "Stop simulated walk" : "Preview with simulated walk"}
        </button>
        <button
          type="button"
          onClick={p.onShareRoute}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <Share2 className="h-3 w-3" /> Share
        </button>
      </div>
      <p className="text-[10px] opacity-75">
        Live positioning uses hardware device GPS when permitted. Simulated walk is a preview only.
      </p>
    </div>
  );
}

function AssistantTab({
  onNavigate,
  onStartNav,
  hydrated,
  activeRoute,
  navigating,
}: {
  onNavigate: (r: Room, acc: boolean) => void;
  onStartNav: () => void;
  hydrated: boolean;
  activeRoute: RouteResult | null;
  navigating: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "bot",
      text: "Hi! Ask me “Where is room 860?”, “Take me to Civil Lab 1”, or “Take me to room 401 without stairs”.",
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
    setMsgs((m) => [...m, { from: "bot", text, canStartNav: !!activeRoute }]);
  }, [activeRoute]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    const intent = parse(text);
    const next: Msg[] = [{ from: "you", text }];
    if (intent.type === "navigate") {
      next.push({
        from: "bot",
        text: `${describe(intent.room)} ${intent.accessible ? "Planning a step-free route…" : "Planning your route…"}`
      });
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
    if (!SR) {
      setMsgs((m) => [...m, { from: "bot", text: "Voice input isn't supported in this browser. Try Chrome or Edge." }]);
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.onresult = (e: any) => ask(e.results[0][0].transcript);
    rec.onerror = () => {
      setListening(false);
    };
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
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.from === "you" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            <p>{m.text}</p>
            {m.from === "bot" && (
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => speak(m.text)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <Volume2 className="h-3 w-3" /> Read aloud
                </button>
                {m.room && (
                  <button
                    type="button"
                    onClick={() => onNavigate(m.room!, false)}
                    className="text-xs font-semibold text-route"
                  >
                    Navigate here →
                  </button>
                )}
                {m.canStartNav && !navigating && (
                  <button
                    type="button"
                    onClick={onStartNav}
                    className="inline-flex items-center gap-1 text-xs font-bold text-success hover:underline"
                  >
                    <Play className="h-3 w-3 fill-current" /> Start hands-free navigation →
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
          placeholder="Ask about any room…"
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
    [
      "Corridors",
      Array.from(new Map(edges.filter((e) => e.kind === "corridor").map((e) => [e.label, e])).values()).map((e) => ({
        id: `corr:${e.label}`,
        label: e.label,
      })),
    ],
  ];
  const corridorIds = (label: string) => edges.filter((e) => e.kind === "corridor" && e.label === label).map((e) => e.id);
  const isClosed = (id: string) => (id.startsWith("corr:") ? corridorIds(id.slice(5)).every((x) => closed.has(x)) : closed.has(id));
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
        Close anything that's blocked. Routes avoid it right away. Closures reset when the page reloads.
      </p>
      {groups.map(([title, items]) => (
        <div key={title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="space-y-1.5">
            {items.map((it) => (
              <label
                key={it.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <span>{it.label}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isClosed(it.id) ? "text-destructive" : "text-success"}`}>
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
  setSimOn: (b: boolean) => void;
  position: { accuracy: number; raw: number } | null;
  hasRoute: boolean;
  onOpenRealGps: () => void;
}) {
  const desc: Record<Mode, string> = {
    FIXED: "RTK fixed · about 2 cm error",
    FLOAT: "RTK float · about 0.5 m error",
    SINGLE: "Standard GPS · about 3 m error (snapped to route)",
    INDOOR: "No satellite signal · position follows the route",
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-warning p-3 text-xs font-semibold text-warning-foreground">
        Simulation only. This is not real RTK positioning or hardware GPS.
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => p.setMode(m)}
            className={`rounded-xl border p-3 text-left ${p.mode === m ? "border-primary bg-secondary" : "hover:bg-muted"}`}
          >
            <p className="font-bold">{m}</p>
            <p className="text-xs text-muted-foreground">{desc[m]}</p>
          </button>
        ))}
      </div>
      <button
        disabled={!p.hasRoute}
        onClick={() => p.setSimOn(!p.simOn)}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {p.simOn ? "Stop walk" : "Start simulated walk"}
      </button>
      {!p.hasRoute && <p className="text-xs text-muted-foreground">Pick a destination first, then start the walk.</p>}
      {p.position && (
        <div className="rounded-xl border bg-background p-3 text-sm">
          <p>
            Shown accuracy: <b>{p.position.accuracy.toFixed(2)} m</b>
          </p>
          <p>
            Raw error this fix: <b>{p.position.raw.toFixed(2)} m</b>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Inside buildings, satellite positioning switches off automatically.</p>
        </div>
      )}

      {/* Real Device Hardware GPS section distinguishing from simulation */}
      <div className="rounded-xl border bg-card p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5 text-foreground">
            <Smartphone className="h-3.5 w-3.5 text-primary" /> Real Device GPS
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
          The walk above is a simulation. To acquire your actual hardware device GPS sensor coordinates and share them via WhatsApp, tap Acquire & Share.
        </p>
      </div>
    </div>
  );
}
