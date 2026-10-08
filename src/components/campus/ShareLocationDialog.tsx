import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildings,
  floorName,
  N,
  rooms,
  type Room,
} from "@/lib/campus/data";
import type { RouteResult } from "@/lib/campus/routing";
import {
  createWhatsAppShareUrl,
  findNearestCampusPlace,
  formatCurrentLocationMessage,
  formatDestinationMessage,
  formatRouteMessage,
  getGoogleMapsDirectionsUrl,
  getGoogleMapsPointUrl,
  getOpenStreetMapDirectionsUrl,
  getOpenStreetMapPointUrl,
  isValidCoordinate,
  type Coordinates,
} from "@/lib/campus/sharing";

type ShareTab = "gps" | "destination" | "route";

function isShareTab(value: string): value is ShareTab {
  return value === "gps" || value === "destination" || value === "route";
}

export interface ShareLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ShareTab;
  target: Room | null;
  activeRoute: RouteResult | null;
  fromNodeId: string;
  onSelectDestination?: (room: Room) => void;
  realGpsPosition: { lat: number; lng: number; accuracy: number; timestamp?: number } | null;
  onRealGpsAcquired: (pos: { lat: number; lng: number; accuracy: number; timestamp?: number }) => void;
}

export function ShareLocationDialog({
  open,
  onOpenChange,
  defaultTab = "destination",
  target,
  activeRoute,
  fromNodeId,
  onSelectDestination,
  realGpsPosition,
  onRealGpsAcquired,
}: ShareLocationDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>(defaultTab);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(target?.id ?? rooms[0]?.id ?? "");
  const [roomFilter, setRoomFilter] = useState("");

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Clipboard copy state
  const [copied, setCopied] = useState(false);
  const [clipboardError, setClipboardError] = useState(false);

  // Live location details disclosure
  const [showLiveInfo, setShowLiveInfo] = useState(false);

  // Update activeTab when defaultTab changes on dialog open
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      if (target) {
        setSelectedRoomId(target.id);
      }
      setCopied(false);
      setClipboardError(false);
    }
  }, [open, defaultTab, target]);

  // Selected room resolution
  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) ?? target ?? rooms[0] ?? null;
  }, [selectedRoomId, target]);

  // Destination coordinates
  const destCoords = useMemo<Coordinates | null>(() => {
    if (!currentRoom) return null;
    try {
      const node = N(currentRoom.nodeId);
      if (isValidCoordinate(node.lat, node.lng)) {
        return { lat: node.lat, lng: node.lng };
      }
    } catch {
      // fallback to building coords if room node lookup fails
      const b = buildings.find((x) => x.id === currentRoom.building);
      if (b && isValidCoordinate(b.lat, b.lng)) {
        return { lat: b.lat, lng: b.lng };
      }
    }
    return null;
  }, [currentRoom]);

  // Origin coordinates for route
  const originCoords = useMemo<Coordinates | null>(() => {
    try {
      const node = N(fromNodeId);
      if (isValidCoordinate(node.lat, node.lng)) {
        return { lat: node.lat, lng: node.lng };
      }
    } catch {
      return null;
    }
    return null;
  }, [fromNodeId]);

  const originLabel = useMemo(() => {
    try {
      return N(fromNodeId).label;
    } catch {
      return "Start Point";
    }
  }, [fromNodeId]);

  // Nearest place for real GPS
  const nearestToGps = useMemo(() => {
    if (!realGpsPosition) return null;
    return findNearestCampusPlace(realGpsPosition.lat, realGpsPosition.lng);
  }, [realGpsPosition]);

  // Request device GPS
  const handleAcquireGps = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by this browser.");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        if (isValidCoordinate(latitude, longitude)) {
          onRealGpsAcquired({
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp: pos.timestamp,
          });
        } else {
          setGpsError("Received invalid coordinates from the device sensor.");
        }
      },
      (err) => {
        setGpsLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError("Location permission was denied. Please allow location access in your browser, or select a campus destination manually.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("Device GPS position is unavailable. Check that GPS/location services are enabled on your device.");
            break;
          case err.TIMEOUT:
            setGpsError("GPS position request timed out. Please try again in an area with clear reception.");
            break;
          default:
            setGpsError(err.message || "Unable to acquire device position.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  };

  // Generate message based on active tab
  const shareMessage = useMemo(() => {
    if (activeTab === "gps") {
      if (!realGpsPosition) return "";
      return formatCurrentLocationMessage({
        lat: realGpsPosition.lat,
        lng: realGpsPosition.lng,
        accuracy: realGpsPosition.accuracy,
        nearestPlace: nearestToGps,
      });
    }

    if (activeTab === "route" && activeRoute && currentRoom) {
      return formatRouteMessage({
        originLabel,
        originCoords,
        destRoom: currentRoom,
        destCoords,
        distanceMeters: activeRoute.distance,
        etaMinutes: Math.round(activeRoute.etaSeconds / 60),
        instructions: activeRoute.instructions,
      });
    }

    // Default to destination
    if (currentRoom) {
      return formatDestinationMessage({
        room: currentRoom,
        coordinates: destCoords,
      });
    }

    return "";
  }, [activeTab, realGpsPosition, nearestToGps, activeRoute, currentRoom, originLabel, originCoords, destCoords]);

  // Handle WhatsApp click
  const handleShareWhatsApp = () => {
    if (!shareMessage) return;
    const url = createWhatsAppShareUrl(shareMessage);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Handle Copy Details
  const handleCopyDetails = async () => {
    if (!shareMessage) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        setCopied(true);
        setClipboardError(false);
        setTimeout(() => setCopied(false), 2500);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      setClipboardError(true);
    }
  };

  const filteredRooms = useMemo(() => {
    if (!roomFilter.trim()) return rooms;
    const q = roomFilter.toLowerCase();
    return rooms.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.buildingName.toLowerCase().includes(q) ||
        (r.dept && r.dept.toLowerCase().includes(q)),
    );
  }, [roomFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Share Location via WhatsApp</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Share real device GPS coordinates, campus destinations, or walking routes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selector */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (isShareTab(v)) setActiveTab(v);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gps" className="flex items-center gap-1.5 text-xs" aria-label="Share my GPS location">
              <Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">My GPS Location</span><span className="sm:hidden">GPS</span>
            </TabsTrigger>
            <TabsTrigger value="destination" className="flex items-center gap-1.5 text-xs" aria-label="Share campus destination">
              <MapPin className="h-3.5 w-3.5" /> Destination
            </TabsTrigger>
            <TabsTrigger
              value="route"
              disabled={!activeRoute}
              className="flex items-center gap-1.5 text-xs disabled:opacity-40"
              aria-label="Share active walking route"
            >
              <Navigation className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Active Route</span><span className="sm:hidden">Route</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Real Device GPS */}
          <TabsContent value="gps" className="space-y-3 pt-2">
            <div className="flex items-start gap-2 rounded-xl bg-card border p-3 text-xs">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Real Hardware GPS Device Sensor</p>
                <p className="text-muted-foreground">
                  Location is read directly from your browser's Geolocation API only when requested.
                  This provides real coordinates and is completely separate from simulated positioning.
                </p>
              </div>
            </div>

            {!realGpsPosition ? (
              <div className="rounded-xl border border-dashed p-4 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  Tap below to get your real device coordinates. Browser will ask for your location permission.
                </p>
                <button
                  type="button"
                  onClick={handleAcquireGps}
                  disabled={gpsLoading}
                  aria-busy={gpsLoading}
                  aria-label="Request device GPS location"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Acquiring device GPS fix...
                    </>
                  ) : (
                    <>
                      <Compass className="h-4 w-4" /> Acquire Real GPS Location
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold">
                    <Check className="h-3 w-3" /> Real Device GPS Locked
                  </span>
                  <button
                    type="button"
                    onClick={handleAcquireGps}
                    disabled={gpsLoading}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {gpsLoading ? "Updating..." : "Refresh GPS"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <span className="text-muted-foreground block text-[10px] uppercase">Latitude</span>
                    <span className="font-mono font-bold">{realGpsPosition.lat.toFixed(6)}°</span>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <span className="text-muted-foreground block text-[10px] uppercase">Longitude</span>
                    <span className="font-mono font-bold">{realGpsPosition.lng.toFixed(6)}°</span>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <p className="text-muted-foreground">
                    Estimated GPS accuracy: <b>±{Math.round(realGpsPosition.accuracy)} meters</b>
                  </p>
                  {nearestToGps && (
                    <p className="text-foreground">
                      {nearestToGps.isCampus ? (
                        <span>
                          Nearest campus landmark: <b>{nearestToGps.name}</b> (~{nearestToGps.distanceMeters} m away)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Off-campus position: ~{(nearestToGps.distanceMeters / 1000).toFixed(1)} km from campus ({nearestToGps.name})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Direct Map Links */}
                <div className="flex flex-wrap gap-2 pt-1 border-t text-xs">
                  <a
                    href={getGoogleMapsPointUrl(realGpsPosition.lat, realGpsPosition.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground">·</span>
                  <a
                    href={getOpenStreetMapPointUrl(realGpsPosition.lat, realGpsPosition.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    OpenStreetMap <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* GPS Error Handling */}
            {gpsError && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-2">
                <div className="flex items-start gap-2 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{gpsError}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("destination")}
                    className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Select Campus Destination Instead
                  </button>
                  <button
                    type="button"
                    onClick={handleAcquireGps}
                    className="rounded-lg border bg-background px-3 py-1.5 text-[11px] font-semibold hover:bg-muted"
                  >
                    Try GPS Again
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Destination Sharing */}
          <TabsContent value="destination" className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Destination Room
              </label>
              <input
                type="text"
                placeholder="Filter room number, name, or block..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border p-1 bg-background">
              {filteredRooms.map((r) => {
                const isSelected = currentRoom?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(r.id);
                      if (onSelectDestination) onSelectDestination(r);
                    }}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between ${
                      isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"
                    }`}
                  >
                    <div>
                      <span>
                        <span className={isSelected ? "" : "text-route font-semibold"}>{r.code}</span> · {r.name}
                      </span>
                      <span className={`block text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {r.buildingName} · {floorName(r.floor)}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {currentRoom && (
              <div className="rounded-xl border bg-background p-3 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-sm">
                      <span className="text-route">{currentRoom.code}</span> · {currentRoom.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {currentRoom.buildingName} · {floorName(currentRoom.floor)}
                      {currentRoom.dept ? ` · ${currentRoom.dept} Dept` : ""}
                    </p>
                  </div>
                </div>

                {destCoords && (
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Coordinates: {destCoords.lat.toFixed(6)}, {destCoords.lng.toFixed(6)}
                  </div>
                )}

                {destCoords && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t text-xs">
                    <a
                      href={getGoogleMapsPointUrl(destCoords.lat, destCoords.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-muted-foreground">·</span>
                    <a
                      href={getOpenStreetMapPointUrl(destCoords.lat, destCoords.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      OpenStreetMap <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Route Sharing */}
          <TabsContent value="route" className="space-y-3 pt-2">
            {activeRoute && currentRoom ? (
              <div className="rounded-xl border bg-background p-3.5 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Navigation Route</span>
                    <p className="font-semibold text-sm">
                      {originLabel} → {currentRoom.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-route">{Math.round(activeRoute.distance)} m</span>
                    <span className="block text-[11px] text-muted-foreground">
                      ~{Math.max(1, Math.round(activeRoute.etaSeconds / 60))} min walk
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs">Turn-by-turn preview ({activeRoute.instructions.length} steps):</p>
                  <ol className="max-h-28 overflow-y-auto space-y-1 rounded-lg bg-muted/40 p-2 text-[11px]">
                    {activeRoute.instructions.map((inst, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="font-bold text-route">{i + 1}.</span>
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {originCoords && destCoords && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t text-xs">
                    <a
                      href={getGoogleMapsDirectionsUrl(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      Outdoor walking directions in Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={getOpenStreetMapDirectionsUrl(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      Outdoor walking directions in OpenStreetMap <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground italic">
                  Note: External Google Maps directions guide you to the building. Indoor hallway/floor walking steps are provided inside Campus Navigator AI.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                No active route calculated. Select a destination in the Directions tab first to generate and share a walking route.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Live Location Disclosure & Privacy Note (Step 6) */}
        <div className="border rounded-xl p-2.5 bg-muted/30 text-xs space-y-1">
          <button
            type="button"
            onClick={() => setShowLiveInfo(!showLiveInfo)}
            aria-expanded={showLiveInfo}
            className="flex w-full items-center justify-between text-left font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> About Continuous Live Location & Privacy
            </span>
            <span className="text-[11px] underline">{showLiveInfo ? "Hide" : "Learn more"}</span>
          </button>
          {showLiveInfo && (
            <div className="pt-2 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
              <p>
                <b>Client-side Privacy:</b> Your coordinates are never sent to a server or stored in any database. Position queries execute 100% locally in your browser.
              </p>
              <p>
                <b>Why not continuous live tracking?</b> WhatsApp's real-time live location is an internal end-to-end encrypted protocol that external websites cannot stream to. Continuous background GPS would drain device battery and stream unencrypted locations. Campus Navigator AI shares secure point-in-time snapshots with your explicit consent.
              </p>
            </div>
          )}
        </div>

        {/* Message Preview */}
        {shareMessage ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">Message Preview</span>
              <span className="text-[10px] text-muted-foreground">Ready to send via WhatsApp</span>
            </div>
            <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-card p-2.5 text-[11px] font-mono leading-relaxed text-card-foreground">
              {shareMessage}
            </pre>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {activeTab === "gps" && !realGpsPosition ? "Acquire your device GPS above to generate the message." : "Select a location to preview."}
          </p>
        )}

        {/* Fallback Textarea if Clipboard API failed */}
        {clipboardError && shareMessage && (
          <div className="rounded-xl border border-warning/60 bg-warning/10 p-2.5 space-y-1 text-xs">
            <p className="font-semibold text-warning-foreground">Select and copy manually:</p>
            <textarea
              readOnly
              value={shareMessage}
              onFocus={(e) => e.target.select()}
              className="w-full h-16 rounded-lg border bg-background p-2 text-[11px] font-mono outline-none"
            />
          </div>
        )}

        {/* Actions Footer */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!shareMessage}
              aria-label="Open WhatsApp with a prepared location message. You review and tap Send in WhatsApp."
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-2.5 text-xs font-bold transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="h-3.5 w-3.5 fill-current" /> Share via WhatsApp
            </button>

            {/* Copy Details Button */}
            <button
              type="button"
              onClick={handleCopyDetails}
              disabled={!shareMessage}
              aria-label="Copy location details to clipboard"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-background hover:bg-muted px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Details
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-center text-muted-foreground">
            Tapping "Share via WhatsApp" opens WhatsApp with your prepared message. You review and tap <b>Send</b> inside WhatsApp (Campus Navigator prepares the message; no automated messaging or WhatsApp Business API is used).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
