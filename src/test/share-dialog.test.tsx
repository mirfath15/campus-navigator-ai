import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShareLocationDialog } from "@/components/campus/ShareLocationDialog";
import { rooms } from "@/lib/campus/data";

function renderGpsDialog(
  overrides: Partial<ComponentProps<typeof ShareLocationDialog>> = {},
) {
  return render(
    <ShareLocationDialog
      open
      onOpenChange={() => {}}
      defaultTab="gps"
      target={rooms[0]!}
      activeRoute={null}
      fromNodeId="gate"
      realGpsPosition={null}
      onRealGpsAcquired={() => {}}
      {...overrides}
    />,
  );
}

describe("ShareLocationDialog GPS consent", () => {
  it("does not request geolocation until the user taps acquire", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    renderGpsDialog();

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("shows a permission-denied error and a destination fallback", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, err: (e: GeolocationPositionError) => void) => {
          err({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "denied",
          } as GeolocationPositionError);
        },
      },
    });

    renderGpsDialog();
    fireEvent.click(screen.getByRole("button", { name: /request device gps location/i }));

    expect(await screen.findByText(/permission was denied/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select campus destination instead/i })).toBeInTheDocument();
  });

  it("shows selectable text when clipboard copy is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    renderGpsDialog({
      defaultTab: "destination",
      target: rooms[0]!,
    });

    fireEvent.click(screen.getByRole("button", { name: /copy location details to clipboard/i }));

    expect(await screen.findByText(/select and copy manually/i)).toBeInTheDocument();
    const fallback = document.querySelector("textarea");
    expect(fallback?.value).toContain(rooms[0]!.code);
  });
});
