# Campus Navigator AI

I built Campus Navigator AI for VEC. You can search the rooms from your floor plans for Abdul Kalam Block, Kirloskar Block and Anna Auditorium. Tap Navigate here to get a route on the campus map with step-by-step directions, the distance and the walking time.

What you can do:

- Directions: each route also shows a speed comparison between two routing methods (A* and Dijkstra).

- Accessible mode: avoids stairs. Only the Anna Auditorium lift is used, because it's the only lift on your plans. When no step-free route exists, you get the exact message from your spec.

- Assistant tab: type or speak questions like "Take me to room 864 without stairs". Answers can be read aloud.

- Closures tab: close entrances, stairs, lifts or corridors, and routes avoid them right away.

- Position tab: a simulated positioning walk with FIXED, FLOAT, SINGLE and INDOOR modes. It's clearly labelled as a simulation, not real RTK.

- "How it works" page: shows the Problem → Solution → Feature → Technology table.

Placeholder locations:

- I placed the buildings roughly where the map shows them.

- The room layouts inside each building and the entrance spots are rough guesses, and the app marks them as needing confirmation.

- Room 255 is also flagged, because your plan names it the same as room 254.

Not built yet:

- Your requested setup: the spec asks for Python and FastAPI, which this platform doesn't support, so everything here runs in the browser.

- Saved data: nothing is stored online yet, so any closures you set reset when the page reloads.

- Floor-plan editor: not built, so the real room and entrance positions can't be entered yet.

- Smarter assistant: it matches simple phrases for now and doesn't use AI yet.

- Visvesvaraya Block: left out, because your notes give only two room numbers (913 and 914) and no floors.

Should I add online storage and the floor-plan editor next, so you can drag rooms and entrances into their real positions?refer this link  for a template" @project:516f201e-ff56-4b0c-a8e5-9f9d1650b3ab:"Build Beautifully"  "

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5af4f40f-2ab5-4973-b4c8-b8c707f28481).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
