# AI Voice Calling Architecture & Cost Optimization Guide

## Executive Summary
This document defines the complete end-to-end production architecture, tool selection, and total-cost-of-ownership (TCO) model for Career141's **Agent 5 (AI Voice Prescreening System)**. 

To prevent real-world cost overruns and operational failures, this architecture explicitly calculates all **three distinct cost buckets** and details the **regulatory and telecom compliance safeguards** required in Sri Lanka:
1. **Bucket A: AI Intelligence Layer** (Speech-to-Text, Conversational Brain, Text-to-Speech)
2. **Bucket B: Telephony Carrier & Termination** (Local Sri Lankan SIM Gateway vs. International Cloud SIP)
3. **Bucket C: Real-Time Media Orchestration & Server Infrastructure** (WebRTC/RTP streaming, VAD, interruption handling)

---

## 1. True Total Cost of Ownership (TCO) Matrix

The table below compares the complete cost of a **3-minute phone call** to a Sri Lankan candidate (`+94 7X XXX XXXX`) across different architectural options:

| Cost Component (3-Minute Call) | Legacy ElevenLabs + Twilio | Route 1: Modern AI + Cloud SIP (Twilio) | **Route 2: Modern AI + Corporate GSM SIM (RECOMMENDED)** |
| :--- | :--- | :--- | :--- |
| **Monthly Subscription Base Fee** | **$99.00 / month** (forced fee) | **$0.00 / month** (pay-as-you-go) | **$0.00 / month** (pay-as-you-go) |
| **Speech-to-Text (STT / Hearing)** | ElevenLabs Scribe ($0.075) | Deepgram Nova-2 ($0.013) | **Deepgram Nova-2 ($0.013)** |
| **Text-to-Speech (TTS / Voice)** | ElevenLabs Turbo v2.5 ($0.300) | Cartesia Sonic ($0.075) | **Cartesia Sonic ($0.075)** |
| **Conversational LLM (Brain)** | OpenAI GPT-4o-mini ($0.010) | DeepSeek-V3 via OpenRouter ($0.001) | **DeepSeek-V3 via OpenRouter ($0.001)** |
| **Subtotal: AI Intelligence Layer** | **$0.385** | **$0.089** | **$0.089** (~27 LKR) |
| **Telephony Outbound Termination** | **$0.600** ($0.20/min via Twilio) | **$0.600** ($0.20/min via Twilio) | **$0.015** (~1.50 LKR/min via Corporate SIM) |
| **Media Orchestrator & Server Overhead** | $0.030 (Twilio Media Streams) | $0.015 (LiveKit Cloud: $0.005/min) | **$0.008** (Self-hosted on Contabo VPS) |
| 🎯 **TRUE TOTAL COST PER 3-MIN CALL** | **~$1.015 USD (~310 LKR)** | **~$0.704 USD (~215 LKR)** | **~$0.112 USD (~34 LKR)** |
| 💰 **Monthly Total (500 Calls / Month)** | **~$606.50 / month** ($99 base + usage) | **~$352.00 / month** | **~$56.00 / month** |
| 🏆 **Total Monthly Savings** | — | **Saves $254.50 / month (42%)** | **Saves $550.50 / month (91%)** |

---

