# HealthTwin AI — World-Class Demo Video Plan (English)

> **Hackathon:** SciBlitz AI Challenge 2026 — IEEE Student Branch, CUET
> **Track:** Track A — Health & Society
> **Video length:** 3–5 minutes (target: 5:00)
> **Submission deadline:** July 8, 2026

---

## Project Intelligence Summary

### What HealthTwin AI Is

Samantha is an AI-first family health guardian built for Bangladeshi households. The demo family is the **Rahman Family** — four members:

| Member | Age | Key Profile |
|--------|-----|-------------|
| Baba (Rahman Sr.) | 68M | Hypertension, Atrial Fibrillation · Warfarin 5mg + Amlodipine 5mg · **Kidney impaired** |
| Ma (Mrs. Rahman) | 61F | Type 2 Diabetes · Metformin 500mg · **Penicillin allergy** · fever logged |
| Self (Rafiq) | 34M | Healthy · caretaker role |
| Child (Ayaan) | 8M | 25 kg · fever logged within 2h of Ma |

### Hidden Technical Depth

| Capability | What it actually does |
|------------|----------------------|
| 3-Gate Safety Spine | Gate 1 = deterministic rules (no LLM). Gate 2 = RAG medical KB retrieval. Gate 3 = NLI entailment |
| Brain Agent | LLM tool-calling — 8 tools, never invents patient data |
| Model Fallback Chain | llama-3.3-70b → gpt-oss-120b → llama-4-scout → llama-3.1-8b |
| Triage Agent | Red-flag scan fires BEFORE the LLM. Zero-latency emergency detection |
| Pattern Agent | Cross-member symptom clusters + dengue season awareness |
| Vision LLM | Llama 4 Scout reads prescription photos — real OCR, not filename guessing |
| Bilingual NLU | Bengali + English, full pipeline both ways |
| Report Agent | 6 report types with LLM-enhanced summaries |

---

## Judging Criteria Mapping

| Criterion | Weight | Strategy |
|-----------|--------|----------|
| Innovation & Originality | 25% | Lead with the 3-gate spine. No student team has deterministic-first AI safety. |
| Technical Implementation | 25% | Show Gate 1 rule trace live. Show fallback chain. Show vision LLM. |
| Real-world Impact | 20% | Dengue cluster, Bengali NLU, prescription photo — all Bangladesh-specific. |
| Demo Quality | 20% | Pre-seeded data, deterministic flow, zero dependency on API luck. |
| Presentation | 10% | Script is written for 5 minutes at conversational pace. |

---

## Complete 5-Minute Timeline

---

### SEGMENT 1 — THE HOOK (0:00–0:12)

**Duration:** 12 seconds
**Purpose:** Stop the judge from mentally moving on. Anchor the problem emotionally.

**Visuals:**
- Black screen
- White text fades in: *"In Bangladesh, most families manage medications with memory and guesswork."*
- 1-second pause, then: *"What if your family had a doctor in their pocket — at 3 AM, in Bengali, for free?"*
- HealthTwin logo fades in. Voice: *"This is Samantha."*

**Narration:**
> *"In Bangladesh, most families manage medications with memory and guesswork. HealthTwin changes that."*

**Music:** Single held piano note — slightly mysterious. No upbeat intro.

**Why it works:** Judges watching their 30th project in a row will stop because this hook names a real problem immediately. Curiosity before explanation.

---

### SEGMENT 2 — PRODUCT REVEAL: THE CONSTELLATION (0:12–0:45)

**Duration:** 33 seconds
**Purpose:** Orient the judge. Show the product is polished and AI-first from the first frame.

**Visuals:**
- Home page loads. The family constellation animates in — each node appears with a spring animation.
- Risk bands visible on each node (color-coded dots).
- Insight Feed shows a **pulsing HIGH severity alert**: *"Fever cluster — Ma + Ayaan within 24h"*
- Click "Hear briefing" button. Samantha speaks:
  *"Good morning, Rafiq. 7 active medications. Watch: Baba has kidney impairment — avoid NSAIDs. Ma and Ayaan both have fever. Possible dengue cluster."*

