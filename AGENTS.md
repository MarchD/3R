# Base44 Dev Environment

## Overview
3R is a **frontend-only** Vite + React + TypeScript SPA for local Garmin FIT file inspection and distance repair. There is no backend, no database, and no required external credentials — all parsing and repair runs in-browser (Web Worker).

## Running
```
docker compose -f docker-compose.base44.yml up -d
```
- Vite dev server (live reload) runs on container port 5173, mapped to host port 3000.
- Source is bind-mounted; `node_modules` lives in a named volume so host installs don't conflict.
- `npm install` runs automatically at container start.
- Node 20.19 (matches `.nvmrc`).

## No secrets required
The app boots without any environment variables. The optional alpha GPS workflow (`?version=alpha`) calls public APIs (Valhalla map-matching, Nominatim search, OSM tiles) that need no credentials.

## Verifying
- `curl -s http://localhost:3000/` returns the Vite-served HTML with `/src/main.tsx`.
- Logs: `docker compose -f docker-compose.base44.yml logs web`
