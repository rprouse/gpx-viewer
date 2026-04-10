# TERRAIN // GPX Viewer

A zero-dependency, no-build-step GPX track viewer that runs entirely in the browser. Drop a GPX file onto the map to visualize your track with elevation profile and stats.

## Features

- **Drag & drop or browse** — load any GPX 1.0 or 1.1 file (tracks, routes, waypoints)
- **Interactive map** — powered by [MapLibre GL JS](https://maplibre.org/) with smooth panning, zooming, and rotation
- **3D terrain** — toggle 3D terrain view with elevation exaggeration (requires a free MapTiler API key)
- **Elevation profile** — canvas-rendered elevation chart with gradient fill
- **Track statistics** — distance, elevation gain/loss, max/min elevation, point count
- **Start/end markers** — green start and orange end markers on the track
- **No server required** — open the HTML file directly in any modern browser

## Quick Start

1. Open `gpx-viewer.html` in a modern browser — no server, no npm, no compilation needed.
2. Drop a `.gpx` file onto the page, or click **Browse files**.
3. The track renders on the map with stats and an elevation profile.

### Optional: MapTiler API Key

By default the map uses [OpenFreeMap](https://openfreemap.org/) (no key required). For richer outdoor map tiles and 3D terrain support:

1. Get a free API key at [maptiler.com](https://www.maptiler.com/).
2. Click the **API Key** button in the app and paste your key.
3. The key is saved in `localStorage` and persists across sessions.

## Project Structure

```
gpx-viewer.html   — Single-page HTML shell
gpx-viewer.js     — All application logic (~430 lines)
gpx-viewer.css    — Styles and design tokens (~360 lines)
```

There is no build step, no bundler, no `node_modules`. The only external dependencies are loaded via CDN:

- **MapLibre GL JS 4.7.1** — map rendering
- **Google Fonts** — Bebas Neue (headings) and DM Mono (UI)

## How It Works

### Data Flow

1. User drops or selects a `.gpx` file
2. `parseGPX()` extracts points from `<trkpt>`, falling back to `<rtept>`, then `<wpt>`
3. `computeStats()` calculates distance (haversine formula), elevation gain/loss, and min/max
4. `renderTrack()` adds the track as a GeoJSON LineString with a glow layer and solid line
5. `drawElevation()` renders the elevation profile on an HTML Canvas element

### Map Styles

| Configuration | Map Style | 3D Terrain |
|---|---|---|
| No API key | OpenFreeMap Liberty | Not available |
| With MapTiler key | MapTiler Outdoor v2 | Available |

### Global State

The app uses a small set of module-level variables in `gpx-viewer.js`:

- `map` — the MapLibre GL map instance
- `trackData` — `{ name, points }` where points are `[lon, lat, ele]` triples
- `terrain3d` — boolean toggle for 3D terrain mode
- `apiKey` — MapTiler key, persisted in `localStorage`

## Development

### Getting Started

No setup required. Edit the files and refresh the browser.

For a local server (useful for avoiding CORS issues if you modify CDN sources):

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

### CSS Design Tokens

All colors are defined as CSS custom properties in `:root`:

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#d4500a` | Orange — track glow, borders, buttons |
| `--accent2` | `#1a6b4a` | Green — elevation chart, start marker |
| `--ink` | `#0a0c0f` | Dark background |
| `--paper` | `#f2ede6` | Light text |
| `--panel-bg` | `rgba(10,12,15,0.88)` | Semi-transparent panel backgrounds |

### Architecture Notes

- **No frameworks** — vanilla JS with direct DOM manipulation
- **Script placement** — `<script>` is at the end of `<body>`, so DOM queries run immediately without `DOMContentLoaded`
- **UI transitions** — CSS `opacity`/`transform` transitions toggled by `.visible`/`.hidden` classes
- **Responsive chart** — the elevation canvas redraws on window resize with a 200ms debounce

## License

[MIT](LICENSE) — Copyright (c) 2026 Rob Prouse