**Narration:**
> *"This is your household at a glance. HealthTwin builds a living digital twin of each family member — their conditions, medications, allergies, risk flags. The AI is already watching. This morning, it flagged a fever cluster and a high-risk medication situation — before you asked a single question."*

**Text overlays:** `Rahman Family · 4 members · 7 medications` | `AI is watching · 2 HIGH alerts`

**Music:** Shifts to soft ambient electronic — forward momentum.

**Why it works:** The constellation is visually unique. The voice briefing within the first 30 seconds separates this from every other screen recording. "AI is already watching" scores Innovation.

---

### SEGMENT 3 — WOW MOMENT #1: DRUG SAFETY CHECK (0:45–1:30)

**Duration:** 45 seconds. **The centerpiece of the technical demo.**
**Purpose:** Show the 3-gate spine, explainability, real data grounding.

**Flow:**
1. Navigate to Conversations tab.
2. Type: **"Can I give Baba ibuprofen?"**
3. Slow down recording — show each orb state:
   - **Idle** → marigold warm glow
   - **Thinking** → petrol dashed ring spinning
   - **Verdict** → **UNSAFE** card appears with red glow entrance animation
4. Zoom slightly toward the verdict badge.
5. Click **"Why this verdict?"** — Gate 1 trace expands:
   - `✓ Allergies — Checked`
   - `✓ Interactions — Checked: ibuprofen ↔ warfarin → bleeding risk (HIGH severity)`
   - `✓ Contraindications — Checked: NSAIDs contraindicated with kidney impairment`
6. Evidence bar: `Source: DrugBank subset | Confidence: HIGH | 100%`

**Narration:**
> *"Watch what happens when you ask about medication safety. HealthTwin doesn't ask ChatGPT. It runs a 3-gate safety spine. Gate 1 is fully deterministic — no LLM involved. It checks Baba's actual profile: his Warfarin prescription, his kidney impairment. Ibuprofen is flagged UNSAFE. Two independent reasons: a dangerous interaction with Warfarin, and a direct contraindication for impaired kidneys. Every verdict is fully explainable — click 'Why this verdict?' and the rule trace expands. This is medical-grade AI safety, not chatbot guessing."*

**Visual enhancements:**
- Slow-motion zoom when UNSAFE card appears (105% scale over 0.3s)
- Gate 1 chips animate in with stagger
- Evidence bar highlighted when showing HIGH confidence

**Music:** Brief tension swell when typing; resolves when verdict appears.

**Why it works:** Judges see (1) real patient data used, (2) deterministic logic — no hallucination, (3) full explainability. No other student team has this. Dominates Innovation + Technical scores.

---

### SEGMENT 4 — WOW MOMENT #2: EMERGENCY DETECTION (1:30–1:55)

**Duration:** 25 seconds
**Purpose:** Highest-stakes AI capability. HealthTwin is safety-critical infrastructure, not a wellness app.

**Flow:**
1. Still in Conversations. Type: **"Baba says he's having chest pain"**
2. Immediate full-screen red emergency mode:
   - Pulsing red border (opacity 0.3→0.8 loop)
   - Large red `!` circle
   - Header: `CHEST PAIN` in bold uppercase
   - `Baba` chip in red
3. Critical card appears:
   - Age: 68 | Blood Group
   - Conditions: Hypertension, Atrial Fibrillation
   - Medications: Warfarin 5mg, Amlodipine 5mg
   - Caregiver: Ma
4. One-tap button: `📞 Call 999`

**Narration:**
> *"Emergency keyword detection runs before the LLM — zero latency. Baba's full critical card surfaces instantly: his blood group, the medications the ER needs to know about, his heart condition, his caregiver. One tap calls emergency services. This is designed to be used in a real crisis, not a demo."*

**Visual enhancement:** Record in a dimmed room. The pulsing border must be visible clearly.

**Music:** Soft alarm tone for 1 second, then complete silence. The silence is more powerful.

**Why it works:** Emotional stakes. Judges think of their own family. "Zero latency — no LLM" scores Technical Implementation because it shows the team understood what cannot have latency.

---