## 2. The 3 Cost Buckets Explained

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BUCKET A: AI Intelligence Layer (~$0.089 / 3-min call)                                                 │
│ 1. STT: Deepgram Nova-2 ($0.0043/min) ── Real-time streaming transcription with local accent accuracy. │
│ 2. Brain: DeepSeek-V3 ($0.001/call) ── Real-time intent classification, follow-up Q&A, and JSON data.  │
│ 3. TTS: Cartesia Sonic ($0.025/min) ── <90ms ultra-realistic human voice synthesis.                   │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BUCKET B: Telephony & Destination Carrier (Official Dialog Axiata Corporate Quote)                       │
│ - Twilio to Sri Lanka Mobile: ~$0.20 USD/min (~183 LKR per 3-min call). Extremely expensive for volume. │
│ - Dialog Axiata Enterprise SIP Channels (Official Written Quote from Peshala Shehani):                   │
│   * Option 01 (1 Channel): LKR 9,760.00 / month (~$32 USD/mo)                                           │
│   * Option 02 (2 Channels): LKR 10,320.00 / month (~$34 USD/mo) - RECOMMENDED STARTING SCALE                │
│   * Option 03 (5 Channels): LKR 12,090.00 / month (~$40 USD/mo)                                           │
│   * Option 04 (10 Channels): LKR 15,080.00 / month (~$49 USD/mo)                                          │
│ - Outbound Caller ID: Displays verified Sri Lankan corporate mobile number (`077-XXXXXXX`), 85%+ answer.│
└──────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BUCKET C: Media Orchestration & Server Infrastructure (~$0.008 – $0.015 / call)                        │
│ - Manages bidirectional WebRTC audio streams between phone network and AI models.                      │
│ - Handles Voice Activity Detection (VAD) and candidate interruptions in real-time (<50ms).             │
│ - Option 1: LiveKit Cloud ($0.005/min). Zero server maintenance.                                       │
│ - Option 2: Self-hosted LiveKit / FreeSWITCH on existing Contabo VPS ($0 marginal compute cost).      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Critical Operational & Regulatory Risk: SIM Blocking Safeguards

> [!WARNING]
> ### The Anti-Fraud & Robocalling Risk in Sri Lanka
> Local mobile carriers (Dialog Axiata, Mobitel, Airtel, Hutch) operate automated fraud-detection systems.
> If a standard **consumer/retail SIM card** dials dozens of unique numbers consecutively and transmits automated AI voice audio, the carrier's automated firewall will flag the activity as spam/robocalling and **instantly deactivate and blacklist the SIM card**.

### The 3-Step Mitigation Strategy:

1. **Official Corporate Enterprise Agreement**:
   * Do **NOT** use consumer retail prepaid/postpaid SIM cards.
   * Procure a **Dialog Enterprise** or **Mobitel Business** voice package under Career141's business registration (BR).
   * Request an authorized **Automated Outbound Voice Waiver** and a registered **Calling Line Identification (CLIP)** profile.
2. **Multi-SIM Pacing & Rotation**:
   * Distribute outbound calls across all 4 SIM channels on the Dinstar Gateway.
   * Cap each SIM card to **max 40–50 calls per day** with randomized delays between dials to maintain healthy telecom traffic patterns.
3. **Candidate Consent & Opt-In Filtering**:
   * Only trigger AI prescreening calls for candidates who have applied to a job or provided active consent on the portal, preventing unsolicited telecom complaints.

---

## 4. Which Tool to Use for Which Purpose

### 🎯 Layer 1: Speech-to-Text (STT / Hearing) ──► **Deepgram Nova-2**
* **Purpose**: Converts candidate voice audio into text transcripts in real-time.
* **Why Deepgram Nova-2**:
  1. **Accents**: Specially tuned for South Asian / Sri Lankan English speech. Accurately handles local terms (*"Lakhs"*, *"LKR"*, *"months notice"*, Sri Lankan names).
  2. **Streaming Latency**: Delivers interim transcription packets in <150ms.
  3. **Noise Cancellation**: Strips out background traffic and mobile cellular distortion.
* **Cost**: `$0.0043 per minute` (billed to the exact second).

---

### 🎯 Layer 2: Conversational Intelligence (Brain) ──► **DeepSeek-V3 (via OpenRouter)**
* **Purpose**: Evaluates candidate answers, dynamically asks follow-up questions for missing details (Salary, Notice Period, CV), and extracts structured data.
* **Why DeepSeek-V3**:
  1. **Time-to-First-Token**: Starts generating words in under 200ms.
  2. **Dual Execution**: Simultaneously converses with candidate while extracting clean JSON values (`expectedSalary`, `noticePeriodDays`, `currentSalary`).
  3. **Cost**: `$0.14 / 1M input tokens`, `$0.28 / 1M output tokens` (~$0.001 per call).

