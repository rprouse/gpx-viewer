# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A zero-dependency, no-build-step GPX track viewer. Three files: `gpx-viewer.html`, `gpx-viewer.js`, and `gpx-viewer.css`. Open `gpx-viewer.html` directly in a browser — no server, no npm, no compilation.

## Quick Start

Open `gpx-viewer.html` in any modern browser. No local server needed.
Get a free MapTiler API key at maptiler.com for outdoor map style and 3D terrain (optional).

## Architecture

**Libraries (CDN only):**
- MapLibre GL JS 4.7.1 — map rendering
- Fonts: Bebas Neue (display headings), DM Mono (UI mono)

**Global state in `gpx-viewer.js`:**
- `map` — the MapLibre map instance
- `trackData` — `{ name, points }` where points are `[lon, lat, ele]` triples
- `terrain3d` — boolean toggle for 3D terrain mode
- `apiKey` — MapTiler API key, persisted in `localStorage`

**Map style strategy:**
- With `apiKey`: uses MapTiler outdoor-v2 style (richer terrain, 3D support)
- Without `apiKey`: falls back to OpenFreeMap liberty style (no key required, no 3D terrain)

**Data flow:**
1. User drops/selects a `.gpx` file → `loadGPX(text)`
2. `parseGPX()` extracts points from `trkpt` → `rtept` → `wpt` (priority order)
3. `computeStats()` runs haversine distance + elevation gain/loss
4. `renderTrack()` adds GeoJSON LineString to MapLibre with glow + solid layers
5. `drawElevation()` renders an HTML Canvas elevation profile chart

**UI panels** use CSS `opacity`/`transform` transitions toggled by `.visible` / `.hidden` classes — no JS animation libraries.

**Script placement:** `<script src="gpx-viewer.js">` is at the end of `<body>`. All event listeners query the DOM immediately on load — moving the tag to `<head>` requires wrapping in `DOMContentLoaded`.

## CSS Design Tokens

All colors are defined as CSS custom properties in `:root` in `gpx-viewer.css`:
- `--accent` (`#d4500a`) — orange, track glow, borders
- `--accent2` (`#1a6b4a`) — green, elevation chart, start marker
- `--ink` / `--paper` — dark background / light text
- `--panel-bg` — semi-transparent dark for floating panels
