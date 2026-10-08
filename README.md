# Campus Navigator AI

I built Campus Navigator AI for Velammal Engineering College (VEC), Chennai. You can search rooms from the floor plans for Abdul Kalam Block, Kirloskar Block, Anna Auditorium, Founder Chairman Block (FCB), and Visvesvaraya Block. Tap Navigate here to get a route on the campus map with step-by-step directions, distance, and walking time.

What you can do:

- **Directions & Routing**: Each route shows step-by-step walking directions and speed comparison between two routing methods (A* and Dijkstra).
- **Indoor Data**: Full multi-floor networks for 5 blocks (Abdul Kalam Block, Kirloskar Block, Anna Auditorium, Founder Chairman Block, and Visvesvaraya Block) including classrooms, labs, staffrooms, restrooms, corridors, entrances, and stairs.
- **Hands-Free Navigation**: Dedicated Start Navigation and Stop Navigation controls, spoken turn-by-turn audio directions via browser SpeechSynthesis, voice mute/unmute, repeat prompts, step-by-step advancement, and live hardware device position tracking when location permission is granted.
- **WhatsApp Location & Route Sharing**: Share real device GPS coordinates, selected campus destinations, or walking routes directly via WhatsApp with Google Maps/OpenStreetMap links and step-by-step directions. Tapping opens WhatsApp with a prepared message for manual sending (no automated messaging or Business API).
- **Accessible Mode**: Avoids stairs. Uses verified lifts (Anna Auditorium lift). When no step-free route exists, returns the standard spec message.
- **Voice Assistant**: Type or speak questions like "Where is room 401?" or "Take me to Civil Lab 1 without stairs", with spoken answers and direct "Start navigation" controls.
- **Closures Tab**: Close entrances, stairs, lifts or corridors dynamically, and routes avoid them right away.
- **Position Simulator**: A simulated positioning walk along routes with FIXED, FLOAT, SINGLE, and INDOOR modes. Clearly labeled as a simulation preview (not real RTK or GPS).
- **"How it works" Page**: Problem → Solution → Feature → Technology table.

Data status & source files:

- Building footprints and indoor room layouts are approximate placements marked as `requires_confirmation` or `unverified` pending a future visual floor-plan editor with CAD/survey data.
- Room 255 (Kirloskar Block) and Room 914 (Visvesvaraya Block) are preserved with status `requires_confirmation` due to handwritten plan duplicates.
- Source files still needed: Additional campus buildings (Bill Gates Block, Ratan Tata Block, Murugan Temple, College Canteen, Hostels, Sports Complex) currently only have outdoor coordinates; indoor floor plan source files are still needed to map their rooms.

Not built yet:

- Saved database storage: Runs standalone client-side; custom closures reset upon full page reload.
- Visual floor-plan admin editor: For uploading architectural CAD blueprints and placing exact door coordinates.


## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
