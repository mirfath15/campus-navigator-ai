<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Campus graph data lives in `src/lib/campus/data.ts`; routing (A*/Dijkstra) and the assistant parser are pure modules beside it so a future database/editor can feed the same graph.
- Leaflet is imported dynamically inside the map component and the component is lazy-loaded after hydration, because Leaflet touches `window` and breaks SSR.
- Never invent rooms, lifts, ramps or entrances; uncertain data carries `requires_confirmation`.
