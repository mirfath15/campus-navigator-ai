import { useEffect, useRef, useState, useCallback } from "react";
import { haversine, N, type Room } from "@/lib/campus/data";
import type { RouteResult } from "@/lib/campus/routing";

export type NavSource = "gps" | "simulation";
export type NavStatus = "idle" | "navigating" | "completed" | "off_route";
export type GpsSignal = "searching" | "locked" | "weak" | "unavailable" | "denied";

export interface NavigationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp?: number;
}

export interface UseCampusNavigationOptions {
  activeRoute: RouteResult | null;
  targetRoom: Room | null;
  onPositionUpdate?: (pos: NavigationPosition, isSimulation: boolean) => void;
  onArrived?: () => void;
}

export function useCampusNavigation({
  activeRoute,
  targetRoom,
  onPositionUpdate,
  onArrived,
}: UseCampusNavigationOptions) {
  const [status, setStatus] = useState<NavStatus>("idle");
  const [navSource, setNavSource] = useState<NavSource>("gps");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [gpsSignal, setGpsSignal] = useState<GpsSignal>("searching");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<NavigationPosition | null>(null);
  const [distanceToNextStep, setDistanceToNextStep] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpokenIndexRef = useRef<number | null>(null);
  const simStepRef = useRef(0);

  // Check speech synthesis support safely
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported || isMuted) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.lang = "en-IN";
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("Speech synthesis error:", err);
      }
    },
    [speechSupported, isMuted],
  );

  const stopNavigation = useCallback(() => {
    // Teardown GPS watcher
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Teardown simulation interval
    if (simIntervalRef.current !== null) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    // Cancel speech
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setStatus("idle");
    lastSpokenIndexRef.current = null;
    simStepRef.current = 0;
  }, []);

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      stopNavigation();
    };
  }, [stopNavigation]);

  // Handle route change while navigating: reset step index
  useEffect(() => {
    if (!activeRoute) {
      if (status !== "idle") stopNavigation();
      return;
    }
    setRemainingDistance(activeRoute.distance);
  }, [activeRoute, status, stopNavigation]);

  // Voice announcement when current step changes
  useEffect(() => {
    if (status !== "navigating" || !activeRoute) return;
    if (lastSpokenIndexRef.current === currentStepIndex) return;

    const instructions = activeRoute.instructions;
    if (currentStepIndex >= 0 && currentStepIndex < instructions.length) {
      lastSpokenIndexRef.current = currentStepIndex;
      const stepText = instructions[currentStepIndex]!;
      speak(stepText);
    }
  }, [currentStepIndex, status, activeRoute, speak]);

  const startGpsNavigation = useCallback(() => {
    if (!activeRoute || !targetRoom) return;
    stopNavigation();

    setNavSource("gps");
    setStatus("navigating");
    setCurrentStepIndex(0);
    setGpsError(null);
    setGpsSignal("searching");
    lastSpokenIndexRef.current = null;

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser.");
      setGpsSignal("unavailable");
      return;
    }

    // Initial announcement
    speak(
      `Starting live GPS navigation to ${targetRoom.name}. ${activeRoute.instructions[0] ?? ""}`,
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newPos: NavigationPosition = {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: pos.timestamp,
        };

        setCurrentPosition(newPos);
        setGpsSignal(accuracy < 10 ? "locked" : "weak");
        setGpsError(null);

        if (onPositionUpdate) {
          onPositionUpdate(newPos, false);
        }

        // Match against route path nodes
        const pathNodes = activeRoute.path
          .map((id) => {
            try {
              return N(id);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (!pathNodes.length) return;

        // Calculate distance to destination
        const destNode = pathNodes[pathNodes.length - 1]!;
        const distToDest = haversine(newPos, { lat: destNode.lat, lng: destNode.lng });
        setRemainingDistance(Math.round(distToDest));

        // Arrival detection: within 6 meters of final destination
        if (distToDest < 6) {
          setStatus("completed");
          speak(`You have arrived at your destination: ${targetRoom.code} · ${targetRoom.name}.`);
          if (onArrived) onArrived();
          stopNavigation();
          return;
        }

        // Find nearest path node to track progress
        let closestIndex = 0;
        let minDistance = Infinity;
        pathNodes.forEach((node, idx) => {
          if (!node) return;
          const d = haversine(newPos, { lat: node.lat, lng: node.lng });
          if (d < minDistance) {
            minDistance = d;
            closestIndex = idx;
          }
        });

        // Detect large deviation (off-route by > 45 meters)
        if (minDistance > 45) {
          setGpsSignal("weak");
          setStatus("off_route");
        } else if (status === "off_route") {
          setStatus("navigating");
        }

        // Estimate current instruction step based on closest node index
        // Instructions correlate with path segments
        const stepEstimate = Math.min(
          Math.floor(
            (closestIndex / Math.max(1, pathNodes.length - 1)) * activeRoute.instructions.length,
          ),
          activeRoute.instructions.length - 1,
        );

        if (stepEstimate > currentStepIndex) {
          setCurrentStepIndex(stepEstimate);
        }

        setDistanceToNextStep(Math.round(minDistance));
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError(
              "Location permission denied. Please enable GPS access or use Simulation mode.",
            );
            setGpsSignal("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setGpsError("GPS position unavailable. Check device location sensor.");
            setGpsSignal("unavailable");
            break;
          case err.TIMEOUT:
            setGpsError("GPS position request timed out. Retrying...");
            setGpsSignal("weak");
            break;
          default:
            setGpsError(err.message || "GPS location error.");
            setGpsSignal("unavailable");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      },
    );
  }, [
    activeRoute,
    targetRoom,
    stopNavigation,
    speak,
    onPositionUpdate,
    onArrived,
    status,
    currentStepIndex,
  ]);

  const startSimulationNavigation = useCallback(() => {
    if (!activeRoute || !targetRoom) return;
    stopNavigation();

    setNavSource("simulation");
    setStatus("navigating");
    setCurrentStepIndex(0);
    setGpsError(null);
    setGpsSignal("locked");
    simStepRef.current = 0;
    lastSpokenIndexRef.current = null;

    const pathNodes = activeRoute.path.map((id) => N(id));
    if (!pathNodes.length) return;

    speak(
      `Starting simulated navigation to ${targetRoom.name}. ${activeRoute.instructions[0] ?? ""}`,
    );

    simIntervalRef.current = setInterval(() => {
      const t = simStepRef.current;
      const seg = Math.min(Math.floor(t), pathNodes.length - 2);
      const f = Math.min(t - seg, 1);
      const a = pathNodes[seg]!;
      const b = pathNodes[seg + 1]!;

      const lat = a.lat + (b.lat - a.lat) * f;
      const lng = a.lng + (b.lng - a.lng) * f;

      const newPos: NavigationPosition = {
        lat,
        lng,
        accuracy: 1.0,
      };

      setCurrentPosition(newPos);
      if (onPositionUpdate) {
        onPositionUpdate(newPos, true);
      }

      // Remaining distance to destination
      const destNode = pathNodes[pathNodes.length - 1]!;
      const distToDest = haversine(newPos, { lat: destNode.lat, lng: destNode.lng });
      setRemainingDistance(Math.round(distToDest));

      // Map progress to instruction step
      const stepEstimate = Math.min(
        Math.floor((t / Math.max(1, pathNodes.length - 1)) * activeRoute.instructions.length),
        activeRoute.instructions.length - 1,
      );

      if (stepEstimate !== currentStepIndex) {
        setCurrentStepIndex(stepEstimate);
      }

      simStepRef.current = t + 0.15;

      // Arrival check
      if (t >= pathNodes.length - 1) {
        setStatus("completed");
        speak(`You have arrived at your destination: ${targetRoom.code} · ${targetRoom.name}.`);
        if (onArrived) onArrived();
        stopNavigation();
      }
    }, 500);
  }, [
    activeRoute,
    targetRoom,
    stopNavigation,
    speak,
    onPositionUpdate,
    onArrived,
    currentStepIndex,
  ]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      } else if (!next && activeRoute) {
        const currentInst = activeRoute.instructions[currentStepIndex];
        if (currentInst) speak(currentInst);
      }
      return next;
    });
  }, [activeRoute, currentStepIndex, speak]);

  const repeatInstruction = useCallback(() => {
    if (!activeRoute) return;
    const currentInst = activeRoute.instructions[currentStepIndex];
    if (currentInst) {
      speak(currentInst);
    }
  }, [activeRoute, currentStepIndex, speak]);

  return {
    status,
    isNavigating: status === "navigating" || status === "off_route",
    navSource,
    currentStepIndex,
    currentInstruction: activeRoute?.instructions[currentStepIndex] ?? "",
    nextInstruction: activeRoute?.instructions[currentStepIndex + 1] ?? null,
    totalSteps: activeRoute?.instructions.length ?? 0,
    distanceToNextStep,
    remainingDistance,
    currentPosition,
    isMuted,
    speechSupported,
    gpsSignal,
    gpsError,
    startGpsNavigation,
    startSimulationNavigation,
    stopNavigation,
    toggleMute,
    repeatInstruction,
  };
}
