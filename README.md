# Connect Four — Strategy · Speed · Smarts

A modern web platform for Connect Four built as a **product**, not a homework grid. Play against a smart bot, challenge a friend on the same device, or duel online in real time — with turn timers, move hints, customization, and a global win leaderboard.

**Live demo:** https://sujindikasylzada-cyber.github.io/connect-four/  
**Repository:** https://github.com/sujindikasylzada-cyber/connect-four

---

## Who is this for?

| Audience | Why they'll use it |
|----------|-------------------|
| **Casual players** | Polished UI, light/dark theme, quick bot games |
| **Competitive friends** | Turn timer (5–60s), local 2P, private online rooms |
| **Strategy learners** | “Ask Advisor” hint, four bot difficulties up to minimax |
| **Online duelists** | Real-time multiplayer via Firebase + global win rankings |

Most Connect Four sites stop at “drop a disc and win.” This one adds **speed pressure**, **AI depth**, **online play**, and **retention hooks** (shop, leaderboard, saved games) — the kind of thinking you'd expect from a small indie game service.

---

## Features

### Core gameplay
- Standard **7×6** board with gravity, alternating turns, full-column blocking
- Win detection on **horizontal, vertical, and diagonal** lines
- **Winning line highlight** with pulse animation
- **Draw** detection when the board is full

### Game modes
- **vs Bot** — four difficulty levels (Easy → Master with minimax + alpha-beta pruning)
- **Local 2P** — two players on one screen
- **Online** — private 4-digit room codes or random matchmaking (Firebase Realtime Database)

### Product extras
- **Turn timer** — configurable 5s / 15s / … / 60s per move
- **Ask Advisor** — one suggested column per game (heuristic AI)
- **Post-game summary** — moves, elapsed time, per-player averages, short commentary
- **Resume game** — in-progress matches saved to `localStorage`
- **Local leaderboard** — win rate stats by player name (bot/local games)
- **Global leaderboard** — top online winners (Firebase)
- **Customization shop** — piece shapes, player colors, board themes (free + PRO items)
- **Connect Four PRO** — monetization prototype ($1.99/mo UI + evaluator trial unlock)
- **Light / dark theme** — toggle in the top-right, persisted locally

### Responsive design
- **Desktop:** three-column layout (players · board · dashboard/leaderboard)
- **Mobile:** compact single-column flow with touch-friendly columns

---

## How this maps to the assignment levels

| Level | Status |
|-------|--------|
| **Medium** — rules, local 2P, localStorage | ✅ Complete |
| **Strong** — AI levels, hints, win highlight, Firebase, responsive, themes | ✅ Mostly complete |
| **Great** — online multiplayer, global leaderboard, PRO/monetization, niche (speed + strategy) | ✅ Prototype level — online needs Firebase Console setup |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | React 18 (CDN) + inline JSX in `index.html` |
| Styling | CSS custom properties, glassmorphism, responsive breakpoints |
| Local state | `localStorage` (game, shop, theme, local leaderboard) |
| Online / global data | Firebase Realtime Database + Anonymous Auth |
| Hosting | GitHub Pages (static, no build step) |

No bundler or backend server — open the files and play. Online features activate once Firebase is configured.

---

## Project structure

```
connect-four/
├── index.html                 # Full React app (UI + game logic + AI)
├── firebase-config.js         # Firebase web credentials
├── firebase-multiplayer.js    # Rooms, matchmaking, moves, global leaderboard
├── firebase-database.rules.json # Paste into Firebase Console (not deployed to Pages)
├── FIREBASE_SETUP.md          # Step-by-step Firebase Console checklist
├── DEPLOY.md                  # GitHub Pages upload guide
└── README.md                  # This file
```

---

## Run locally

1. Clone the repository:
   ```bash
   git clone https://github.com/sujindikasylzada-cyber/connect-four.git
   cd connect-four
   ```
2. Serve the folder with any static server (or open `index.html` in a browser):
   ```bash
   npx serve .
   ```
3. Open `http://localhost:3000` (or the path your server prints).

**Bot** and **Local 2P** work immediately. **Online** and the **global leaderboard** require Firebase setup (below).

---

## Firebase setup (online + global leaderboard)

The live site ships with `firebase-config.js`. For online play to work you must complete one-time setup in the Firebase Console:

1. Enable **Realtime Database**
2. Enable **Anonymous** sign-in (`Authentication → Sign-in method`)
3. Add **`sujindikasylzada-cyber.github.io`** to authorized domains
4. Publish rules from `firebase-database.rules.json`

Full instructions: **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**

Deploy updates: **[DEPLOY.md](./DEPLOY.md)**

---

## Bot difficulty reference

| Level | Behavior |
|-------|----------|
| 🟢 Easy | ~80% random; occasionally blocks or wins |
| 🟡 Medium | Always wins if possible, blocks threats, otherwise random |
| 🟠 Hard | Heuristic board scoring (centre control, windows of 2–4) |
| 🔴 Master | Minimax with alpha-beta pruning (depth 6) |

The **Advisor** uses the Hard heuristic to suggest one column per game.

---

## What makes it different

1. **Speed as a feature** — optional turn timer turns casual play into quick duels.
2. **Depth without complexity** — Master bot is genuinely challenging; Easy is forgiving for beginners.
3. **Retention loop** — shop cosmetics, PRO tier, saved games, local + global stats.
4. **Online-ready architecture** — transactional moves, presence/disconnect handling, rematch votes.
5. **Polish** — theme toggle, drop animations, glass UI, custom SVG piece shapes.

---

## Known limitations (honest scope)

- Single-file architecture (`index.html` ~115 KB) — fast to ship, harder to maintain at scale
- PRO checkout is a **UI prototype** (no Stripe integration yet)
- Post-game “coach” uses **template commentary**, not move-by-move analysis
- No city-based leaderboard or full match replay history
- Firebase rules are open for development — tighten before a public launch

---

## Assignment submission

| Deliverable | Link |
|-------------|------|
| Working project | https://sujindikasylzada-cyber.github.io/connect-four/ |
| GitHub repository | https://github.com/sujindikasylzada-cyber/connect-four |
| Product description | This README |

Built for the **nFactorial Connect Four** challenge — demonstrating product thinking, technical depth, and a path toward a real service.

---

## License

MIT — free to learn from, fork, and improve.