### SEGMENT 5 — WOW MOMENT #3: THE DENGUE CLUSTER (1:55–2:30)

**Duration:** 35 seconds
**Purpose:** Multi-patient AI reasoning and Bangladesh-specific intelligence. Real-world Impact moment.

**Flow:**
1. Dismiss emergency mode. Back to Conversations.
2. Click **"Ask AI"** on the pulsing HIGH insight feed card (already visible).
3. CAUTION verdict card: **"Possible Fever Cluster"**
4. Conflict row: `Fever in Ma + Ayaan within 24h`
5. Member chips: `Ma` `Ayaan`
6. Detail: *"Both have fever within 24 hours. During dengue season, this may indicate a cluster — consider testing both."*
7. Pan to source citation: `WHO dengue guidance | Confidence: HIGH`

**Narration:**
> *"The Pattern Agent monitors all household members simultaneously. It detected that both Ma and Ayaan logged fever symptoms within 24 hours of each other. In Bangladesh's dengue season, that's a potential outbreak signal — not just two isolated illnesses. HealthTwin is grounded in local health context, not just generic AI. The source is cited: WHO dengue guidance."*

**Text overlay:** `Bangladesh Dengue Season — Active Flag`

**Music:** Returns from silence — measured, thoughtful tone.

**Why it works:** This is the "local relevance" moment targeting Track A criteria. Judges know dengue is real in Bangladesh. WHO citation shows trustworthiness.

---

### SEGMENT 6 — WOW MOMENT #4: BENGALI VOICE (2:30–3:00)

**Duration:** 30 seconds
**Purpose:** Bilingual AI. The accessibility and impact differentiator.

