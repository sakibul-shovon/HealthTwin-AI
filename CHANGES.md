# HealthTwin AI — Full Redesign & Feature Log

## M1 — Design System Rewrite

**Files changed:** `frontend/app/globals.css`, `frontend/components/VoiceOrb.tsx`, `frontend/components/VerdictCard.tsx`, `frontend/components/VoicePanel.tsx`, `frontend/components/ChatPanel.tsx`, `frontend/components/MemberRail.tsx`, `frontend/components/UploadDropzone.tsx`

### What changed
- Replaced the entire dark cyan/purple glassmorphism theme with a warm paper + petrol-teal + marigold token system
- New CSS custom properties: `--canvas (#F5F1E9)`, `--primary (#0F4C55)`, `--accent (#E2922F)`, `--well/watch/urgent` semantic health colors
- VoiceOrb repaletted: idle/listening/speaking → marigold gradient; thinking → petrol; error → rose
- All neon box-shadows replaced with soft elevation shadows (`--shadow-sm/md/lg`)
- Dot-grid background added to center hero column
- All inline color fixes across VerdictCard, VoicePanel, ChatPanel, MemberRail, UploadDropzone
- Rule: marigold surfaces use dark ink; petrol surfaces use light text

---

## M2 — Unified Hero (Orb inside Constellation)

**Files changed:** `frontend/components/Constellation.tsx` (full rewrite), `frontend/app/page.tsx` (layout restructure)

