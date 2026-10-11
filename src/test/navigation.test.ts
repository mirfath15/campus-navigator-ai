import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCampusNavigation } from "@/hooks/use-campus-navigation";
import { rooms } from "@/lib/campus/data";
import { route } from "@/lib/campus/routing";

describe("Hands-Free Campus Navigation Hook", () => {
  const room860 = rooms.find((r) => r.code === "860")!;
  const testRoute = route("gate", room860.nodeId, {
    accessible: false,
    closed: new Set(),
  })!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes in idle state without triggering audio or location watches", () => {
    const { result } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
      }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.isNavigating).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentInstruction).toBe(testRoute.instructions[0]);
  });

  it("starts simulation navigation and tracks progress correctly", () => {
    vi.useFakeTimers();
    const positionUpdates: Array<{ lat: number; lng: number }> = [];

    const { result } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
        onPositionUpdate: (pos, isSim) => {
          if (isSim) positionUpdates.push(pos);
        },
      }),
    );

    act(() => {
      result.current.startSimulationNavigation();
    });

    expect(result.current.status).toBe("navigating");
    expect(result.current.isNavigating).toBe(true);
    expect(result.current.navSource).toBe("simulation");

    // Advance timers for simulation steps
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(positionUpdates.length).toBeGreaterThan(0);

    act(() => {
      result.current.stopNavigation();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.isNavigating).toBe(false);
    vi.useRealTimers();
  });

  it("starts live GPS navigation and sets up watchPosition", () => {
    const mockWatchPosition = vi.fn().mockReturnValue(42);
    const mockClearWatch = vi.fn();

    Object.defineProperty(navigator, "geolocation", {
      writable: true,
      value: {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
        getCurrentPosition: vi.fn(),
      },
    });

    const { result } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
      }),
    );

    act(() => {
      result.current.startGpsNavigation();
    });

    expect(result.current.status).toBe("navigating");
    expect(result.current.navSource).toBe("gps");
    expect(mockWatchPosition).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.stopNavigation();
    });

    expect(mockClearWatch).toHaveBeenCalledWith(42);
    expect(result.current.status).toBe("idle");
  });

  it("handles GPS permission denial with informative error", () => {
    const mockWatchPosition = vi.fn((_success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 101;
    });

    Object.defineProperty(navigator, "geolocation", {
      writable: true,
      value: {
        watchPosition: mockWatchPosition,
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
      },
    });

    const { result } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
      }),
    );

    act(() => {
      result.current.startGpsNavigation();
    });

    expect(result.current.gpsSignal).toBe("denied");
    expect(result.current.gpsError).toContain("Location permission denied");
  });

  it("toggles audio mute and cancels active speech synthesis", () => {
    const cancelSpy = vi.spyOn(window.speechSynthesis, "cancel");

    const { result } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
      }),
    );

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(cancelSpy).toHaveBeenCalled();

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
  });

  it("clears watches and speech on unmount", () => {
    const mockClearWatch = vi.fn();
    const cancelSpy = vi.spyOn(window.speechSynthesis, "cancel");

    Object.defineProperty(navigator, "geolocation", {
      writable: true,
      value: {
        watchPosition: vi.fn().mockReturnValue(999),
        clearWatch: mockClearWatch,
        getCurrentPosition: vi.fn(),
      },
    });

    const { result, unmount } = renderHook(() =>
      useCampusNavigation({
        activeRoute: testRoute,
        targetRoom: room860,
      }),
    );

    act(() => {
      result.current.startGpsNavigation();
    });

    unmount();

    expect(mockClearWatch).toHaveBeenCalledWith(999);
    expect(cancelSpy).toHaveBeenCalled();
  });
});
