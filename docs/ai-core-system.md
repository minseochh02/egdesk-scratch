# EGDesk AI Core System

## Overview

EGDesk's AI Core System is a server-side proxy that lets users access AI features (Gemini, Claude, etc.) without ever managing API keys themselves. You hold the real API keys, route all AI traffic through your own infrastructure, track usage per user, and bill accordingly.

Users just log in and use the app.

---

## Why This Architecture

| Problem | Solution |
|---|---|
| Users can't/won't create API keys | You manage all keys — users never see them |
| Real keys can't live in the Electron app | Keys stay in Google Secret Manager, never in the client |
| You need to monetize AI usage | Track tokens per user in Supabase, charge via Stripe |
| One leaked key kills everyone | Master key is server-side only; users have no key to leak |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EGDesk Electron App                   │
│                                                          │
│  User logs in (Supabase Auth)                           │
│  App makes AI request → sends Supabase JWT              │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (JWT in header)
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Google Cloud Function (Proxy)               │
│                                                          │
│  1. Validate Supabase JWT                               │
│  2. Check user subscription status (Supabase DB)        │
│  3. Check rate limits / token quota                     │
│  4. Fetch real API key from Secret Manager              │
│  5. Forward request to Gemini / Anthropic               │
│  6. Log usage to Supabase (tokens used, cost)           │
│  7. Return response to app                              │
└──────────┬───────────────────────────┬──────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────┐       ┌───────────────────────┐
│  Google Secret   │       │  Gemini / Anthropic   │
│  Manager         │       │  (real API call)      │
│                  │       │                       │
│  GEMINI_API_KEY  │       │  Response returned    │
│  ANTHROPIC_KEY   │       │  to Cloud Function    │
└──────────────────┘       └───────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                      Supabase                            │
│                                                          │
│  users            → auth, subscription tier             │
│  usage_logs       → tokens used, timestamps, model      │
│  billing_summary  → monthly totals per user             │
└──────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Google Cloud Function (AI Proxy)

The single entry point for all AI requests from the app. Handles auth, quota, forwarding, and logging.

**Endpoint:** `POST https://<region>-<project>.cloudfunctions.net/ai-proxy`

**Request from app:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash",
  "messages": [...],
  "stream": true
}
```

**Headers from app:**
```
Authorization: Bearer <supabase_jwt>
```

**What it does:**
1. Verifies the JWT with Supabase
2. Looks up the user's subscription tier in Supabase
3. Checks if they've exceeded their monthly token limit
4. Fetches the real API key from Secret Manager
5. Calls the AI provider
6. Writes token usage to `usage_logs` table
7. Returns the AI response

---

### 2. Google Secret Manager

Stores real API keys. The Cloud Function is the only thing with permission to read them.

**Secrets stored:**
- `GEMINI_API_KEY` — Google Gemini
- `ANTHROPIC_API_KEY` — Claude
- `OPENAI_API_KEY` — OpenAI (if needed)

**Access:** Only the Cloud Function's service account has `Secret Manager Secret Accessor` role. Nothing else can read these values.

---

### 3. Supabase — User & Usage Data

**Tables:**

```sql
-- Subscription tiers and status
CREATE TABLE subscriptions (
  user_id       uuid REFERENCES auth.users PRIMARY KEY,
  tier          text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  status        text NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'past_due'
  token_limit   int  NOT NULL DEFAULT 100000,   -- monthly token cap
  created_at    timestamptz DEFAULT now()
);

-- Per-request usage log
CREATE TABLE usage_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  provider      text NOT NULL,   -- 'gemini' | 'anthropic'
  model         text NOT NULL,
  tokens_in     int  NOT NULL DEFAULT 0,
  tokens_out    int  NOT NULL DEFAULT 0,
  cost_usd      numeric(10,6),
  created_at    timestamptz DEFAULT now()
);

