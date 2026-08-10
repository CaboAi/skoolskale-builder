# Pre-Launch Email Sequence — framework (deliverable 03)

Purpose: warm the creator's existing list (YouTube subs / email) toward the docuseries **event**, drive them into the free Skool community before it drops, and build anticipation for Episode 1/2. 5–8 emails over ~7–10 days ending the day Episode 1 goes live.

## Sequence arc (default 7 emails)

| # | Timing | Job | Subject energy |
|---|---|---|---|
| 1 | ~Day -9 | "Something big is coming" — tease the event, no details yet. Point to the free community for updates. | curiosity |
| 2 | ~Day -8 | Agitate the core problem — paint the trap the audience is in (mirrors docuseries Ep1). | pain-recognition |
| 3 | ~Day -6 | The dream/after — what life looks like on the other side; hint a new model exists. | aspiration |
| 4 | ~Day -4 | The uncomfortable truth / "why the old way is dying" — reframe; announce the event date `[[EVENT DATE]]`. | provocation |
| 5 | ~Day -2 | "It's almost time" — what the event covers, how to watch (channel + free community). | logistics |
| 6 | ~Day -1 | "2 days out / tomorrow" — final anticipation + exclusive assets waiting in the free community. | countdown |
| 7 | Day 0 | "It's LIVE" — Episode 1 link `[[EPISODE 1 LINK]]`, watch now. | launch |

Scale to 5 (merge 2+3 and 5+6) or 8 (split the truth email) based on how much runway the creator has.

## Rules
- First person, from `creator_first`; sign each.
- Every email drives to ONE place: the free Skool community (`[[SKOOL COMMUNITY LINK]]`) pre-event, the episode link at launch.
- Reuse the docuseries Ep1 problem beats so the emails and the film feel like one story.
- Merge tag: `{{firstName}}` (or `[First Name]`) — consistent within the file.
- Event date, video link, channel = placeholders. Do not invent a date.
- Match voice profile. Concrete scenes > abstractions.

## Conditional: guest-speaker variant (deliverable 03b)

**ASK FIRST — do not infer this from the DNA.** `guest_sessions: Yes` in the DNA means the *community* runs guest sessions after launch. It does NOT mean guests are part of the launch event itself. These are different questions, and generating unwanted guest emails is a recurring defect.

Before writing 03, ask the user plainly:
> "Are any guest speakers part of the launch event itself? If yes, name them — I'll write the emails they send to their own lists. If it's just the creator, I'll skip that section."

Generate the guest-send sequence ONLY on an explicit yes. If the answer is no, or the user doesn't know yet, omit the section entirely and note in the 03 header that the launch is creator-solo. Do not leave a stub or a "guest emails (if applicable)" placeholder section — it reads as unfinished work in the client handover.

When the answer IS yes, generate a short **guest-send** sequence (5 emails) — copy the guest expert sends to THEIR OWN list to promote their appearance in the launch event. Different POV: "I'm speaking at this," first person as the guest, drives to the host's channel/event.

Arc: (1) "I'm speaking at this — here's why I said yes," (2) "why I'm doing this / the divide," (3) "2 days until we go live together," (4) "tomorrow — don't miss this," (5) day-of "I'm going LIVE today." Placeholders: `[[GUEST NAME]]`, `[[EVENT DATE]]`, `[[GUEST INTERVIEW DATE]]`, `[[HOST CHANNEL]]`.

Reference: `templates/example-pre-launch-emails.md` (Nuno, event build-up) and `templates/example-pre-launch-guest-emails.md` (guest variant).

## Output shape
```
# <Community> — Pre-Launch Email Sequence
> Merge tag: {{firstName}} · from <creator_first> · drives to <free community> then episode
### Email #1 — Day -9
**Subject:** …
…
--- (repeat) ---
## (if guest_sessions) Guest-Speaker Emails — sent by the guest to their list
### Guest Email #1 …
```