### What changed
- `Constellation.tsx` — new `centerSlot?: ReactNode` and `hero?: boolean` props
  - VoiceOrb now lives at the absolute center of the constellation
  - Hero sizing: RADIUS=158, NODE_R=32 (vs default 96/26)
  - Travel dot now shoots from orb center → resolved member node on voice command
  - Marigold ripple burst on focused member (#E2922F); rose for emergency
  - Per-member warm gradients: Ma=teal, Baba=calm blue, Self=green, Child=marigold
  - Static hub only renders when no `centerSlot`
- `page.tsx` — layout restructured:
  - **Center column**: Living Twin hero (Constellation+Orb) + status text + VoicePanel below
  - **Right column**: VerdictCard (latest verdict) + ChatPanel (conversation history)
  - Header tagline changed to "Living family health twin"
  - Two pre-existing lint errors fixed (unused `emergencyActive` var, untyped callback)

---

## M3 — Glass-box "Why This Verdict?"

**Files changed:** `backend/app/agents/safety.py`, `frontend/lib/types.ts`, `frontend/components/VerdictCard.tsx` (refactor)

### What changed
- **Backend**: `safety.py` now includes `gate1_trace` in every safety check envelope:
  ```json
  {
    "gate1_trace": {
      "verdict": "UNSAFE",
      "conflicts": [{ "type": "interaction", "detail": "...", "severity": "high", "source": "DrugBank subset" }],
      "checked": { "interactions": true, "contraindications": true, "dose": false, "allergy": true }
    }
  }
  ```
- **Frontend types**: Added `Gate1Conflict`, `Gate1Trace` interfaces; `gate1_trace?` field on `ResponseEnvelope`
- **VerdictCard.tsx** refactored:
  - Inner content extracted into `CardContent` component (needed for `useState`)
  - New `WhyPanel` component: shows Gate 1 checks (✓ Allergies, ✓ Interactions, ✓ Contraindications, ✓ Dose) and each conflict with severity badge, type icon (⇌ interaction, ◈ allergy, ⊘ contraindication, ⊡ dose), full detail text, and source citation
  - "Why this verdict?" toggle button at bottom of card — animated expand/collapse
  - Only shown for SAFE/CAUTION/UNSAFE verdicts

---

## M4 — Proactive Safety Radar + Daily Briefing

**Files changed:** `backend/app/agents/profile.py`, `backend/app/api/voice.py`, `frontend/lib/types.ts`, `frontend/lib/api.ts`, `frontend/app/page.tsx`

### What changed

#### Proactive Safety Radar
- After a medication is **added** via voice confirmation, `profile.py` automatically runs `run_safety_check()` on the newly added drug
- If the result is UNSAFE or CAUTION, a `radar_alert` field is attached to the CONFIRMED response
- Frontend: `handleAction` in `page.tsx` detects `radar_alert`, shows a second "Safety Radar Alert" chat message after 1.2s, updates the verdict card, and speaks the alert
- Example: user says "Add aspirin to Baba" → confirms → gets CONFIRMED + radar fires "aspirin ↔ warfarin → bleeding risk (HIGH)"

#### Daily Family Briefing
- New `GET /voice/briefing` endpoint (no LLM call — pure deterministic)
- Returns: member count, total active medications, per-member watch flags (kidney impairment, liver impairment, allergies), household pattern check result
- Frontend: on every app load, `getBriefing()` is called in parallel with `getHousehold()` and `getChatHistory()` — briefing always appears as the first chat message with an early timestamp

---

## M5 — ⌘K Command Palette

**Files created:** `frontend/components/CommandPalette.tsx`  
**Files changed:** `frontend/app/page.tsx`

### What changed
- New `CommandPalette` component mounted in the app header
- **Trigger**: Ctrl+K (Windows/Linux) or ⌘K (Mac), or click the "⌘K" chip in the header
- **Close**: ESC key or click backdrop
- **Contents**:
  - **Family Members section** — click any member to open their twin profile
  - **Commands section** — 6 demo queries (drug safety, pattern check, overview, Bengali query, symptom logging, Scan Prescription)
  - **Free-form query** — anything typed that doesn't match a command shows "↵ Ask: ..." which sends it as a voice command
- Keyboard navigation: ↑↓ to browse, ↵ to select
- Filters all commands live as you type

---

## M6 — Scan Prescription Hero Flow

**Files changed:** `frontend/components/VoicePanel.tsx`, `frontend/components/UploadDropzone.tsx`, `frontend/app/page.tsx`

### What changed
- `VoicePanel`: new `onScanClick` prop; added "📷 Scan Rx" chip styled in marigold accent — distinct from the other grey chips, makes the upload feature discoverable
- `UploadDropzone`: processing overlay completely redesigned:
  - Camera icon in a rounded card with pulsing orbit ring (marigold)
  - "Reading prescription…" heading + "Extracting medications, doses & conditions" subtext
  - Three animated step indicators: **OCR → Parse → Match** with staggered dot pulses
  - Warm paper background with blur — matches the design system

---

## M7 — Cleanup

**Files deleted:** `backend/app/agents/router.py`, `backend/app/agents/safety_copy.py`  
**Files changed:** `backend/app/agents/safety.py`, `frontend/components/UploadDropzone.tsx`

### What changed
- **`router.py` deleted** — entire legacy keyword-matching router (route() + helpers); replaced by `brain.py` since several commits ago; confirmed imported by nothing
- **`safety_copy.py` deleted** — `get_spoken_verdict()` inlined directly into `safety.py`; no longer needs a separate file
- **`UploadDropzone.tsx` lint fixes** (was blocking `next build`):
  - `useState<any>` → proper `UploadPreview` interface
  - `(m: any, i: number)` map callbacks → typed as `ExtractedMedication`
  - `catch (e)` with unused `e` → optional catch binding `catch { }`
  - Missing `displayName` on `forwardRef` component → `UploadDropzone.displayName = "UploadDropzone"`
  - `handleFile` and `handleDrop` moved into `useCallback` with proper deps
  - `confirmUpload` response typed instead of `any`

---

## Summary Table

| Milestone | Area | Key Deliverable |
|-----------|------|-----------------|
| M1 | Design | Warm paper + petrol-teal + marigold token system; all dark glass removed |
| M2 | Hero | VoiceOrb centered inside Constellation; marigold ripple to resolved member |
| M3 | Trust | Expandable "Why this verdict?" showing Gate 1 rule trace per verdict |
| M4 | Proactive | Radar alert on med add; daily briefing on every app load (no LLM) |
| M5 | Navigation | ⌘K command palette: member select, demo queries, free-form ask |
| M6 | Upload | "📷 Scan Rx" chip; animated OCR→Parse→Match processing overlay |
| M7 | Hygiene | Deleted dead router.py + safety_copy.py; fixed UploadDropzone lint debt |
