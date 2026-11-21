# CSP

Friends-only browser FPS. Tiny download, procedural world, guest play first.

**Live:** upload `public/` to your GitHub repo connected to Cloudflare Pages  
**Caps:** max 10 rooms · max 20 players (10v10) — multiplayer wired later  
**Auth / coins / cosmetics:** later

## Upload to GitHub (no terminal)

1. Open your empty GitHub repo in the browser  
2. **Add file → Upload files**  
3. Drag **everything inside this project** (or at least the `public` folder + this README)  
4. Commit to `main`

## Cloudflare Pages settings

| Setting | Value |
| --- | --- |
| Build command | *(leave empty)* |
| Build output directory | `public` |
| Production branch | `main` |

If you upload so that `index.html` is at the **repo root**, set output directory to `/` instead.

## Local play

Open `public/index.html` via any static server, or deploy to Pages and use the `*.pages.dev` URL.

```bash
# optional local server
npx --yes serve public
```

## What’s in this overall build

- Main menu (guest play, create/join room stubs, settings)
- Procedural medium dockyard map
- Desktop + mobile controls, fullscreen
- Quality presets (Low / Med / High)
- Mission: plant / defuse the bomb on A or B
- HUD, damage, simple hostiles
- No login yet (guest only)
