import { rooms, floorName, type Room } from "./data";

export type Intent =
  | { type: "navigate"; room: Room; accessible: boolean }
  | { type: "search"; matches: Room[] }
  | { type: "info"; text: string };

export function searchRooms(q: string): Room[] {
  const s = q.trim().toLowerCase();
  if (!s) return rooms;
  const words = s.split(/\s+/);
  return rooms.filter((r) => {
    const hay = `${r.code} ${r.name} ${r.dept ?? ""} ${r.buildingName} ${floorName(r.floor)} ${r.type}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

const STOP = new Set(["where", "is", "the", "take", "me", "to", "room", "find", "show", "how", "do", "i", "get", "go", "a", "an", "please", "without", "stairs", "no", "office", "navigate", "directions", "of", "in"]);

function findRoom(text: string): Room[] {
  const t = text.toLowerCase();
  const num = t.match(/\b(\d{3})\b/);
  if (num) return rooms.filter((r) => r.code === num[1]);
  // exact code tokens like LB1, COE, DSR
  const codeHit = rooms.filter((r) => r.code.length > 1 && new RegExp(`\\b${r.code.toLowerCase().replace(/\s+/g, "\\s+")}\\b`).test(t));
  if (codeHit.length) return codeHit;
  const nameHit = rooms.filter((r) => t.includes(r.name.toLowerCase()));
  if (nameHit.length) return nameHit;
  const kw = t.replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter((w) => w && !STOP.has(w));
  if (!kw.length) return [];
  return searchRooms(kw.join(" "));
}

export function parse(text: string): Intent {
  const t = text.toLowerCase();
  const accessible = /(without|no|avoid)\s+stairs|wheelchair|accessible|step[- ]free/.test(t);
  const wantsNav = /take me|navigate|directions|how do i get|route|go to|guide/.test(t) || accessible;
  const matches = findRoom(text);
  if (!matches.length) {
    return { type: "info", text: "I couldn't find that room in the floor plans. Try a room number like 864, or a name like Mechanical Lab 1." };
  }
  if (wantsNav && matches.length === 1) return { type: "navigate", room: matches[0], accessible };
  return { type: "search", matches };
}

export function describe(r: Room) {
  return `${r.code} — ${r.name} is on the ${floorName(r.floor).toLowerCase()} of ${r.buildingName}.`;
}
