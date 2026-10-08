
## Architecture rules
- Campus graph data lives in `src/lib/campus/data.ts`; routing (A*/Dijkstra) and the assistant parser are pure modules beside it so a future database/editor can feed the same graph.
- Leaflet is imported dynamically inside the map component and the component is lazy-loaded after hydration, because Leaflet touches `window` and breaks SSR.
- Never invent rooms, lifts, ramps or entrances; uncertain data carries `requires_confirmation`.
