import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Index } from "@/routes/index";

vi.mock("@/components/campus/CampusMap", () => ({
  CampusMap: () => <div data-testid="campus-map" />,
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<Record<string, any>>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

// Mock matchMedia and SpeechSynthesisUtterance for jsdom
beforeEach(() => {
  window.matchMedia =
    window.matchMedia ||
    function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
      };
    };

  (window as any).SpeechSynthesisUtterance =
    (window as any).SpeechSynthesisUtterance ||
    class SpeechSynthesisUtterance {
      text: string;
      lang: string = "en-IN";
      rate: number = 1.0;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
});

describe("Hands-Free Navigation Feature", () => {
  it("renders RoutePanel with Start Hands-Free Navigation when destination is selected", async () => {
    // Mock speechSynthesis
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: speakMock,
        cancel: cancelMock,
      },
    });

    render(<Index />);

    // Find first room in list and click navigate
    const navButtons = screen.getAllByRole("button", { name: /navigate here/i });
    expect(navButtons.length).toBeGreaterThan(0);
    fireEvent.click(navButtons[0]!);

    // Start navigation button should be present
    const startNavBtn = await screen.findByRole("button", {
      name: /start hands-free turn-by-turn voice navigation/i,
    });
    expect(startNavBtn).toBeInTheDocument();
  });

  it("starts navigation on button click and speaks the initial instruction", async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: speakMock,
        cancel: cancelMock,
      },
    });

    render(<Index />);

    // Select room
    const navButtons = screen.getAllByRole("button", { name: /navigate here/i });
    fireEvent.click(navButtons[0]!);

    const startNavBtn = await screen.findByRole("button", {
      name: /start hands-free turn-by-turn voice navigation/i,
    });
    fireEvent.click(startNavBtn);

    // Should now display active Navigation HUD with Stop button and step indicator
    const stopButtons = screen.getAllByRole("button", { name: /stop navigation/i });
    expect(stopButtons.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Step 1 of/i).length).toBeGreaterThan(0);
    expect(speakMock).toHaveBeenCalled();
  });

  it("allows advancing steps, repeating spoken directions, and stopping navigation", async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: speakMock,
        cancel: cancelMock,
      },
    });

    render(<Index />);

    // Select room
    const navButtons = screen.getAllByRole("button", { name: /navigate here/i });
    fireEvent.click(navButtons[0]!);

    const startNavBtn = await screen.findByRole("button", {
      name: /start hands-free turn-by-turn voice navigation/i,
    });
    fireEvent.click(startNavBtn);
    expect(speakMock).toHaveBeenCalled();

    speakMock.mockClear();

    // Repeat current step
    const repeatBtn = screen.getAllByRole("button", { name: /repeat spoken instruction/i })[0]!;
    fireEvent.click(repeatBtn);
    expect(speakMock).toHaveBeenCalled();

    // Advance to Next Step
    const nextBtn = screen.getByRole("button", { name: /next navigation step/i });
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/Step 2 of/i).length).toBeGreaterThan(0);

    // Stop navigation
    const stopBtn = screen.getAllByRole("button", { name: /stop navigation/i })[0]!;
    fireEvent.click(stopBtn);
    expect(cancelMock).toHaveBeenCalled();

    // Should return back to RoutePanel
    expect(screen.queryByText(/Step 2 of/i)).not.toBeInTheDocument();
  });

  it("handles geolocation permission denied gracefully without crashing", async () => {
    const watchPositionMock = vi.fn().mockImplementation((_success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "User denied Geolocation",
      });
      return 101;
    });

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: watchPositionMock,
        clearWatch: vi.fn(),
      },
    });

    render(<Index />);

    const navButtons = screen.getAllByRole("button", { name: /navigate here/i });
    fireEvent.click(navButtons[0]!);

    const startNavBtn = await screen.findByRole("button", {
      name: /start hands-free turn-by-turn voice navigation/i,
    });
    fireEvent.click(startNavBtn);

    // Watch position was called and handled gracefully
    expect(watchPositionMock).toHaveBeenCalled();
    expect(screen.getByText(/Manual step/i)).toBeInTheDocument();
  });
});