---

### 🎯 Layer 3: Text-to-Speech (TTS / Voice) ──► **Cartesia Sonic**
* **Purpose**: Converts the AI recruiter's text responses into crystal-clear, emotional, human-like voice audio.
* **Why Cartesia Sonic**:
  1. **Zero Base Subscription**: Pure pay-as-you-go (unlike ElevenLabs $99/mo fee).
  2. **<90ms Ultra-Low Latency**: Industry-fastest time-to-first-audio chunk, completely eliminating awkward pauses.
  3. **Human Realism**: Includes realistic breathing, natural pacing, and professional recruiter tone.
* **Cost**: `$0.038 / 1,000 characters` (~$0.025 per minute of speech).

---

### 🎯 Layer 4: Telephony Termination ──► **Hardware GSM Gateway (Dinstar 4-Port with Corporate SIMs)**
* **Purpose**: Dials the candidate's mobile SIM card and carries the live cellular telephone call.
* **Why Local GSM Gateway**:
  1. **Avoids the "Twilio Trap"**: Twilio charges ~$0.20 USD/min to Sri Lanka ($0.60/call). A corporate SIM card on Dialog/Mobitel charges ~1.50 LKR/min ($0.005/min = $0.015/call).
  2. **Answer Rates**: Candidates recognize local `07X` numbers and answer 85%+ of calls (compared to <30% for international or unknown virtual numbers).
* **Hardware**: Dinstar UC2000-VE 4-Port GSM Gateway (~$180 one-time hardware investment, amortized to zero over time).

---

### 🎯 Layer 5: Real-Time Media Orchestrator ──► **LiveKit (Self-Hosted on Contabo VPS)**
* **Purpose**: Coordinates audio buffering, RTP streaming, Voice Activity Detection (VAD), and candidate interruption handling.
* **Why LiveKit**:
  1. Open-source, battle-tested WebRTC media server.
  2. Runs seamlessly on the Contabo Linux VPS inside a lightweight Docker container.
  3. Uses standard Silero VAD to immediately mute AI speech the instant the candidate begins speaking.
* **Cost**: Included in existing Contabo VPS hosting.

---

## 5. End-to-End Call Lifecycle Flow

```
1. TRIGGER:
   Candidate reaches Stage 4 ("ai_call") or Recruiter clicks "Trigger AI Call".
   │
2. DIAL OUTBOUND:
   LiveKit SIP bridge instructs Dinstar GSM Gateway to dial candidate (+94 7X XXX XXXX).
   Candidate picks up: "Hello?"
   │
3. REAL-TIME TRANSCRIPTION:
   Deepgram Nova-2 streams audio -> text in 120ms: "Hello?"
   │
4. CONVERSATIONAL BRAIN:
   DeepSeek-V3 generates conversational response + greeting in 180ms.
   │
5. REAL-TIME VOICE SYNTHESIS:
   Cartesia Sonic streams audio chunks in 90ms. Candidate hears natural recruiter voice:
   "Hi Kasun, this is Sarah from Career141 calling regarding your Senior Developer application..."
   │
6. BIDIRECTIONAL Q&A LOOP:
   - Validates candidate interest in job role.
   - Collects Current Salary, Expected Salary, and Notice Period.
   - Handles interruptions (if candidate speaks, AI stops immediately).
   │
7. POST-CALL PIPELINE AUTOMATION:
   - DeepSeek compiles structured JSON payload.
   - Convex DB patches candidate profile with exact salary and notice period.
   - Application auto-advances to "second_shortlist" (or flags for review).
```

---

## 6. The Verdict & Final Recommendations

* **If using Twilio**: Monthly cost will exceed **$350/month** due to heavy international carrier termination rates to Sri Lanka ($0.20/min).
* **If using Corporate GSM SIMs (Dialog / Mobitel Enterprise)**: Total cost drops to **~$56/month** for 500 calls, delivering a **91% overall cost reduction** while ensuring complete regulatory and operational compliance with zero SIM-blocking risks.
