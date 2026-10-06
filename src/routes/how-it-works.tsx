import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — Campus Navigator AI" },
      { name: "description", content: "Problem, solution, feature and technology behind VEC's Campus Navigator AI." },
      { property: "og:title", content: "How it works — Campus Navigator AI" },
      { property: "og:description", content: "Problem, solution, feature and technology behind VEC's Campus Navigator AI." },
    ],
  }),
  component: HowItWorks,
});

const rows = [
  ["Difficult room/facility discovery", "Search and indoor navigation", "Room search by number, name, department, building, floor, type", "Client search index + route planner"],
  ["Multiple buildings and floors", "Hybrid graph + A*", "One graph joining outdoor paths, entrances, corridors, stairs and lifts", "A* (f = g + h), Dijkstra comparison"],
  ["Accessibility needs", "Accessibility graph filtering", "Accessible mode removes stairs; uses only the lift shown on plans", "Graph edge filtering"],
  ["Dynamic closures", "Dynamic graph closures", "Close entrances, stairs, lifts or paths; routes update instantly", "Live state (WebSockets planned)"],
  ["Natural-language interaction", "AI + voice", "Assistant understands requests like “Take me to 864 without stairs”", "Phrase matching, SpeechRecognition, SpeechSynthesis"],
  ["High-precision positioning", "CORS/RTK simulator / provider interface", "Simulated FIXED, FLOAT, SINGLE and INDOOR positioning snapped to route", "Gaussian-noise simulator (not real RTK)"],
  ["Handwritten plans lack exact coordinates", "Visual floor-plan editor + PostGIS", "Placeholder positions marked “requires confirmation”", "Planned: editor + spatial database"],
];

function HowItWorks() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Back to the map</Link>
      <h1 className="mt-6 text-4xl font-bold md:text-5xl">How it works</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Each campus problem is traced to the solution, the feature you use, and the technology behind it.</p>
      <div className="mt-10 overflow-x-auto rounded-2xl border bg-card shadow-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr>{["Problem", "Solution", "Feature", "Technology"].map((h) => <th key={h} className="px-5 py-4 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t align-top">
                {r.map((c, i) => <td key={i} className={`px-5 py-4 ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Building positions are approximate and indoor layouts are placeholders until confirmed. Positioning is simulated.</p>
    </main>
  );
}
