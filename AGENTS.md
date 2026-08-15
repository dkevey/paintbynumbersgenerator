# AGENTS.md

## Project overview

This repository is Anna's Wattle Fern Studio version of the Paint by Numbers Generator. It contains:

- a browser interface built from `index.html`, `styles/`, and `scripts/`;
- TypeScript source for the browser app in `src/`;
- a Node/Express server in `server.js` for the WFS local export workflow;
- a CLI implementation in `src-cli/`;
- generated WFS product folders under `out/`.

The WFS workflow is the current priority. Preserve the original paint-by-numbers behaviour unless a task explicitly asks to change it.

## Working with Anna

- Use Australian English in user-facing text and documentation.
- Explain changes in plain language and give short, numbered steps when Anna needs to do something manually.
- Prefer completing and verifying a requested change rather than only describing how to make it.
- Do not assume GitHub Copilot-specific workflows or files. These instructions are for Codex used from VS Code.
- Before making changes, inspect `git status` and preserve unrelated work already in the working tree.
- Do not commit, push, merge, delete branches, or modify remotes unless Anna explicitly asks.

## Local development

- Use Node.js 16 for the established local workflow: `nvm use 16`.
- Install dependencies with `npm install` when needed.
- Start the WFS local server from the repository root with `PORT=3001 node server.js`.
- Open `http://localhost:3001` in the browser.
- After changing browser JavaScript, use a hard refresh on Mac (`Cmd+Shift+R`) if the browser shows stale behaviour.
- Stop the local server with `Ctrl+C`.
- `npm start` runs the original lite-server on port 10001; use the Express command above when testing WFS export features.

## Source and generated files

- Treat `src/` as the primary TypeScript source for browser logic. Its compiler output is the tracked `scripts/main.js` file.
- Treat `src-cli/main.ts` as the primary CLI source. Keep the tracked `src-cli/main.js` output in sync when CLI behaviour changes.
- `scripts/wfs-client.js` and `server.js` are hand-maintained JavaScript used by the WFS browser/export workflow.
- Avoid broad rewrites or formatting of generated JavaScript; keep diffs focused on the requested behaviour.
- Do not edit vendored libraries in `scripts/lib/` or `styles/lib/` unless the task explicitly requires it.
- Do not edit files in `dist/` unless the task is specifically about the deployed static build.

## WFS export requirements

- Generated product folders belong under `out/WFS_<ProductName>/`.
- `out/` is generated local content, is ignored by Git, and must not be committed.
- Preserve the established WFS folder structure: `PNG/`, `SVG/`, `PROCREATE/`, and `_Shop/` with `Canva/`, `Listing images/`, and `Social Media/`.
- Preserve product-name sanitisation and reject duplicate product folders rather than silently overwriting them.
- Keep original artwork and generated customer files local unless Anna explicitly asks for an upload or hosted workflow.
- Be cautious with cleanup code: never delete an existing WFS product folder as part of routine testing.

## Verification

- Before reporting completion, run the narrowest relevant checks for the files changed.
- For browser or WFS export changes, start the Express server and verify the affected workflow at `http://localhost:3001` when practical.
- For TypeScript changes, compile the relevant project and confirm the tracked JavaScript output is intentional.
- Check `git diff --check` and review `git status` before handoff.
- Do not treat generated files in `out/` as test fixtures or source-controlled output.

## Git workflow

- The main branch is `master`.
- Use `git status`, `git branch --show-current`, and `git log -3 --oneline` for routine checks.
- Fetch safely with `git fetch --prune` when Anna asks to refresh remote information.
- Keep commits small and describe the user-visible change clearly.
- When merging a feature branch, first ensure its work is committed and pushed, update `master` with `git pull origin master`, merge the feature branch, push `master`, and verify a clean status.
