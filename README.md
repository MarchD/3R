# 3R

3R is a local-first Garmin FIT inspection and cautious distance-repair workbench. It decodes one or more `.fit` files in the browser, exposes normalized and raw JSON, identifies suspicious evidence, and creates separate repaired JSON and FIT derivatives only after explicit confirmation.

## Privacy and safety model

- Parsing and repair calculations run in a browser Web Worker.
- FIT bytes and decoded activity data remain local. The optional alpha GPS repair sends only a
  sampled coordinate trace, timing, and GPS-accuracy values to Valhalla; place search sends the
  entered query to Nominatim; and the map loads visible OpenStreetMap tiles.
- Raw messages and the original normalized activity are never mutated.
- Analysis is shown first. No repair algorithm runs until the user clicks **Repair activity** and then **Continue to repair**.
- Standard distance repair changes only the derived distance timeline, total distance, derived
  speed, and average pace. The optional alpha GPS repair can also replace record coordinates after
  the user reviews and applies a map-matched route.
- Original files and raw messages are never mutated. Every repair is exported as a separate
  derivative.
- FIT export re-reads the local original, applies the confirmed patch in a worker, and validates the newly encoded file before download.

## Install and run

The checked-in toolchain requires Node.js 20.19 or newer. The repository includes an `.nvmrc` file for compatible version managers.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Add `?version=alpha` to enable the experimental GPS repair workflow.

## Deployment

### Netlify

Connect this repository to a Netlify project. The checked-in `netlify.toml` configures:

- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: `20.19.0`
- SPA fallback: every application route is rewritten to `/index.html`

No Netlify Vite plugin or additional environment variables are required. Netlify builds the app at
the domain root, so generated asset URLs work on both Netlify subdomains and custom domains.

### GitHub Pages

The existing GitHub Actions workflow continues to deploy at `/3R/`. It sets `VITE_BASE_PATH=/3R/`
only for the Pages build; local and Netlify builds use `/`.

## Code quality, build, and test

Run the complete local quality gate—the same checks used by GitHub Actions—with:

```bash
npm run check
```

Individual commands are also available:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

Use `npm run format` and `npm run lint:fix` to apply automatic fixes.

The supplied damaged FIT file can be exercised locally without copying it into the repository:

```bash
FIT_FIXTURE=/absolute/path/to/activity.fit npm test
```

`*.fit` is ignored by Git so private activity files cannot be committed accidentally.

## Garmin Connect workflow