-- Monthly rollup (updated by Cloud Function after each request)
CREATE TABLE billing_summary (
  user_id       uuid REFERENCES auth.users,
  month         date NOT NULL,  -- first day of the month
  tokens_used   int  NOT NULL DEFAULT 0,
  cost_usd      numeric(10,4)  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

---

### 4. Stripe (Billing)

Handles subscription payments. Supabase stores the tier; Stripe handles the actual charging.

**Flow:**
1. User picks a plan in EGDesk → opens Stripe Checkout
2. On successful payment → Stripe webhook updates `subscriptions` table
3. Monthly invoice generated by Stripe
4. On cancellation/failure → webhook sets status to `cancelled` / `past_due`
5. Cloud Function checks `status` on every request — blocks `past_due` users

**Subscription tiers (example):**
| Tier | Monthly Price | Token Limit |
|---|---|---|
| Free | $0 | 100,000 tokens |
| Pro | $19/mo | 2,000,000 tokens |
| Enterprise | $99/mo | Unlimited |

---

## Data Flow: Step by Step

**1. App startup**
- User is already logged in via Supabase Auth
- App has a Supabase JWT (refreshed automatically)

**2. User triggers an AI feature**
- App sends request to Cloud Function URL with JWT in header
- Real API key is NOT stored in the app anywhere

**3. Cloud Function validates**
```
JWT valid?           → no  → 401 Unauthorized
Subscription active? → no  → 402 Payment Required
Under token limit?   → no  → 429 Too Many Requests
```

**4. AI call is made**
- Function fetches real key from Secret Manager
- Calls Gemini / Anthropic
- Streams or returns response to app

**5. Usage is logged**
- Token counts written to `usage_logs`
- `billing_summary` updated (upsert)

---

## Security Model

| Concern | How it's handled |
|---|---|
| Real API keys exposed | Never leave Google Cloud — only Secret Manager + Cloud Function |
| Electron app reverse-engineered | No keys in the binary or local storage |
| JWT token stolen | Short-lived (1 hour), Supabase rotates automatically |
| User shares their session | Only one active session enforced via Supabase |
| User exceeds quota | Checked on every request before any AI call is made |
| Cloud Function URL scraped | All requests require a valid Supabase JWT |

---

## Implementation Plan

### Phase 1 — Core Proxy
- [ ] Set up Google Cloud project
- [ ] Add real API keys to Secret Manager
- [ ] Deploy Cloud Function (validate JWT → call Gemini → return response)
- [ ] Update Electron app to call Cloud Function instead of Gemini directly

### Phase 2 — Usage Tracking
- [ ] Create `usage_logs` and `billing_summary` tables in Supabase
- [ ] Cloud Function logs token usage after each request
- [ ] Add usage dashboard in EGDesk settings

### Phase 3 — Billing
- [ ] Set up Stripe products (Free, Pro, Enterprise)
- [ ] Add Stripe Checkout flow in app
- [ ] Set up Stripe webhook → updates `subscriptions` table
- [ ] Cloud Function enforces tier limits and subscription status

### Phase 4 — Polish
- [ ] Retry logic with exponential backoff in Cloud Function
- [ ] Streaming support (Cloud Function → app)
- [ ] Admin dashboard for usage/billing visibility
- [ ] Alerting when users approach their token limit

---

## What Changes in the Electron App

The app currently calls Gemini directly using a locally stored key. After this change:

**Before:**
```
App → reads key from electron-store → calls Gemini directly
```

**After:**
```
App → reads Supabase JWT (already exists) → calls Cloud Function → gets response
```

The Supabase JWT is already available in the app from the existing auth system. No new credential management needed on the client side.

---

## Environment Variables

**Cloud Function (set via Google Cloud console, not committed to repo):**
```
SUPABASE_URL=https://cbptgzaubhcclkmvkiua.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — NOT the anon key>
```

**Secrets (in Secret Manager, not env vars):**
```
GEMINI_API_KEY
ANTHROPIC_API_KEY
```

**Electron App (no AI keys needed anymore):**
```
SUPABASE_URL       (already exists)
SUPABASE_ANON_KEY  (already exists)
```
