# Cursor Cloud specific instructions

Durable, non-obvious guidance for Cursor Cloud agents working in this repo. Kept in a dedicated file (and only linked from `AGENTS.md`) so it doesn't pollute context on every session.

Jamez is a **pnpm monorepo** (Node ≥20, pnpm 10.33.3). There is **no database and no backend of our own** — devices sync host↔guest through a Nostr relay over WebSocket, and game history lives in `localStorage`/`AsyncStorage`. Standard commands live in `README.md` and root `package.json` scripts; this doc only covers non-obvious cloud gotchas.

## Services / how to run

- **Web app + core (primary dev loop):** `pnpm dev` from the repo root — builds `@jamez/core` once, then runs `@jamez/core` in watch mode and the Vite web server concurrently at `http://localhost:5173`.
- **Local relay (`@jamez/relay`):** `pnpm relay` — an in-memory NIP-01 Nostr relay on port **7447** (`ws://localhost:7447`). Run it for LAN/offline/testing so you don't depend on public internet relays.
- **Mobile (`@jamez/mobile`, Expo/React Native):** requires a macOS/Xcode iOS simulator or a physical device, so it **cannot be run to completion in this Linux cloud VM**. It still typechecks (`pnpm -r typecheck`) and its Metro bundle can be sanity-checked headlessly via `pnpm --filter @jamez/mobile export:check`.

## Non-obvious gotchas

- **Point the web app at the local relay with the `?relay=` URL param**, e.g. `http://localhost:5173/?relay=ws://localhost:7447`. Otherwise it defaults to public Nostr relays (`relay.damus.io`, `nos.lol`, …) which need outbound internet and are flaky/unreliable for testing.
- **Manual multi-client testing MUST use isolated browser sessions** (e.g. a normal window + an Incognito window, or two separate profiles). The user profile/identity is stored in `localStorage`, so two tabs in the same profile share state — the guest overwrites the host's profile and the lobby never shows 2 distinct players. This is the single easiest way to get a false-positive "it synced" result.
- **`pnpm dev` cold-start race:** on first run Vite may print `Failed to run dependency scan ... @jamez/core ... could not be resolved` because Vite's pre-bundle scan can race the initial `@jamez/core` build. It self-resolves once `packages/core/dist` is written; a browser refresh clears it. It is not a real failure.
- **`.npmrc` sets `node-linker=hoisted`** — required so Metro (Expo) works in this pnpm monorepo. Don't switch to isolated/symlinked node_modules.
- **`pnpm install` warns "Ignored build scripts: esbuild"** — harmless; tsup/Vite builds work fine without running esbuild's postinstall.

## E2E tests (Playwright)

- Run with `pnpm build` then `node e2e/smoke.mjs` — it boots the built web app via `vite preview` (port 4173) plus an in-process relay and drives two headless browsers through full Wingspan + Gin Rummy games. Screenshots land in `e2e/artifacts/`.
- **Prerequisite (not in the startup update script):** the Chromium browser must be installed once with `pnpm exec playwright install --with-deps chromium`. The `--with-deps` step uses `sudo apt-get` and is slow (~15 min) but only needed when running e2e.
