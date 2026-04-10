// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let map;
let trackData = null;
let terrain3d = false;
let apiKey = localStorage.getItem('maptiler_key') || '';

// ─────────────────────────────────────────────
// MAP INIT
// ─────────────────────────────────────────────
function buildStyle(key) {
  if (key) {
    return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`;
  }
  // Fallback: OpenFreeMap (no key required)
  return 'https://tiles.openfreemap.org/styles/liberty';
}

function initMap() {
  if (map) map.remove();

  map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(apiKey),
    center: [0, 20],
    zoom: 2,
    pitch: 0,
    bearing: 0,
    antialias: true
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');

  map.on('load', () => {
    if (apiKey) setupTerrain();
    if (trackData) renderTrack();
  });
}

function setupTerrain() {
  if (!apiKey) return;
  if (!map.getSource('terrain-src')) {
    map.addSource('terrain-src', {
      type: 'raster-dem',
      url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
      tileSize: 256
    });
  }
}

// ─────────────────────────────────────────────
// TERRAIN TOGGLE
// ─────────────────────────────────────────────
document.getElementById('btn-3d').addEventListener('click', () => {
  terrain3d = !terrain3d;
  const btn = document.getElementById('btn-3d');

  if (terrain3d) {
    if (!apiKey) {
      alert('3D terrain requires a MapTiler API key.\nGet a free one at maptiler.com, then click the 🔑 button.');
      terrain3d = false;
      return;
    }
    setupTerrain();
    map.setTerrain({ source: 'terrain-src', exaggeration: 1.5 });
    map.easeTo({ pitch: 60, duration: 800 });
    btn.textContent = '◼ Flat Map';
  } else {
    map.setTerrain(null);
    map.easeTo({ pitch: 0, duration: 600 });
    btn.textContent = '⬛ 3D Terrain';
  }
});

// ─────────────────────────────────────────────
// GPX PARSING
// ─────────────────────────────────────────────
function parseGPX(xmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');

  const name =
    doc.querySelector('trk > name')?.textContent ||
    doc.querySelector('rte > name')?.textContent ||
    doc.querySelector('metadata > name')?.textContent ||
    'Unnamed Track';

  let points = [];

  // Try trkpt (track points)
  const trkpts = doc.querySelectorAll('trkpt');
  if (trkpts.length > 0) {
    trkpts.forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
      if (!isNaN(lat) && !isNaN(lon)) points.push([lon, lat, ele]);
    });
  }

  // Fallback: rtept (route points)
  if (points.length === 0) {
    doc.querySelectorAll('rtept').forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
      if (!isNaN(lat) && !isNaN(lon)) points.push([lon, lat, ele]);
    });
  }

  // Waypoints as fallback
  if (points.length === 0) {
    doc.querySelectorAll('wpt').forEach(pt => {
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      const ele = parseFloat(pt.querySelector('ele')?.textContent || 0);
      if (!isNaN(lat) && !isNaN(lon)) points.push([lon, lat, ele]);
    });
  }

  return { name, points };
}

// ─────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────
function haversine([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeStats(points) {
  let dist = 0, gain = 0, loss = 0;
  let elevs = points.map(p => p[2]);
  let maxE = -Infinity, minE = Infinity;
  for (const e of elevs) {
    if (e > maxE) maxE = e;
    if (e < minE) minE = e;
  }

  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i-1], points[i]);
    const de = points[i][2] - points[i-1][2];
    if (de > 0) gain += de;
    else loss += Math.abs(de);
  }

  return { dist, gain, loss, maxE, minE, pts: points.length, elevs };
}

function showStats(name, stats) {
  document.getElementById('track-name').textContent = name;
  document.getElementById('s-dist').innerHTML = stats.dist.toFixed(2) + '<span class="stat-unit">km</span>';
  document.getElementById('s-gain').innerHTML = Math.round(stats.gain) + '<span class="stat-unit">m</span>';
  document.getElementById('s-loss').innerHTML = Math.round(stats.loss) + '<span class="stat-unit">m</span>';
  document.getElementById('s-max').innerHTML = Math.round(stats.maxE) + '<span class="stat-unit">m</span>';
  document.getElementById('s-min').innerHTML = Math.round(stats.minE) + '<span class="stat-unit">m</span>';
  document.getElementById('s-pts').textContent = stats.pts.toLocaleString();
  document.getElementById('stats-panel').classList.add('visible');
}

// ─────────────────────────────────────────────
// ELEVATION CHART
// ─────────────────────────────────────────────
function drawElevation(elevs) {
  const canvas = document.getElementById('elev-canvas');
  const panel = document.getElementById('elev-panel');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 40;
  const H = 80;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  let minE = Infinity, maxE = -Infinity;
  for (const e of elevs) {
    if (e > maxE) maxE = e;
    if (e < minE) minE = e;
  }
  const range = maxE - minE || 1;
  const n = elevs.length;

  // Background grid lines
  ctx.strokeStyle = 'rgba(212,80,10,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Fill gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(26, 107, 74, 0.55)');
  grad.addColorStop(1, 'rgba(26, 107, 74, 0.02)');

  ctx.beginPath();
  elevs.forEach((e, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((e - minE) / range) * H * 0.9 - H * 0.05;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  elevs.forEach((e, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((e - minE) / range) * H * 0.9 - H * 0.05;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(26, 107, 74, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  panel.classList.add('visible');
}

// ─────────────────────────────────────────────
// RENDER TRACK ON MAP
// ─────────────────────────────────────────────
function renderTrack() {
  if (!trackData || !map.isStyleLoaded()) return;

  const { points } = trackData;
  const coords2d = points.map(p => [p[0], p[1]]);
  const geojson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords2d }
    }]
  };

  // Remove existing
  ['gpx-track', 'gpx-track-glow', 'gpx-start', 'gpx-end'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  ['gpx-line', 'gpx-pts'].forEach(id => {
    if (map.getSource(id)) map.removeSource(id);
  });

  map.addSource('gpx-line', { type: 'geojson', data: geojson });

  // Glow
  map.addLayer({
    id: 'gpx-track-glow',
    type: 'line',
    source: 'gpx-line',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#d4500a', 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 4 }
  });

  // Track
  map.addLayer({
    id: 'gpx-track',
    type: 'line',
    source: 'gpx-line',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#f06030', 'line-width': 2.5, 'line-opacity': 0.95 }
  });

  // Start/end markers
  const startEl = document.createElement('div');
  startEl.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#1a6b4a;border:2px solid #f2ede6;box-shadow:0 0 8px rgba(26,107,74,0.8)';
  new maplibregl.Marker({ element: startEl }).setLngLat(coords2d[0]).addTo(map);

  const endEl = document.createElement('div');
  endEl.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#d4500a;border:2px solid #f2ede6;box-shadow:0 0 8px rgba(212,80,10,0.8)';
  new maplibregl.Marker({ element: endEl }).setLngLat(coords2d[coords2d.length - 1]).addTo(map);

  // Fit bounds
  fitTrack(coords2d);
}

function fitTrack(coords) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of coords) {
    if (c[0] < minLon) minLon = c[0];
    if (c[0] > maxLon) maxLon = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  map.fitBounds(
    [[minLon, minLat], [maxLon, maxLat]],
    { padding: 80, duration: 1200, pitch: terrain3d ? 55 : 0 }
  );
}

// ─────────────────────────────────────────────
// LOAD GPX
// ─────────────────────────────────────────────
function loadGPX(text) {
  const parsed = parseGPX(text);
  if (parsed.points.length === 0) {
    alert('No track points found in this GPX file.');
    return;
  }

  trackData = parsed;
  const stats = computeStats(parsed.points);

  document.getElementById('drop-overlay').classList.add('hidden');
  showStats(parsed.name, stats);
  drawElevation(stats.elevs);

  if (map.isStyleLoaded()) {
    renderTrack();
  } else {
    map.once('load', renderTrack);
  }
}

// ─────────────────────────────────────────────
// FILE INPUT
// ─────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => loadGPX(ev.target.result);
  reader.readAsText(file);
});

// ─────────────────────────────────────────────
// DRAG & DROP
// ─────────────────────────────────────────────
document.body.addEventListener('dragover', e => {
  e.preventDefault();
  document.body.classList.add('drag-active');
  document.getElementById('drop-overlay').classList.remove('hidden');
});

document.body.addEventListener('dragleave', e => {
  if (e.relatedTarget === null) document.body.classList.remove('drag-active');
});

document.body.addEventListener('drop', e => {
  e.preventDefault();
  document.body.classList.remove('drag-active');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.gpx')) {
    const reader = new FileReader();
    reader.onload = ev => loadGPX(ev.target.result);
    reader.readAsText(file);
  } else {
    alert('Please drop a .gpx file.');
  }
});

// ─────────────────────────────────────────────
// CONTROL BUTTONS
// ─────────────────────────────────────────────
document.getElementById('btn-fit').addEventListener('click', () => {
  if (!trackData) return;
  const coords = trackData.points.map(p => [p[0], p[1]]);
  fitTrack(coords);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  trackData = null;
  document.getElementById('drop-overlay').classList.remove('hidden');
  document.getElementById('stats-panel').classList.remove('visible');
  document.getElementById('elev-panel').classList.remove('visible');
  ['gpx-track', 'gpx-track-glow'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('gpx-line')) map.removeSource('gpx-line');
  // Remove markers
  document.querySelectorAll('.maplibregl-marker').forEach(m => m.remove());
  document.getElementById('file-input').value = '';
});

// API Key Panel
document.getElementById('btn-apikey').addEventListener('click', () => {
  const panel = document.getElementById('api-panel');
  panel.classList.toggle('visible');
  if (panel.classList.contains('visible') && apiKey) {
    document.getElementById('api-key-input').value = apiKey;
  }
});

document.getElementById('btn-apply-key').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('maptiler_key', key);
  document.getElementById('api-panel').classList.remove('visible');
  initMap(); // Re-init with new key for outdoor style
});

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
initMap();

// Pre-fill API key input if stored
if (apiKey) {
  document.getElementById('api-key-input').value = apiKey;
}
