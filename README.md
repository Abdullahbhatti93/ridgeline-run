[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Abdullahbhatti93/ridgeline-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Abdullahbhatti93/ridgeline-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Ridgeline Run

An original valley flight game for the make.fun bounty
**"Make the best flight game"** (`best-flight-game-20261126-0057`).

Fly a little yellow prop plane down a river valley, thread all eight
target rings, mind your fuel, and put her down on the runway at Ridgeline
Field. A complete game: title screen, live flight, pause, crash and
landing endings, score with a time bonus, and a best score kept in the
browser.

## How to run

No build step, no network. Serve the `game/` folder with any static
server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

or `python3 -m http.server` from inside `game/`. The game plays offline
from its own files only.

## Controls

| Input | Action |
| --- | --- |
| ↑ / W, ↓ / S | Pitch up / down |
| ← / A, → / D | Bank left / right (banked turn) |
| Shift / E, Ctrl / Q | Throttle up / down |
| Mouse move | Steer (pitch + bank); hold left button for throttle |
| G | Landing gear down / up (needed to land) |
| P or Esc | Pause |
| M | Mute |
| R | Restart flight |
| Enter / Space / click | Start, or fly again after a crash or landing |

## The mission

- Eight amber rings are strung along the valley (100 points each). The
  HUD arrow points at the next one with its distance.
- Fuel drains with throttle. Below 20% you get a warning; at 0% the
  engine quits and you glide.
- Below 26 m/s the wing stalls and the nose drops — keep your speed up.
- To land: gear down (G), line up on the runway centreline, slow below
  55 kt and descend gently. A clean touchdown scores 500 plus a time
  bonus. Hit the ridge, stall into the ground, or overshoot the field
  and the flight is over.

## Files

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output dir and writes `dossier.json` with the kit library.
- `vendor/makefun-game.ts` — the kit's dossier library, copied unchanged.
- `game/index.html` — the page; loads `game/src/main.js` as a module.
- `game/src/config.js` — tuning, palette, world constants.
- `game/src/random.js` — seeded RNG (mulberry32) for repeatable scenes.
- `game/src/terrain.js` — procedural valley: hills, river, town, runway, rings.
- `game/src/physics.js` — flight model + mission state machine (DOM-free,
  tested headless in Node).
- `game/src/render.js` — Canvas 2D pseudo-3D renderer: terrain mesh, sky,
  clouds, rings, chase-view aeroplane, HUD, lit instrument panel.
- `game/src/input.js` — keyboard + mouse.
- `game/src/audio.js` — WebAudio engine hum, wind, ring chime, crash and
  landing fanfare. All synthesised; no audio files.
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`), flown
  by an autopilot through the real rules.
- `game/src/main.js` — the game loop and screens.
- `screenshots/` — 4 real renders of the game's own code (see `shots.json`).
- `shots.json` — the four screenshot scenes and their URLs.
- `serve.ts` — tiny static server for local play-testing.

## Screenshots (real renders, 1280×720)

1. `1-cover.jpg` — mid-valley chase view, ring 2 ahead, river and town below.
2. `2-rings.jpg` — threading the rings low over the river.
3. `3-runway.jpg` — short final, gear down, runway dead ahead.
4. `4-landed.jpg` — touchdown on the runway, mission complete.

Each is staged by `?shot=<name>&seed=1`, which plays the real simulation
forward under an autopilot — the frames are what the game itself draws.

## Verification (run by the builder, 2026-11-26)

- `node --check` on every `.js` module: all parse.
- Headless Node test of the flight model (`/tmp/flight-test.mjs`): the
  autopilot flies the whole mission and lands (score 1702, 8/8 rings,
  99.4 s); a no-input flight overshoots and ends; cutting the throttle
  stalls the wing and crashes, as designed.
- Headless-Chrome screenshots of all four `?shot=` scenes at 1280×720,
  viewed and checked: chase view, terrain, aircraft, lit instruments,
  runway/ring ahead, HUD altitude/speed/heading all visible.

## Originality

Everything here is original work made for this bounty: the name, the
valley, the art (all drawn in code), the sounds (all synthesised) and the
code. Nothing is copied from a commercial game. The only third-party file
is the kit's own `vendor/makefun-game.ts`, unchanged.

## License

MIT — see `LICENSE`.
