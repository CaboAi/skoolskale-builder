# Voice & Guardrails — apply to EVERY deliverable

This is the safety + quality layer. It overrides framework instructions where they conflict.

## 1. Voice profile (derive once, reuse everywhere)

Read `tone_raw`, `transformation`, `niche`, `First Post`, and `Welcome DM`. The DNA's own writing IS the voice reference — match its rhythm, sentence length, and punctuation energy. Then set knobs:

| Tone signal | Knobs |
|---|---|
| bold / no-nonsense (e.g. Meister) | short declaratives, imperatives, some sentence fragments, zero hedging, confront the reader. No emojis in body copy except where DNA uses them. |
| warm / nurturing (e.g. Laura) | first person, spacious, sensory, "witness/held/sacred" register, gentle CTAs |
| spiritual / mindset (e.g. Reality Revolution) | identity + belief language, "embody vs know", vivid future-pacing |
| professional / business (e.g. Nuno) | plain-spoken, concrete numbers, problem→system framing, light emoji in DMs only |

Never blend into generic hype. When unsure, err toward the DNA's own cadence.

## 2. No fabrication — the placeholder rule (hard)

The machine writes STRUCTURE and PERSUASION. It must NOT invent facts. Anything the creator alone can supply becomes a clearly marked placeholder in **double brackets**:

- `[[CREATOR STORY: the moment you hit rock bottom — be specific, honest]]`
- `[[REAL NUMBER: years in the space / students served]]`
- `[[PROOF: a real DM, screenshot, or student result — no fabrication]]`
- `[[EVENT DATE]]`, `[[EPISODE 1 LINK]]`, `[[EPISODE 2 LINK]]`, `[[FOUNDER RATE ENDS: date/time]]`
- `[[TESTIMONIAL: real member quote]]`

Rules:
- NEVER fabricate statistics, earnings numbers, testimonials, client names, or specific results. (Honors CLAUDE.md CDF-3.)
- NEVER invent the creator's biography. Use `[[CREATOR STORY: …]]` with a prompt for what belongs there.
- Every placeholder emitted must also be listed in the handover `00-README.md` checklist.
- Pricing, module names, call times, tier perks, refund/trial terms come straight from the DNA — those are NOT placeholders.

## 3. Merge tags (match the platform)

- Skool DMs / in-app: `#NAME#` and `#GROUPNAME#` (as in the DNA Welcome DM).
- Email platforms: `[First Name]` or `{{firstName}}` — pick ONE per email deliverable and stay consistent within that file (default `{{firstName}}`).
- Never leave a raw "Hey ," — always a merge tag.

## 4. Founding-member / urgency mechanic (real, not manufactured)

When annual pricing exists, the launch urgency engine is the **founding-member window**:
> During the founding window, anyone who joins comes in as a FOUNDING MEMBER at the founding (launch) rate and is grandfathered in — they keep that rate for as long as they stay. After the window closes, the price rises for everyone after them.

The window length is **set per launch — anywhere from the first 72 hours up to one month** (72h = max urgency; a multi-week window ties to a real event like a challenge start or full moon and gives the post-launch emails room to run). Use `[[FOUNDER RATE ENDS: date/time]]` rather than hard-coding "72 hours" unless the creator confirms a 72h window. Anchoring the close to a real event date (a challenge kickoff, a livestream, a ceremony) is stronger than an arbitrary countdown.

- State it once, confidently, per asset. Don't repeat the mechanic five times in one script.
- Lead annual where annual pricing exists ("lock the founder rate").
- Do NOT invent fake countdowns, fake member counts, or "only 3 spots left" unless the creator sets a real cap → use `[[FOUNDER RATE ENDS: date/time]]`.
- Post-launch emails may reference a real price increase ONLY if the DNA/creator confirms one; otherwise frame as founding-window closing → `[[PRICE INCREASE DATE]]`.

## 5. Domain caution (health / finance / legal)

- **Health/fitness (e.g. Meister):** keep medications/peptides/supplements HIGH-LEVEL. Never state doses, sources, protocols, or "cures." Point serious specifics to "a qualified doctor + your bloodwork." No body-shaming; frame around "feeling like yourself," not vanity.
- **Money/business:** no income guarantees or "you will make $X" claims. Aspirational framing + `[[PROOF]]` placeholders only. Add a soft disclaimer line in the About-Us/VSL where earnings are implied: "Results vary; nothing here is a guarantee."
- **Spiritual/mindset:** no medical or financial promises dressed as manifestation.
- Respect the stated **refund/trial** terms exactly — don't imply a guarantee the community doesn't offer.

## 6. Anti-slop (make it not read like AI)

- No "In today's fast-paced world," "Let's dive in," "Unlock/Unleash/Elevate/Supercharge," "game-changer," "It's not just X, it's Y" ladders, or three-adjective stacks.
- Vary sentence length. Use the creator's actual nouns (module names, call names, level names) instead of generic ones.
- Prefer concrete scenes over abstractions (the Meister "11:47 at night, phone an inch from your face" beat > "many people struggle with motivation").
- One idea per line in scripts meant to be read aloud.

## 7. Language
Default English. If Mario requests Spanish (his bilingual default), regenerate the same assets in ES preserving merge tags and placeholders — do not machine-translate line-by-line, rewrite natively in the same voice.
