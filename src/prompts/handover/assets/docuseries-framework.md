# 2-Part Docuseries — framework (deliverables 05 talking-points + 06 full script)

The backbone of the whole launch. A **two-episode cinematic YouTube series**, documentary-style, direct-to-camera (style ref: Iman Gadzhi — high production, story-driven, calm authority, no "hey guys," no hype). It is not a webinar and not an ad; it is an emotional arc.

- **Episode 1 = the PROBLEM.** Make the viewer feel deeply understood, then feel the full cost of staying where they are. End by breadcrumbing the solution so they return.
- **Episode 2 = the SOLUTION, and the solution IS the community (Skool).** Briefly re-affirm the problem, then spend the bulk (≥20 min) positioning + pitching the community. By the time the offer lands, the viewer has already decided.

**Launch mechanic:** a **FOUNDING MEMBER window** opens the launch — joiners come in at the founding rate and are grandfathered permanently; price rises after it closes. The window length is **set per launch, anywhere from the first 72 hours up to one month** (a longer window buys a longer post-launch email runway; a 72h window is maximum urgency). This is the urgency engine (see voice-and-guardrails.md).

**Tone:** host is the guide who lived the story and has seen the pattern a hundred times. Authority from recognition, not bragging. Ep1 slow and heavy; Ep2 builds momentum and lifts into the offer.

> Note on single vs two episodes: some creators run it as ONE ~40-min film (the Meister talking-points do this). Default to **two episodes**; if the DNA/creator signals a single sitting, collapse the same arc into one file. Keep the arc identical either way.

## Launch format variants (same arc, different delivery)
The Problem→Solution arc is the constant. The delivery format flexes to the creator:
- **(A) YouTube 2-episode docuseries** — the default. Solo, direct-to-camera. (Meister, David, Brian.)
- **(B) Multi-guest panel series** — a multi-day event where the host carries Ep1 (the foundation/problem) and guest interviews carry the middle days, with the pitch landing at the end. Guest experts each share ONE practice; the host's channel is the hub. Fits communities with `guest_sessions: Yes` and a roster of aligned experts. (HCC "2026 Divide" — 7 days, Kyle & Leah + guests.) See the HCC example in `templates/example-docuseries-framework.md` and the guest emails in `templates/example-pre-launch-guest-emails.md`.
- **(C) 2-day LIVE event hosted inside Skool** — Day 1 = the problem (live), Day 2 = the solution + the pitch (live), often tied to a real calendar moment (a solstice, a full moon, a launch weekend). The community IS the offer; the live sessions run the same arc. The pitch is a repeatable "Sell the Community + FAQ + go-annual-hard" block run at the end of each session. (Sianna "Summer Solstice" → ALCHEMY: Soul Sanctuary.) See `templates/example-docuseries-talking-points.md` (Sianna) and `templates/example-docuseries-framework.md` (worked example).

Pick the variant from the DNA: solo creator → A; guest roster + `guest_sessions: Yes` → offer B; a live/ceremony/event cadence in the Calendar → offer C. When unclear, default to A and note the others as options.

## THE ARC (section by section)

### EPISODE 1 — THE PROBLEM
1. **Cold Open** — drop straight into a specific, lived-in scene from the viewer's day. First sentence hits a nerve. No intro/logo. Title card after.
2. **Authority** — creator lived this and found the way out; pattern-recognition ("I've seen this over and over"), 1–2 concrete proof points. `[[CREATOR STORY]]`.
3. **Identify the Problem** — name the audience's pains one at a time so they feel seen. End on a pattern-interrupt: the real problem isn't what they think — it's the model/system itself.
4. **Deepen the Problem** — the heaviest, slowest section, the core of Ep1. Emotional beats, hidden costs, the 12-month trajectory if nothing changes. Build urgency. Do not rush.
5. **Breadcrumb the Solution** — hint at the way out without revealing it. The full answer comes in Episode 2 — the reason to come back.

### EPISODE 2 — THE SOLUTION (THE SKOOL PITCH)
6. **Re-affirm the Problem** — restate Ep1's pain in under 1–2 min to re-anchor.
7. **Reveal the Solution** — the paradigm shift, stated simply. The turning point; should feel like a revelation. Position the new model/mechanism (tie to `transformation`) as the answer.
8. **The Results** — paint the life on the other side vividly (what it feels like, not a benefit list). Anchor with `[[PROOF: real DM/screenshot/student result]]`.
9. **Pitch the Community (Skool)** — the bulk of Ep2. Walk what's inside using the **real** `modules[]`, `calls[]`, guest sessions, `levels[]` perks. Why it's the vehicle. Who it's for. Stack value. Push serious people to the premium tier.
10. **The Offer + Founding-Member Rate** — pricing from `tiers[]` once, lead annual, the 72-hour mechanic. `[[FOUNDER RATE ENDS: date/time]]`.
11. **Call to Action + Close** — direct to the link, handle the one obvious hesitation, close with conviction. One next step: join.

## ⛔ TALKING-POINTS MODE IS RETIRED
Do not generate a bullet/talking-point version of the script. Creators found it redundant: it duplicates the full script in a weaker form, and they read from the script anyway. **Ship the word-for-word script only.**

**There is no file 05 at all.** Not talking points, not a run-of-show. The script is the deliverable. When a launch needs day-of context — the piece is pre-recorded, it replays on day two, someone drops the join link in chat — put it in a short header block at the top of 06, not in a separate document. Anything schedule-shaped (what sends when, what happens on the day) belongs in the 00-README timeline.

<details><summary>Retired — talking-points spec, kept for reference only</summary>

## MODE 05 — TALKING POINTS (retired)
Per-section **bullets**, each a prompt the creator expands in their own voice — NOT lines to read verbatim, except a few quoted hooks/offer/close lines they may want to land word-for-word (wrap those in quotes).
- Add a **time budget** per section (e.g. `≈ 3 min`). Two-episode: budget each episode; single-film: budget to ~40 min total.
- Open with a "How to use" note (hit points in order, expand in own voice, `[brackets]` = drop in your real story/numbers).
- Keep sensitive specifics high-level (health/finance per guardrails).
- This mode mirrors `templates/example-docuseries-talking-points.md` (Meister) — match that density and discipline.

</details>

## MODE 06 — FULL SCRIPT (word-for-word) — the only script deliverable
Expand the SAME arc into first-person, read-aloud prose the creator can deliver or teleprompt.
- One idea per line; short paragraphs; natural spoken rhythm (not written-essay rhythm).
- Keep `[[PLACEHOLDERS]]` inline for story/proof/dates — do not fabricate around them.
- Mark stage directions in brackets on their own line: `[Title card drops. Hold a beat.]`, `[Screen: community walkthrough]`.
- The Ep2 "Announce the community" + offer + CTA is the most important passage — write it tightest. (See the Reality Revolution announce sample in `templates/example-docuseries-framework.md` for the verbatim register; the sustained first-person delivery in `templates/example-vsl-cancellation.md` shows the prose cadence.)

## Output shape
```
06-docuseries-full-script.md      # the word-for-word script — the only docuseries file
```
Note on pre-recorded films: when the launch plays a filmed piece at a live event, say so at the top of 06 (recorded once, replayed on later days) and put the shoot dependencies in the run-of-show checklist. One film, however many live sessions — never write a second script for day two.
Both must name the community's REAL modules, calls, tiers, and levels — never generic placeholders where the DNA has the real thing.
