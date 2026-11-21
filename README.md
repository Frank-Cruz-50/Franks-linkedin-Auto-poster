# Supply Chain Content Engine

Frank's local app for LinkedIn: it researches supply chain news, writes posts in his voice, and schedules them in Typefully. It runs on your own computer at `http://localhost:3000`, and it costs nothing extra: the AI runs on your **Claude Pro** login (and **Google AI Pro** for the Gemini fallback).

```
Research feed → Generate (angles → 4 versions × 5 hooks → long-form → final post) → Drafts / Calendar → Library
```

## What you need

- **Node.js 20.9 or newer** ([nodejs.org](https://nodejs.org), LTS)
- **Claude Code**, signed in with your Claude Pro plan
- **Gemini CLI**, signed in with your Google AI Pro account (only needed for the fallback writer)
- A free **Typefully** API key and a free **Unsplash** developer key

## Setup (once)

### 1. Get the code and your two personal files

```bash
git clone https://github.com/Frank-Cruz-50/Franks-linkedin-Auto-poster.git
```

```bash
cd Franks-linkedin-Auto-poster
```

Your voice guide and data are **not** in the GitHub repo (the repo is public). Copy them in from the starter zip (`content-engine-starter`):

| From the zip | To the app folder |
|---|---|
| `FRANK_VOICE.md` | `FRANK_VOICE.md` |
| `seed/seed.json` | `seed/seed.json` |

### 2. Install and load your data

```bash
npm install
```

```bash
npm run seed
```

`npm install` creates `.env` from `.env.example`. `npm run seed` creates the database (`prisma/engine.db`) and loads your 75 articles, 5 posts, 2 drafts, trends, playbook and settings. It's safe to run again: rows are matched by id, nothing is duplicated.

### 3. Sign in to Claude Code with your Pro plan

```bash
npm install -g @anthropic-ai/claude-code
```

```bash
claude
```

Choose **Claude account with subscription** and sign in with your Pro account, then type `/exit`. The app uses that login through the Claude Agent SDK, so runs count against your Pro usage limits and nothing is billed separately.

> **Never set `ANTHROPIC_API_KEY`.** If it's in `.env` or your shell, Claude Code bills the paid API instead of your plan. The app checks for it on startup and refuses to run any AI job while it's set (you'll see a red banner). Check with `echo $ANTHROPIC_API_KEY` (macOS) or `echo %ANTHROPIC_API_KEY%` (Windows); remove it from your shell profile if it prints anything.

### 4. Sign in to Gemini CLI (fallback writer)

```bash
npm install -g @google/gemini-cli
```

```bash
gemini
```

Pick **Login with Google** and use the Google account that has AI Pro. Then quit. The app calls it as `gemini -p … --output-format json`. Google lists 1,500 requests a day for AI Pro.

### 5. Typefully key (free plan)

In Typefully: **Settings → API** → create a key. Paste it into `.env` as `TYPEFULLY_API_KEY`. `TYPEFULLY_SOCIAL_SET_ID` is already set to your account (365181). The free plan allows **10 posts a month**.

### 6. Unsplash key (free)

Go to [unsplash.com/developers](https://unsplash.com/developers) → **Your apps → New Application**, accept the guidelines, and copy the **Access Key** into `.env` as `UNSPLASH_ACCESS_KEY`. A new "demo" app gets 50 searches an hour, which is plenty.

### 7. Start it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The server only listens on `127.0.0.1`, so nothing outside your computer can reach it. (`npm run start` runs the faster production build instead.)

## Environment variables (`.env`)

| Variable | What it does |
|---|---|
| `DATABASE_URL` | SQLite file. Default `file:./engine.db` (lives in `prisma/`). |
| `AI_PRIMARY` | Default writer: `claude` or `gemini`. You can switch per post on the Generate tab. |
| `TYPEFULLY_API_KEY` | Your Typefully API key (free plan). |
| `TYPEFULLY_SOCIAL_SET_ID` | Your Typefully account. `365181`. |
| `UNSPLASH_ACCESS_KEY` | Unsplash developer app Access Key. |
| `TZ` | Your time zone for the schedule, e.g. `America/New_York`. Research runs Mon/Wed/Fri 5:47am and posts default to 7:52am in this zone. |

There is deliberately no `ANTHROPIC_API_KEY`.

## The Mon/Wed/Fri research job

```bash
npm run cron
```

This keeps running and starts research every **Monday, Wednesday and Friday at 5:47am** (your `TZ`), as long as the **Auto-load 10 articles** toggle is on. Scheduled runs only fire while your computer is on and awake, so when `npm run cron` starts it checks whether it missed a run in the last 24 hours and catches up.

A run takes roughly 5–15 minutes and uses your Claude Pro limits. It searches all 10 lanes, reads about 20 articles, scores them, and saves 10 only if the whole batch passes the rules (dates within 30 days, 8 of 10 within 14, at least 5 lanes, no more than 3 per lane, 2–3 evergreen, no repeated stories). If Claude hits your usage limit partway, nothing is saved and the feed tells you when it resets. Research never falls back to Gemini.

**Find new articles** on the feed runs the same job right away and asks for different stories from the ones on screen.

### Start it at login

**macOS (launchd)**

1. Open `scripts/login/com.frank.content-engine.cron.plist`, replace both `APP_FOLDER` with the full path to this folder, and check the `PATH` line includes where `node` lives (`which node`).
2. Copy it into place and load it:

```bash
cp scripts/login/com.frank.content-engine.cron.plist ~/Library/LaunchAgents/
```

```bash
launchctl load ~/Library/LaunchAgents/com.frank.content-engine.cron.plist
```

The log goes to `cron.log` in this folder. To stop it: `launchctl unload ~/Library/LaunchAgents/com.frank.content-engine.cron.plist`.

**Windows (Task Scheduler)**

1. Edit the folder path in `scripts\login\start-cron.cmd`.
2. Open **Task Scheduler → Create Task**. On **Triggers**, add **At log on**. On **Actions**, add **Start a program** and pick `start-cron.cmd`. On **Conditions**, untick "Start the task only if the computer is on AC power".

Tip: also set your computer not to sleep at 5:47am on those days, or rely on the catch-up when it wakes.

## Autopilot

Off by default. It only runs when you turn it on **and** your suggested-pick rate is at least 85% over your last 30 picks. Then, after each Mon/Wed/Fri batch, it takes the top-scored unused article, writes angles and versions, uses the suggested version with hook 1, and lints it. If it passes every check it's scheduled in Typefully for the next open Mon/Wed/Fri at 7:52am. If it fails any check, it's banked in Drafts instead and nothing posts. Autopilot posts are marked and don't count toward your pick rate.

## How writing works

Every writing call sends `FRANK_VOICE.md` **in full**, plus the playbook, the newest trend formats and your newest 5 banked drafts marked "Learn from this". Edit your voice in `FRANK_VOICE.md` (the app shows it read-only on the Playbook tab); edit the rules in the Playbook tab.

Each version is checked before you see it. Warnings show under the text and never block you:
starts with "I" · emoji or link · banned phrase (from the playbook or the voice guide) · outside 1,000–1,500 characters · doesn't end with a question · "honestly" more than once · a number that isn't in the article's facts.

`**bold**` lead-ins are converted to Unicode bold letters before anything goes to Typefully or the clipboard, since LinkedIn doesn't render markdown.

## Typefully safety

- **Test with a draft first:** use **Save as Typefully draft** on your first post, check it in Typefully (text, bold lead-ins, photo), then delete it there before using **Schedule**.
- If Typefully times out or errors, the app does **not** retry. Check your Typefully queue before trying again so you don't double-post.
- Calendar edits sync to Typefully; deleting a post here deletes its Typefully draft too (unless it already posted).

## Photos

- **Unsplash:** the engine suggests literal visual searches (no faces, logos or politicians), shows landscape, safe results, and credits "Photo by … on Unsplash" with referral links. Using a photo triggers Unsplash's download endpoint, as their guidelines require.
- **Your own:** JPEG, PNG, WebP or HEIC up to 20 MB. HEIC is converted to JPEG. Files are stored in `uploads/`.
- Photos from the old artifact (`/_blob/…`) can't be loaded here; they show as a text card.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | App at localhost:3000 |
| `npm run start` | Production build at localhost:3000 |
| `npm run cron` | Mon/Wed/Fri research (+ autopilot) with catch-up |
| `npm run seed` | Load `seed/seed.json` (safe to repeat) |
| `npm test` | Unit tests |

## Troubleshooting

- **"Claude limit reached, resets at …"** You've used your Pro window (shared with your normal Claude chats). Switch the writer to Gemini on the Generate tab, or wait for the reset. The app never retries in a loop.
- **"Claude Code isn't signed in"** Run `claude` in a terminal and sign in again.
- **Red banner about ANTHROPIC_API_KEY** Remove it from `.env` and your shell profile, then restart.
- **Every run and its turns, duration and model** are logged in the `JobRun` table (`npx prisma studio` to browse).
