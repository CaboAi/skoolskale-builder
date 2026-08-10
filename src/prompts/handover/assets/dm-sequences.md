# Skoot DM Sequences — framework (deliverable 07)

Automated in-app Skool DMs, set up on **Skoot**. Merge tags `#NAME#` / `#GROUPNAME#`. Tone = the creator talking one-to-one, warm and real, light emoji OK (match DNA). These run the member lifecycle: onboard, upgrade, recover failed payments, save cancels.

Generate the flows that the DNA's tier structure implies. For each paid tier in `tiers[]`, and for the free tier if it exists.

## Flows to produce

### 1. WELCOME — per paid tier
2–3 DMs, spaced. Job: get them to (a) add the live calls to calendar, (b) start the Classroom, (c) know what the next tier unlocks (for non-top tiers).
- DM1 (Day 0): welcome + "add the calls to your calendar" (name real `calls[]`) + one clear first action.
- DM2 (Day ~2): "get into the Classroom" — name real `modules[]` / Start Here; where to ask questions.
- DM3 (Day ~4, only if a higher tier exists): what the higher tier unlocks + how to upgrade (Skool: profile → group Settings → Change Plan). Lead annual if annual pricing exists.

### 2. FREE-TIER NURTURE (if free entry exists)
5–7 DMs over ~3 weeks. Job: deliver a little real value, be honest that the live calls + core systems live in the paid tiers, invite up without being pushy. Each ends with the upgrade path. Rotate angles: welcome/lay-of-the-land, relate-to-the-struggle, a genuine free value drop, "the honest gap" (what free doesn't include), a live-call story, the serious-builder tier, honest close. (Mirror the 7-DM Standard sequence in the gold example.)

### 3. DECLINED CARD — per paid tier
2–3 DMs over the retry window. Job: recover the payment without shaming.
- DM1: "your payment didn't go through — happens all the time (expired card, bank hold). Update anytime; we'll retry over the next [[N]] days."
- DM2: gentle follow-up naming what they'll lose access to (the real tier benefits) if it doesn't clear.
- DM3 (optional, final): last heads-up before access is removed.

### 4. CANCELLATION — per paid tier
3 DMs. Tone = raw, honest, personal, NOT guilt-trip (this is what makes it convert). Job: reframe what they're really walking away from (the room / live current info / the calls — not the content library), offer the real off-ramp.
- DM1: personal "saw you cancelled" — the content is the smallest part; what you lose is [the live edge / the room]. If a cheaper paid tier or free tier exists, offer to keep them there.
- DM2: name the specific things gone the moment it processes (real calls, vault, tier perks). "The ones who make it don't make it alone."
- DM3: one honest question + "the door is open" close. Warmer sign-off.
(If refund policy is "cancel any time," lean into the easy-return framing.)

## Rules
- Use `#NAME#` / `#GROUPNAME#`. Anchor DM tone to the DNA `Welcome DM`.
- Reference REAL calls, modules, tiers, prices, upgrade steps — no generics.
- Free-tier nurture and cancellation must NOT over-DM (the gold example flags that too many DMs on the free tier "pissed people off") — keep spacing sane and value-first.
- Upgrade instructions (Skool): `profile settings → Settings on the <group> → Change Plan → select <tier>`.
- No fabricated results/testimonials in DMs.

Reference: `templates/example-dm-sequences.md` (Nuno/Automated Marketer — full set: Premium welcome ×3, VIP welcome ×2, declined ×2/tier, cancellation ×3/tier, Standard/free nurture ×7).

## Output shape
```
# <Community> — Skoot DM Sequences
## Welcome — <Tier A>
**DM 1 (Day 0)** …
## Welcome — <Tier B> …
## Free-Tier Nurture …
## Declined Card — <Tier> …
## Cancellation — <Tier> …
```
Group by flow, then tier. Label each DM with its send timing.