1. In Garmin Connect Web, open **Activities → All Activities**, choose the activity, open the settings gear, and select **Export File**. Garmin documents this in [How Do I Export Data Out of Garmin Connect?](https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8).
2. Attach that original `.fit` file to 3R, inspect it, apply a running-distance repair, and select **Create repaired FIT**.
3. In Garmin Connect Web, select the cloud upload icon, then **Import Data → Browse**, choose the downloaded `.repaired.fit` file, and import it. Garmin documents this in [How to Manually Upload Activities to Garmin Connect](https://support.garmin.com/en-US/?faq=Ht3ZP52Kju075uKvqTqu99).

## Parser

3R uses the official [`@garmin/fitsdk`](https://www.npmjs.com/package/@garmin/fitsdk) JavaScript SDK. The parser adapter creates a `Stream` directly from the uploaded `ArrayBuffer`, checks the FIT header and CRC with `Decoder.checkIntegrity()`, then calls `Decoder.read()` with unknown-data preservation, message listeners, and developer-field listeners enabled.

Decoder errors are surfaced as partial-decoding warnings. CRC failure never starts repair automatically. The app keeps every message returned by the SDK, including unknown numeric fields, and separately builds a Zod-backed normalized activity model. Garmin semicircle coordinates are converted to WGS84 degrees only in that normalized representation.

The repaired FIT exporter uses the SDK's `Encoder` and Garmin's decode–edit–encode pattern. It rebuilds unknown profile entries from their original message definitions, carries developer-field descriptions into the encoder, applies repaired distance and speed values, and writes a fresh FIT header and CRC. Before allowing download, 3R decodes the result again and verifies CRC integrity, record count, and repaired session distance.

## Repair algorithms

Each candidate is implemented as an independent pure function under `src/fit/repair/`:

1. **Steps × median step length** — estimates full running steps and applies the robust median of plausible 0.6–1.6 m step-length samples.
2. **Steps × weighted mean step length** — rejects invalid time, cadence, speed, and distance segments, then weights accepted samples by segment steps and quality.
3. **Cleaned speed integration** — replaces speeds outside 0–6 m/s with the median from a ±60-record local window and integrates with time deltas clamped to 0–3 seconds.

The user must inspect and select a candidate. Nothing is preselected or described as a guaranteed reconstruction.

The experimental GPS workflow is available only with `?version=alpha`. It lets the user correct the
recorded start location, translates the surviving trace while preserving its approximate physical
shape, and map-matches that trace to OpenStreetMap roads through Valhalla. The review map compares
the shifted evidence with the suggested road and scores distance, heading/track, proximity, and—when
available—elevation agreement. Applying the proposal updates only the derived FIT record positions.

Before repair begins, 3R validates that the normalized FIT sport is `running` and that a session with at least two records exists. Unsupported activity types remain available for analysis and JSON download, but repair and FIT updating are blocked with an explicit reason.

## Architecture

```text
src/
  app/                  top-level application composition
  components/           layout, upload, data views, issues, and repair UI
  contexts/             shared UI services such as toast notifications
  fit/
    parser/              official SDK adapter, decoder, Web Worker
    encoder/             preserved-message FIT re-encoding and validation
    normalization/       raw-to-normalized conversion and developer fields
    analysis/            summaries and anomaly evidence
    gps/                 alpha trace analysis, map matching, and evidence scoring
    repair/              pure candidate and patch functions
  hooks/                 attachment, worker, repair, and export orchestration
  models/                FIT and repair types plus Zod schemas
  utils/                 safe JSON, clipboard, and downloads
  tests/                 unit, acceptance, and browser-flow tests
```

Large raw-message and record views are virtualized with `react-window`. Complete JSON trees are rendered lazily with `@uiw/react-json-view`. Each attachment owns independent parsing and repair state, and removing a parsing attachment terminates its worker.

## Add a repair algorithm

1. Add a pure function in `src/fit/repair/` that accepts `NormalizedActivity` and returns a complete `RepairCandidate`.
2. Use only normalized evidence and never mutate the input activity or raw messages.
3. Include assumptions, warnings, confidence, accepted/rejected sample counts, and a full record patch timeline.
4. Register the function in `createRepairCandidates.ts`.
5. Add focused unit tests and extend the integration expectations. The UI renders candidates from the common model and needs no algorithm-specific branch.

## Installed dependencies

Runtime: React 18, the Garmin FIT SDK, React Dropzone, UIW React JSON View, React Window, Zod, and Lucide React. Development: TypeScript, Vite, Vitest, jsdom, Testing Library, ESLint with an Airbnb-derived TypeScript/React ruleset, and Prettier.

Exact resolved versions are recorded in `package-lock.json` and can be inspected with `npm ls --depth=0`.

## Known limitations

- Distance repair currently supports running activities only. Other sports can be parsed and inspected but cannot be updated.
- 3R exports JSON and a repaired FIT derivative. It does not export TCX.
- FIT export creates a newly encoded derivative, not a byte-for-byte copy of the original. Invalid sentinel fields removed by the SDK may make the file smaller.
- Unknown and developer fields are preserved when their original FIT definitions are decodable. Export stops rather than silently dropping data when the source decoder or output validation reports an error.
- Alpha GPS repair produces a plausible map-matched route, not proof of the historical path. Parallel
  roads or sparse/noisy evidence can remain ambiguous even with start, heading, distance, and altitude
  constraints.
- Garmin's JavaScript decoder can return partial messages for some malformed files, but it does not expose byte-level progress or a separate formal “tolerant mode.” 3R therefore reports partial output and decoder errors without claiming a complete recovery.
- Search in normalized JSON reports whether a key or value exists; it does not expand every matching branch automatically.
- Browser clipboard fallback depends on the legacy `document.execCommand('copy')` API when the modern Clipboard API is unavailable.
