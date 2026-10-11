# Campus Navigator AI

Campus Navigator AI for Velammal Engineering College (VEC), Chennai. Find rooms, laboratories, department offices, and campus landmarks with turn-by-turn walking routes, live hardware GPS navigation, voice guidance, and WhatsApp location sharing.

## Features

- **Directions & Routing**:
  - Shortest-path route calculation using A* with Euclidean/Haversine heuristic and Dijkstra algorithm comparison.
  - Designated outdoor pedestrian walkways connecting all major blocks without cutting through buildings or jumping across inaccessible areas.
  - Safe snapping to building entrances and floor corridors.

- **Accessible Mode**:
  - Automatically avoids staircases.
  - Routes through the Anna Auditorium elevator when available.
  - Returns `"Accessible route is not available from the current verified campus data."` when upper floors have no verified step-free lift access.

- **Hands-Free Turn-by-Turn Voice Navigation**:
  - **Live Hardware Device GPS Navigation**: Uses browser `navigator.geolocation.watchPosition` to track real device location, calculate remaining distance, match route segments, and provide hands-free voice directions.
  - **Simulation Mode**: Clearly labelled `SIMULATION MODE` along path coordinates with adjustable sensor noise profiles (FIXED, FLOAT, SINGLE, INDOOR). Never confuses simulated positions with live GPS.
  - Spoken audio directions using Web Speech Synthesis with mute/unmute toggles, repeat speech control, and clean teardown on stop or unmount.

- **WhatsApp Location Sharing**:
  - User-initiated WhatsApp sharing with click-to-chat URL formatting (`wa.me/?text=...`).
  - Supports sharing current real device GPS coordinates, selected destinations, or full walking route steps.
  - Includes Google Maps and OpenStreetMap direct links.
  - Graceful fallbacks for clipboard API failure (selectable textarea) and permission errors.
  - Fully accessible dialog with `z-[2000]` layering, backdrop-blur, keyboard Escape dismissal, and map interaction isolation.

- **Campus Voice & Text Assistant**:
  - Natural language queries like *"Take me to room 864 without stairs"*, *"Where is the Canteen?"*, or *"Find Murugan Temple"*.
  - Text-to-speech read aloud capabilities and speech recognition input.

- **Interactive Closures**:
  - Dynamically block entrances, stairs, lifts, corridors, or outdoor pathways to test real-time rerouting around temporary campus maintenance.

## Campus Data Classification & Audit

The application maintains strict transparency between verified architectural data and provisional placeholders:

| Block / Landmark | Data Status | Indoor Floor Plans | Details |
| :--- | :--- | :--- | :--- |
| **Abdul Kalam Block** | Verified Plan | Floors 0, 1, 2 | Rooms 860–871, IT labs, staff rooms, MBA classrooms, restrooms. |
| **Kirloskar Block** | Verified Plan | Floors 0, 1, 2 | Mechanical Labs, CSE-CS rooms 251–256, COE, DSR, restrooms. |
| **Anna Auditorium** | Verified Plan | Floors 0, 1 | Thermal/Mech/EEE/AIDS Labs, Doors D1–D3, elevator access. |
| **Visvesvaraya Block** | Approximate | Floor 0 (Provisional) | Academic block with rooms 913 & 914 noted from campus records. |
| **FCB / Founder Chairman Block** | Approximate | Provisional Entrance | Administrative block, principal chamber, board rooms. |
| **Bill Gates Block** | Approximate | Provisional Entrance | Computing and IT laboratories. |
| **Ratan Tata Block** | Approximate | Provisional Entrance | Academic lecture block. |
| **Murugan Temple** | Approximate | Landmark Entrance | Campus spiritual landmark along the entrance boulevard. |
| **Campus Canteen** | Approximate | Dining Entrance | Student cafeteria and food court. |
| **Boys & Girls Hostels** | Approximate | Entrance Points | Residential accommodation blocks. |
| **Sports Complex** | Approximate | Pavilion Entrance | Campus athletic grounds and pavilion. |
| **Central Restrooms** | Approximate | Facility Entrance | Ground-level campus outdoor restrooms. |

> **Data Request**: Verified AutoCAD/architectural blueprints are needed from the college administration to map interior corridor geometry for FCB, Bill Gates Block, Ratan Tata Block, and Hostels.

## Development & Testing

### Prerequisites
- Node.js (v20+ recommended)
- npm

### Installation & Run
```sh
npm install
npm run dev
```

### Running Test Suite
```sh
npm test
```
Runs 43 automated unit and integration tests across 6 test suites covering:
- Graph integrity and coordinate validation
- Shortest-path routing, closures, and accessibility
- Same-origin and invalid destination edge cases
- Walkway avoidance of building footprints
- Hands-free navigation state transitions, GPS error handling, and teardown
- WhatsApp share URL encoding, clipboard fallbacks, and dialog layering

### Production Build
```sh
npm run build
```
Builds client assets and server bundle for production deployment.
