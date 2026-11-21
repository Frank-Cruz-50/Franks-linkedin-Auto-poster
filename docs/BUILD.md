# Build spec: Supply Chain Content Engine (standalone app)

You are building a personal web app for Frank Cruz. It researches supply chain news, writes LinkedIn posts in his voice, and schedules them in Typefully. A working version already exists as a single-page Claude artifact. Port it to a real app that Frank owns and runs himself.

## Files in this folder

| File | What it is |
|---|---|
| `BUILD.md` | This spec. Follow it. |
| `FRANK_VOICE.md` | Frank's voice guide. **Every writing prompt must include it in full.** Never edit it from code. |
| `reference/original-engine.html` | Source of the current artifact. It is the reference for screens, copy, prompts and behavior. It uses `window.claude.*` APIs (db, sample, mcp, assets) that don't exist outside Claude. Replace each one as described below. |
| `seed/seed.json` | Frank's current data: articles, batches, trends, posts, drafts, playbook, settings. Import it on first run. |

Read all of `reference/original-engine.html` before you write code. When this spec and the reference disagree, this spec wins.

---

## 1. Stack

**Zero extra cost is a hard requirement.** Frank has Claude Pro and Google AI Pro. Don't add any paid API key, paid service or paid hosting.

- **Runs on Frank's own computer.** It's a local app: `npm run start` and open `http://localhost:3000`. Don't plan for cloud hosting, because the AI runs through Frank's signed-in Claude Code on this machine.
- **Next.js (App Router) + TypeScript**, one repo, with server routes for anything that calls AI or uses a key.
- **Database:** SQLite through Prisma (a file in the repo folder).
- **AI, main path: the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), signed in with Frank's Claude Pro plan.** When the SDK or `claude -p` runs on the plan login, it draws from the subscription's usage limits, with no separate bill. **Never set or read `ANTHROPIC_API_KEY`.** If it's set, Claude Code bills the API instead of the plan. Add a startup check that refuses to run AI jobs while `ANTHROPIC_API_KEY` is in the environment, with a clear message. Don't use `--bare` mode, because it skips the plan login. Use the SDK's built-in `WebSearch` and `WebFetch` tools for research, and limit `allowedTools` to just those, with no file-editing or shell tools. Writing calls get no tools.
- **AI, fallback: Gemini CLI in headless mode** (`gemini -p "<prompt>" --output-format json`), signed in with Frank's Google AI Pro account (geminicli.com lists 1,500 requests a day for AI Pro). Use it only when Claude returns a usage-limit error, or when Frank picks "Gemini" from a writer dropdown on the Generate tab. Hide both behind one `ai.write()` / `ai.research()` interface so the rest of the app doesn't care which one ran. Show which model wrote each version.
- **Usage awareness:** Pro limits are shared with Frank's normal Claude chats. Log each run's turns and duration. If Claude reports a limit, show "Claude limit reached, resets at <time>" and offer the Gemini fallback. Never retry in a loop.
- **Scheduling jobs:** a `npm run cron` process using `node-cron` that runs the Mon/Wed/Fri research job. Add a README section on starting it at login (macOS launchd or Windows Task Scheduler). Scheduled runs only fire while the computer is on, so on startup, catch up on any run missed in the last 24 hours.
- **Styling:** plain CSS modules or one global stylesheet. Keep the current design (see section 8). No UI framework needed.
- **Auth:** bind the server to `127.0.0.1` only, so nothing outside the computer can reach it. No password needed.

`.env.example` must list:

```
DATABASE_URL="file:./engine.db"
AI_PRIMARY=claude          # claude | gemini
TYPEFULLY_API_KEY=         # free plan
TYPEFULLY_SOCIAL_SET_ID=365181
UNSPLASH_ACCESS_KEY=       # free developer app
TZ=America/New_York
# Do NOT add ANTHROPIC_API_KEY; the app uses your Claude Pro login.
```

Setup the README must cover: install Claude Code and run `claude` once to sign in with Pro; install Gemini CLI and sign in with the Google AI Pro account; create a free Unsplash developer app; copy the Typefully API key.

Ask Frank which time zone he wants before you finalize the cron times. Use `America/New_York` until he answers.

---

## 2. Data model

Mirror the collections in `seed.json`. Store list fields (stats, photos, versions, carousel, topics, formats) as JSON columns.

