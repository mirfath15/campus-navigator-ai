const fs = require('fs');
const content = fs.readFileSync('scratch_osm.xml', 'utf8');

const nodeMap = new Map();
const nodeRegex = /<node\b[^>]*?\bid="(\d+)"[^>]*?\blat="([^"]+)"[^>]*?\blon="([^"]+)"/g;
let nMatch;
while ((nMatch = nodeRegex.exec(content)) !== null) {
  nodeMap.set(nMatch[1], { lat: parseFloat(nMatch[2]), lng: parseFloat(nMatch[3]) });
}

console.log('Total nodes parsed:', nodeMap.size);

// Parse ways
const wayRegex = /<way id="(\d+)"[\s\S]*?<\/way>/g;
let match;
const namedBuildings = [];
const campusRoads = [];

while ((match = wayRegex.exec(content)) !== null) {
  const w = match[0];
  const id = match[1];
  const tags = {};
  const tagRegex = /<tag k="([^"]+)" v="([^"]+)"\/>/g;
  let tMatch;
  while ((tMatch = tagRegex.exec(w)) !== null) {
    tags[tMatch[1]] = tMatch[2];
  }
  const nds = [];
  const ndRegex = /<nd ref="(\d+)"\/>/g;
  let ndMatch;
  while ((ndMatch = ndRegex.exec(w)) !== null) {
    nds.push(ndMatch[1]);
  }
  const coords = nds.map(nid => nodeMap.get(nid)).filter(Boolean);
  if (coords.length) {
    const avgLat = coords.reduce((a,c) => a + c.lat, 0) / coords.length;
    const avgLng = coords.reduce((a,c) => a + c.lng, 0) / coords.length;
    
    if (tags.building || tags.amenity === 'events_venue') {
      namedBuildings.push({ id, name: tags.name || tags.building, avgLat, avgLng, coords, tags });
    }
    if (tags.highway) {
      campusRoads.push({ id, name: tags.name || tags.highway, tags, coords, nds });
    }
  }
}

console.log('\n--- VERIFIED BUILDINGS IN OSM ---');
for (const b of namedBuildings) {
  if (b.name) {
    const minLat = Math.min(...b.coords.map(c=>c.lat));
    const maxLat = Math.max(...b.coords.map(c=>c.lat));
    const minLng = Math.min(...b.coords.map(c=>c.lng));
    const maxLng = Math.max(...b.coords.map(c=>c.lng));
    console.log(`- ${b.name} (${b.id}):\n    center: { lat: ${b.avgLat.toFixed(6)}, lng: ${b.avgLng.toFixed(6)} }\n    latSpan: ${(maxLat - minLat).toFixed(6)} (${((maxLat-minLat)*111000).toFixed(1)}m)\n    lngSpan: ${(maxLng - minLng).toFixed(6)} (${((maxLng-minLng)*108000).toFixed(1)}m)\n    bbox: [[${minLat.toFixed(6)}, ${minLng.toFixed(6)}], [${maxLat.toFixed(6)}, ${maxLng.toFixed(6)}]]`);
  }
}

console.log('\n--- VERIFIED CAMPUS ROADS & PATHS IN OSM ---');
for (const r of campusRoads) {
  if (r.tags.name?.includes('Campus') || r.tags.access === 'private' || r.tags.highway === 'service' || r.tags.highway === 'footway') {
    console.log(`WAY ${r.id} (${r.tags.name || r.tags.highway}): ${r.coords.length} nodes:`);
    console.log(`  pts: ${JSON.stringify(r.coords.map(c => [Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))]))}`);
  }
}
