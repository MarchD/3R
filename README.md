# 3R

3R is a local-first Garmin FIT inspection and cautious distance-repair workbench. It decodes one or more `.fit` files in the browser, exposes normalized and raw JSON, identifies suspicious evidence, and creates a separate repaired JSON activity only after explicit confirmation.

## Privacy and safety model

- Parsing and repair calculations run in a browser Web Worker.
- FIT bytes and decoded activity data are never sent to a server.
- Raw messages and the original normalized activity are never mutated.
- Analysis is shown first. No repair algorithm runs until the user clicks **Repair activity** and then **Continue to repair**.
- Repair changes only the derived distance timeline, total distance, derived speed, and average pace.
- Coordinates, timestamps, heart rate, cadence, elevation, calories, and original raw messages are not modified.

## Install and run

The checked-in toolchain works with Node.js 16.20 or newer. A current LTS Node release is recommended.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Build and test

```bash
npm run build
npm test
```

The supplied damaged FIT file can be exercised locally without copying it into the repository:

```bash
FIT_FIXTURE=/absolute/path/to/activity.fit npm test
```

`*.fit` is ignored by Git so private activity files cannot be committed accidentally.

## Parser

3R uses the official [`@garmin/fitsdk`](https://www.npmjs.com/package/@garmin/fitsdk) JavaScript SDK. The parser adapter creates a `Stream` directly from the uploaded `ArrayBuffer`, checks the FIT header and CRC with `Decoder.checkIntegrity()`, then calls `Decoder.read()` with unknown-data preservation, message listeners, and developer-field listeners enabled.

Decoder errors are surfaced as partial-decoding warnings. CRC failure never starts repair automatically. The app keeps every message returned by the SDK, including unknown numeric fields, and separately builds a Zod-backed normalized activity model. Garmin semicircle coordinates are converted to WGS84 degrees only in that normalized representation.

## Repair algorithms

Each candidate is implemented as an independent pure function under `src/fit/repair/`:

1. **Steps × median step length** — estimates full running steps and applies the robust median of plausible 0.6–1.6 m step-length samples.
2. **Steps × weighted mean step length** — rejects invalid time, cadence, speed, and distance segments, then weights accepted samples by segment steps and quality.
3. **Cleaned speed integration** — replaces speeds outside 0–6 m/s with the median from a ±60-record local window and integrates with time deltas clamped to 0–3 seconds.

The user must inspect and select a candidate. Nothing is preselected or described as a guaranteed reconstruction.

## Architecture

```text
src/
  app/                  application state and worker orchestration
  components/           upload, attachments, data views, issues, repair UI
  fit/
    parser/              official SDK adapter, decoder, Web Worker
    normalization/       raw-to-normalized conversion and developer fields
    analysis/            summaries and anomaly evidence
    repair/              pure candidate and patch functions
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

Runtime: React 18, the Garmin FIT SDK, React Dropzone, UIW React JSON View, React Window, Zod, and Lucide React. Development: TypeScript, Vite, Vitest, jsdom, and Testing Library.

Exact resolved versions are recorded in `package-lock.json` and can be inspected with `npm ls --depth=0`.

## Known limitations

- 3R exports JSON only. It does not write a replacement FIT or TCX file.
- A damaged route cannot be reconstructed without independent route evidence such as GPX or another trace.
- Garmin's JavaScript decoder can return partial messages for some malformed files, but it does not expose byte-level progress or a separate formal “tolerant mode.” 3R therefore reports partial output and decoder errors without claiming a complete recovery.
- Search in normalized JSON reports whether a key or value exists; it does not expand every matching branch automatically.
- Browser clipboard fallback depends on the legacy `document.execCommand('copy')` API when the modern Clipboard API is unavailable.