- **Batch:** id, createdAt, note, mix `{headline, evergreen}`.
- **Article:** id, batchId, createdAt, tag (`headline` | `evergreen`), topic (lane name), title (the source's own headline), source, date (YYYY-MM-DD published), url, summary, stats[] (each a number with its source in parentheses), why, extra?, trendScore (0–100), trendWhy, trendSource, trendCheckedAt, photos[]?
- **Trend:** id, checkedAt, source, topics[] `{topic, heat, why}`, formats[] `{format, note}`.
- **Post:** id, articleId, articleTitle, articleUrl, source, topic, tag, createdAt, status (`idea` | `planned` | `draft` | `scheduled` | `posted`), angle, versions[] `{key, hooks[5], body}`, photo (idea text), carousel[] `{h, t}`, long `{title, body}`, finalText, chosenVersion, chosenHook, suggestedAtPick, pickedAt, scheduledFor, typefullyId, photoPick, photoAttached, impressions, followersGained, autopilot?
- **Draft:** id, text, learn (bool, default true), status (`banked` | `scheduled`), version, hook, articleId, articleTitle, articleUrl, source, topic, tag, suggestedAtPick, postId, typefullyId, scheduledFor, photo, createdAt, updatedAt.
- **Playbook** (one row): voice, structure, guardrails, hooks, loves, banned, research, updatedAt.
- **Settings** (one row): autoResearch, autopilot, ready85, ready85At, followers, followersAt, searchRequestedAt, searchHandledAt, searchExclude[].

**Seed import:** `npm run seed` loads `seed/seed.json` and is safe to run twice (upsert by id). Some seeded photos have `url: "/_blob/…"`. Those images lived inside the old artifact and won't load. Keep the record, and when an image fails to load, show the text fallback card (the reference already does this).

---

## 3. Screens

Build the same six tabs as the reference, with the same header strip.

**Header strip**
- "Suggested version": Frank's most-picked of the 4 versions over his last 30 manual picks. It appears after 3 picks.
- "Suggested-pick rate, last 30": share of picks where he chose the version that was suggested at the time. There's a meter with an 85% goal marker.
- Toggles: **Auto-load 10 articles** (Mon/Wed/Fri 5:47am) and **Autopilot posting** (only runs once the rate is ≥85% over 30 picks).

1. **Research feed.** The newest batch is open, sorted by trendScore, with older batches collapsed. Each card shows: day numeral, trending rank and score pill, headline/evergreen pill, lane, age (red if older than 30 days), title linked to the source, source, "Why it's trending," summary, stats list, the "why" line, and photos if any. Buttons: **Write from this** and **Find photos**. A headline/evergreen mix bar sits on top. The **Find new articles** button runs research right away (section 4) with a progress state, instead of queuing a request like the artifact did. It passes the current batch's titles as `searchExclude`. Also show a "What's trending" panel from the newest Trend row.
2. **Generate.** Step 1: 3 angles. Step 2: 4 versions × 5 hooks, plus a photo idea and a 6–8 slide carousel outline. Step 3: optional long-form article (800–1,000 words). Step 4: final post editor with a live character count (red outside 1,000–1,500), a bold preview, a photo picker (Unsplash results, the article's photos, or upload your own), a date/time picker defaulting to the next open Mon/Wed/Fri at 7:52am, and actions: **Schedule in Typefully**, **Bank in Drafts**, **Save as Typefully draft**, **Calendar only**, **Copy text**.
3. **Drafts.** Banked finished posts. You can add one by pasting it, edit it, toggle "Learn from this draft," schedule it in Typefully, copy it, or delete it (tap twice to confirm).
4. **Calendar.** Upcoming and posted posts. Edit text and time (syncs to Typefully through edit_draft), Bank in Drafts, Mark posted, and Delete (also deletes the Typefully draft).
5. **Library.** A table of every post with date, first line, version, whether the suggestion was hit, status, and editable **impressions** and **new followers**. A followers-today input and goal meters: **30K by 2028-06-30** and **100K by 2030-12-31**, each showing what's left to go and the weekly pace needed.
6. **Playbook.** Editable textareas for voice, structure, guardrails, hooks, loves, banned and research, with **Save** and **Restore defaults** (defaults = the seeded playbook). Add a read-only **Voice guide** panel that renders `FRANK_VOICE.md`. Note on screen that it's edited in the file, not here.

The whole app must work at phone width: 16px side gutters, no sideways scrolling, tap targets ≥44px.

---

## 4. Research job (Find new articles + Mon/Wed/Fri 5:47am)

Port this logic exactly. It is what the current scheduled task does.

1. Load the playbook, all articles (so no URL or story repeats), `settings.searchExclude` (titles Frank rejected: find *different* stories), the latest trends, and posts that have impressions.
2. Research about **20 candidates** across the **10 lanes** in `playbook.research`, with at least one separate web search per lane. That includes at least one search for the week's biggest national and global news (outages, ground stops, cyberattacks, big storms, strikes, shutdowns), even if supply chain outlets haven't covered it yet. Put the current month in queries. **Fetch each article** and confirm its publish date on the page; skip any article without a date shown. Every pick must be published **within 30 days**, and at least **8 of 10 within 14 days**. Use only numbers read on the page. Stay politically neutral on trade.
3. **Score each candidate 0–100:**
   - 35 points: LinkedIn-wide heat (major outlets like Reuters, AP, CNBC, Bloomberg, WSJ, NYT, CNN, Axios, Fortune, Business Insider; a top general-news story; or a hot topic in the newest trend data)
   - 25 points: breadth (distinct outlets in the last 72 hours)
   - 15 points: velocity
   - 15 points: supply chain and business voices
   - 10 points: Frank's own results (topics near his best impressions; otherwise 5)

   Pick the **top 10** with these limits: at least 5 lanes, no more than 3 from one lane, and 2–3 evergreen. "Evergreen" means a recent report or analysis (still inside 30 days) whose point stays true for months.
4. Save, in one transaction: a Batch (note starts "On request" or "Scheduled", plus one line on what's different), 10 Articles (createdAt increasing by 1s), and a Trend row (top 5 topics plus up to 3 LinkedIn formats taking off, from one search). Then set `searchHandledAt`. Summaries are 2–4 sentences in plain grade-5 English, in your own words; never copy sentences from the articles.

Implementation: run it as one Claude Agent SDK `query()` with only `WebSearch` and `WebFetch` allowed, `maxTurns` capped at about 80, and the existing-URL list plus `searchExclude` in the prompt. It should end by returning the batch as JSON. Validate that JSON with zod before writing to the database. If validation fails, send one follow-up asking it to fix the JSON. It's a long run, so stream the SDK's messages to the Feed button as progress ("Searching 10 lanes…", "Reading articles…", "Scoring…"). If Claude hits its usage limit partway, save nothing and tell Frank when it resets. Don't fall back to Gemini for research, because Gemini CLI's web reading is weaker and the date rules matter.

The old artifact's **"Check LinkedIn trends"** button scraped LinkedIn through Claude's browser. **Don't port it.** Automated LinkedIn scraping breaks LinkedIn's terms. Keep the news-signal trend data from the research job instead.

---

## 5. Writing prompts

Take the angle, versions and long-form prompts word for word from `doAngles`, `doVersions` and `doLong` in the reference. Build the shared system prompt like the reference's `rules()`, plus the voice guide:

```
You ghostwrite LinkedIn posts for Frank Cruz… (opening line from rules())

FRANK'S VOICE GUIDE (follow every rule; run the Final check before returning):
<contents of FRANK_VOICE.md>

VOICE / STRUCTURE / GUARDRAILS / HOOKS / WORDS HE LOVES / NEVER USE: <playbook fields>
FORMATS TAKING OFF ON LINKEDIN NOW: <newest trend formats>
FRANK'S BANKED DRAFTS: <newest 5 drafts where learn=true; study the voice, never copy their facts>
```

Then add the article block (title, source, date, URL, summary, "Facts you may use (only these numbers)", extra).

Writing calls go through `ai.write()`: the Agent SDK with no tools, the system prompt above, and output parsed as JSON. With Gemini, the same prompt goes to `gemini -p` with `--output-format json`.

Rules to enforce in code, not just in prompts:
- Ask for JSON and validate it with zod. If versions come back with fewer than 4, show "came back incomplete, try again."
- **Lint each version** before showing it, and mark failures in the UI (a small warning per rule; don't auto-block): starts with "I"; contains an emoji or a URL; contains any banned phrase from the playbook or FRANK_VOICE.md; total length outside 1,000–1,500; doesn't end with "?"; more than one "honestly"; a number that isn't in the article's stats/extra/summary.
- **Bold conversion:** Typefully and LinkedIn don't render markdown. Before sending, convert `**text**` to Unicode Mathematical Sans-Serif Bold, as the reference's `bold()` does (A–Z from U+1D5D4, a–z from U+1D5EE, 0–9 from U+1D7EC).
- Save the Post row (status `idea`) as soon as versions come back, as the reference's `savePost` does.

---

## 6. Integrations

**Typefully (REST API, v2).** Read the current Typefully API docs and match these calls, which the artifact makes through Typefully's connector today:
- `create_draft(social_set_id, {platforms:{linkedin:{enabled:true, posts:[{text, media_ids?}]}}, draft_title, scratchpad_text, publish_at | plan_at})`. Use `publish_at` to schedule. Use `plan_at` for a draft with a planned time.
- `edit_draft(social_set_id, draft_id, {…same shape…})` and `delete_draft(social_set_id, draft_id)`.
- Media: `create_media_upload(social_set_id, {file_name, alt_text})` returns `{upload_url, media_id}`. PUT the image bytes to `upload_url`, then poll `get_media_status` until ready, about every 1.5s for up to 30s. If the photo fails, still create the post without media, and put photo instructions in `scratchpad_text` like the reference's `photoNote()`.
- Note in the UI: the Typefully free plan allows 10 posts a month.
- On timeouts or 5xx errors, **don't auto-retry create_draft**. Tell Frank to check his Typefully queue first so he doesn't double-post.

**Unsplash.** Use `search/photos` (landscape, content_filter=high, skip premium) and trigger the download endpoint when a photo is used (Unsplash API guidelines require it). Credit "Photo by {name} on Unsplash" with UTM links (`utm_source=supply_chain_content_engine&utm_medium=referral`). Claude suggests 2–3 literal visual queries per article: no faces, logos or politicians.

**Own photos.** Accept uploads up to 20 MB (JPEG/PNG/WebP/HEIC; convert HEIC to JPEG) and store them on local disk (`/uploads`). Keep the storage behind a small interface.

---

## 7. Autopilot

Port the reference's `track()` exactly: last 30 manual picks, suggested = most-picked (ties go to the most recent), rate = hits / picks that had a suggestion. When `rate ≥ 0.85` over 30 picks, set `ready85`. If autopilot is on and `ready85` is true, the Mon/Wed/Fri job may: take the top-scored unused article from the new batch → angles → versions → the suggested version with hook 0 → lint → schedule in Typefully at 7:52am. A post that fails lint is banked as a Draft instead and doesn't post. Mark these posts `autopilot: true` so they don't count as manual picks. Autopilot stays off by default, and nothing posts without Frank unless he turns it on.

---

## 8. Design

Keep the artifact's look: a "station departure board" style. White/black with one signal red (`#e4002b`) and one grey. Archivo font (wide 800 weight for numerals and titles). A thick black top rule, big day numerals hanging in a left column, and a strict left edge. Support dark mode through `prefers-color-scheme`. Copy the CSS variables and component styles from the reference's `<style>` block.

---

## 9. Done means

- `npm install && npm run seed && npm run dev` opens the app on localhost, with Frank's 75 articles, 5 posts and 2 drafts visible.
- With `ANTHROPIC_API_KEY` set, AI jobs refuse to run and explain why. Without it, they run on the Claude Pro login.
- The writer dropdown switches between Claude and Gemini, and each version shows which one wrote it.
- Find new articles produces a valid 10-article batch that meets every rule in section 4. Write a test that validates a batch against those rules (dates, lanes, evergreen count, no repeated URLs).
- Generate produces 4 linted versions that include FRANK_VOICE.md in the prompt. Add a unit test that checks the prompt builder includes the guide.
- Scheduling creates a real Typefully draft with bold text and the photo attached. Test with a draft first, not a live publish.
- Unit tests for `bold()`, `track()`, `nextSlot()` and the post linter.
- A `README.md` covering setup, every env var, how to sign in to Claude Code and Gemini CLI, how to get the free Typefully and Unsplash keys, and how to start the cron process at login.

Work in small commits. Never add a paid service, API key billing or cloud hosting. Ask Frank first if something seems to need one.