**Flow:**
1. Click the **`EN`** toggle → changes to `বাং`
2. Activate microphone. Orb enters **Listening state** (bright marigold pulse ring).
3. Speak or type: `মায়ের ওষুধ কী কী?` (What are Ma's medications?)
4. Orb: idle → listening → thinking → speaking
5. Bengali response appears. TTS reads it aloud in Bengali.
6. Intent badge visible: `re: Ma`

**Narration:**
> *"HealthTwin speaks Bengali. Not translation — the entire AI pipeline runs in Bangla. NLU extracts intent and medical entities from spoken Bengali, queries the real family records, and responds in Bengali with TTS. In a country where English isn't the language of family health conversations, this isn't a feature — it's a requirement."*

**Music:** Warm, culturally resonant undertone.

**Why it works:** In a Bangladesh hackathon judged by Bengali speakers, this is uniquely impactful. "Not translation — the entire pipeline" is accurate and impressive.

---

### SEGMENT 7 — WOW MOMENT #5: VISION AI DOCUMENT SCAN (3:00–3:35)

**Duration:** 35 seconds
**Purpose:** Multimodal AI. Physical-to-digital health records bridge.

**Flow:**
1. Navigate to **Records** page.
2. Drop a prescription image onto the upload zone.
3. "Extracting with vision AI…" loading state.
4. Extracted data appears:
   ```
   Medications: Losartan 50mg
   Conditions: Hypertension
   Doctor: Dr. Ahmed
   Date: 2026-07-01
   ```
5. "Apply to Ma's profile?" → click Confirm.

**Narration:**
> *"Most families in Bangladesh keep prescriptions on paper. HealthTwin closes that gap. Photograph any prescription or lab report — Llama 4 Scout, a vision language model, reads it like a doctor would. Medications, doses, conditions, lab values are extracted and normalized. One confirm tap and they're in the family graph. Paper becomes AI-searchable structured data."*

**Visual enhancement:** Split screen — raw prescription image on left, extracted data appearing on right.

**Music:** Satisfying click effect when data appears.

**Why it works:** Multimodal AI impresses technically. The use case is extremely practical for Bangladesh where paper prescriptions are universal.

---

### SEGMENT 8 — THE ARCHITECTURE REVEAL (3:35–4:10)

**Duration:** 35 seconds
**Purpose:** Show technical depth in compressed form. Give judges the "aha — this is sophisticated" moment.

**Visuals — Architecture Diagram:**
```
User Voice / Text
        ↓
   Red-flag Scan (deterministic — fires before LLM)
        ↓
   Brain Agent  (LLM tool-calling — 8 tools)
        ├── check_drug_safety  → Gate 1 Rules → Gate 2 RAG → Verdict card
        ├── assess_symptoms    → Triage Agent → Urgency classification
        ├── check_household_patterns → Pattern Agent → Cluster / Hereditary
        ├── search_medical_info      → RAG KB → Grounded answer
        └── prepare_*          → Confirmation flow → DB write
        ↓
   Compose envelope → TTS → Frontend verdict card
```

**Stack chips:**
- Backend: `FastAPI · SQLAlchemy · Groq · pgvector`
- Frontend: `Next.js 14 · Framer Motion · TypeScript`
- LLM Fallback: `llama-3.3-70b → gpt-oss-120b → llama-4-scout → llama-3.1-8b`

**Narration:**
> *"Under the hood: every voice command first passes a deterministic red-flag scanner. The Brain Agent, a tool-calling LLM, decides which of 8 specialized tools to invoke. Drug safety runs Gate 1 deterministic rules, then Gate 2 RAG retrieval against a medical knowledge base. The LLM never invents patient data — it reads real records through tools. If the primary model hits its rate limit, the system rolls to the next in a 4-model fallback chain. This is production-grade AI architecture, not a GPT wrapper."*

**Text overlays:** `4 AI Agents` · `3-Gate Safety Spine` · `4-Model Fallback Chain` · `Bilingual EN + BN`

**Music:** Builds slightly — confident, forward momentum.

**Why it works:** Judges scoring Technical Implementation now have specific things to write down. "Not a GPT wrapper" directly addresses the most common dismissal of student AI projects.

---

### SEGMENT 9 — REPORT GENERATION (4:10–4:35)

**Duration:** 25 seconds
**Purpose:** Show tangible output utility.

**Flow:**
1. Navigate to **Reports** page.
2. Select "Emergency Summary" for Baba. Click Generate.
3. Report renders:
   ```
   🚨 Baba — Emergency Medical Summary
   ⚠️ For emergency responders — show this card to the treating doctor.

   Name: Rahman Sr. (Baba) | Age: 68 | Sex: M
   Current medications: Warfarin 5mg, Amlodipine 5mg
   Allergies: None
   Conditions: Hypertension, Atrial Fibrillation
   Flags: Kidney impaired
   Caregiver: Ma
   ```
4. Briefly show Monthly Report — AI summary paragraph appearing.

**Narration:**
> *"HealthTwin generates six types of structured health reports — from emergency medical cards to monthly family summaries. The emergency card is designed to be shown to an ER doctor — everything they need in one printable card."*

**Why it works:** Reports are concrete, tangible outputs. The emergency card is especially evocative — judges picture an actual emergency scenario.

---

### SEGMENT 10 — CLOSING IMPACT (4:35–5:00)

**Duration:** 25 seconds
**Purpose:** Leave a final emotional impression.

**Visuals:**
- Return to Home constellation — all four nodes glowing softly.
- Slow zoom out.
- Text overlays fade in:
  - `4 AI Agents`
  - `Real medical records. Real safety rules.`
  - `Bilingual. Voice-first. Works in a crisis.`
  - `HealthTwin — Your family's AI health guardian.`
- Live URL appears. Logo holds for 3 seconds.

**Narration:**
> *"HealthTwin is not a chatbot about health. It is an AI guardian for your family — monitoring, protecting, and explaining. Because in Bangladesh, millions of families make medication decisions without a doctor in the room. Now they don't have to."*

**Music:** Swell to fullness, then soft fade out.

---

## Shot List

| # | Content | Duration | Type |
|---|---------|----------|------|
| 1 | Black screen text hook | 12s | Motion graphic |
| 2 | Home page constellation animating in | 10s | Screen recording |
| 3 | Insight feed with pulsing HIGH alert | 5s | Screen recording + zoom |
| 4 | Samantha briefing voice playing | 8s | Screen recording |
| 5 | Navigate to Conversations | 2s | Screen recording |
| 6 | Type "Can I give Baba ibuprofen?" | 5s | Screen recording |
| 7 | Orb states: idle → thinking → verdict | 10s | Screen recording — slight slow motion |
| 8 | UNSAFE verdict card appearing | 8s | Screen recording — cinematic zoom |
| 9 | "Why this verdict?" Gate 1 trace expanding | 10s | Screen recording + stagger animation |
| 10 | Type "Baba has chest pain" | 3s | Screen recording |
| 11 | Emergency mode full-screen (pulsing border) | 10s | Screen recording |
| 12 | Critical card: medications / allergies / caregiver | 8s | Screen recording — slow pan down |
| 13 | Return to chat, click "Ask AI" on insight feed | 5s | Screen recording |
| 14 | Fever Cluster verdict card with member chips | 10s | Screen recording |
| 15 | Bengali toggle + voice/type in Bengali | 15s | Screen recording |
| 16 | Bengali TTS response playing | 8s | Screen recording |
| 17 | Records page — drop prescription image | 12s | Screen recording |
| 18 | Extracted medications/conditions appearing | 8s | Screen recording — split screen |
| 19 | Architecture diagram animated | 20s | Motion graphic / slide |
| 20 | Reports page — emergency summary renders | 15s | Screen recording |
| 21 | Closing constellation + text overlays + URL | 25s | Screen recording + motion graphics |

---

## Wow Moments Catalog

### WOW #1 — UNSAFE Drug Verdict + Rule Trace (0:45)
- **Why impressive:** Deterministic safety logic, not hallucination. Real patient data — Warfarin + kidney impairment.
- **Presentation:** Slow-motion zoom when red UNSAFE card appears. Pause on each Gate 1 chip as it appears.
- **Cinematic emphasis:** YES — zoom + pause
- **Voice interaction:** NO — typed text is cleaner for technical impact

### WOW #2 — Emergency Mode Full-Screen (1:30)
- **Why impressive:** Shows system handles real crises. Zero-latency before LLM is a genuine technical claim.
- **Presentation:** Let the instant transformation happen at full speed — the speed IS the wow.
- **Cinematic emphasis:** The pulsing border does the work — no extra effects needed
- **Voice interaction:** OPTIONAL — saying "Baba has chest pain" into mic adds drama

### WOW #3 — Dengue Cluster (1:55)
- **Why impressive:** Cross-patient AI reasoning. Bangladesh-specific public health context.
- **Presentation:** Show `Ma + Ayaan` member chips clearly. Pan to WHO source citation.
- **Cinematic emphasis:** Slow pan down the verdict card

### WOW #4 — Bengali Voice (2:30)
- **Why impressive:** Fully bilingual AI pipeline — not a translation wrapper.
- **Presentation:** Show orb states clearly during voice input. Listening state ring is visually beautiful.
- **Cinematic emphasis:** Zoom on orb during listening state
- **Voice interaction:** YES — this segment must use actual mic input

### WOW #5 — Vision LLM Prescription Read (3:00)
- **Why impressive:** Multimodal AI + bridges the paper-prescription reality.
- **Presentation:** Split screen — photo left, extracted data right.
- **Cinematic emphasis:** "Snap" transition when data appears

### HIDDEN WOW — Brain Agent Tool-Calling (throughout)
- **Why impressive:** LLM never invents data — calls tools to get real DB records. Architecturally sophisticated.
- **When to mention:** Architecture segment — name it explicitly or judges won't realize it.

---

## Transition Plan

| From → To | Transition | Note |
|-----------|------------|------|
| Text hook → Home page | Hard cut | Snap signals "the product is here" |
| Home → Conversations | Native navigation click | |
| Drug safety → Emergency | Hard cut after verdict | Urgency requires no fade |
| Emergency → Conversations | Slow fade 0.5s | Decompress after intensity |
| Conversations → Records | Navigation click | |
| Records → Architecture diagram | Fade to slide | Mode switch: product → tech |
| Architecture → Reports | Fade slide → product | |
| Reports → Closing constellation | Gentle zoom out | |

---

## Judge Psychology — Why This Order Works

1. **Hook first** — 3 seconds to establish "worth watching." Text hook is faster to absorb than a product screenshot.
2. **Briefing voice at 0:12** — Playing Samantha's voice within 30 seconds signals voice-first product. Most teams type. This product speaks.
3. **UNSAFE verdict at 0:45** — Strongest technical moment placed while judges are fully attentive. Do not bury it at minute 3.
4. **Emergency at 1:30** — After "highest-stakes safety check" comes "literally life-or-death." Emotional intensity escalates correctly.
5. **Dengue at 1:55** — Scope expands: individual safety → household AI. Local relevance at the right time.
6. **Bengali at 2:30** — By now judges understand the product. Bengali feels like "wait, it does that too?" not a confusing first impression.
7. **Vision LLM at 3:00** — Shifts to "AI reads physical documents." New dimension, no repetition.
8. **Architecture at 3:35** — Show value first, then explain how. Curious judges will absorb the diagram.
9. **Reports at 4:10** — Concrete tangible outputs. Product earns its place in a real family's life.
10. **Emotional close at 4:35** — End on mission, not features. The last 10 seconds are what judges remember.

---

## Common Mistakes to Avoid

1. **Do NOT show login/signup.** Start logged in, household pre-loaded.
2. **Do NOT show the family member editor.** Pure CRUD — kills momentum. Seed data handles this.
3. **Do NOT apologize** for loading times, limitations, or "this is just a demo."
4. **Do NOT start with "Hi my name is..."** Open on the product immediately.
5. **Do NOT show an error or spinner.** Test the exact flow 10 times. Groq fallback chain handles rate limits — test it.
6. **Do NOT show the code.** Architecture diagrams only.
7. **Do NOT over-explain the stack.** Judges don't want "React frontend with FastAPI backend."
8. **Do NOT use generic upbeat background music.** It signals student project.
9. **Do NOT have more than 2 seconds of dead air.** Speed up the recording 1.5× during API wait if needed.
10. **Do NOT skip the Bengali demo.** This is a Bangladesh hackathon — Bengali speakers may be judging.
11. **Do NOT mention limitations** in the video. Save that for the report.
12. **Do NOT show Groq API errors.** Pre-test everything; use cached/seeded data for reliability.

---

## Pre-Recording Checklist

**Data setup:**
- [ ] Run `seed_rahman_family()` fresh — ensures fever cluster is within `CLUSTER_WINDOW_HOURS`
- [ ] Verify Groq API key is active and llama-3.3-70b is responsive
- [ ] Test: type "Can I give Baba ibuprofen?" → Gate 1 UNSAFE verdict → expand trace
- [ ] Test: type "Baba has chest pain" → emergency mode fires
- [ ] Test: Bengali query `মায়ের ওষুধ কী কী?` → Bengali response
- [ ] Prepare a clear prescription image (printed or hand-written with real drug names)
- [ ] Test vision extraction on the prescription image
- [ ] Verify Pattern Agent fires: "Check household patterns" → Fever Cluster
- [ ] Verify daily briefing voice plays on Home page

**Recording setup:**
- [ ] Browser zoom at 100% · Resolution 1920×1080
- [ ] Browser bookmarks bar hidden · Clean profile
- [ ] System notifications off (Focus Assist)
- [ ] OBS or Loom at 60fps minimum
- [ ] System audio captured for TTS Bengali voice demo
- [ ] Mouse cursor hidden or using keyboard shortcuts where possible

---

## Final Score Impact Summary

| What you show | Score area it wins |
|---------------|-------------------|
| Gate 1 rule trace expanding | Innovation + Technical |
| 4-model fallback chain mentioned | Technical |
| Bengali full-pipeline (not translation) | Real-world Impact + Innovation |
| Zero-latency emergency before LLM | Technical |
| WHO dengue guidance citation | Real-world Impact |
| Vision LLM prescription read | Innovation + Technical |
| Confirmation flow (no silent writes) | Technical |
| Pre-seeded clean demo, no errors | Demo Quality |
| Emotional close on mission | Presentation |

---

*HealthTwin AI — SciBlitz AI Challenge 2026 · IEEE Student Branch, CUET*
