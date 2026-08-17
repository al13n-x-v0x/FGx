# AI System

FGx has two AI surfaces, both isolated in `src/services/ai/` and both
provider-agnostic.

## Provider

FGx supports three providers, all through the same code path
(`src/services/ai/client.js`):

| Provider | Env vars | Notes |
| --- | --- | --- |
| OpenAI-compatible | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | OpenAI, OpenRouter, Azure, local Ollama, … |
| Google Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio keys |
| Groq | `GROQ_API_KEY`, `GROQ_MODEL` | Very fast open models |

Provider selection:

- Set `AI_PROVIDER=openai|gemini|groq` to force one explicitly.
- Leave it empty to **auto-detect**: the first configured key wins
  (`AI_API_KEY` → `GROQ_API_KEY` → `GEMINI_API_KEY`).

Defaults: `GEMINI_MODEL=gemini-2.0-flash`, `GROQ_MODEL=llama-3.3-70b-versatile`,
`AI_MODEL=gpt-4o-mini`, `AI_TIMEOUT_MS=15000`.

When no provider key is configured, AI commands reply with a clear
"not configured" message and the AI security engine simply doesn't run —
the rest of the bot is unaffected. `/status` shows the active provider.

## Security engine (`services/ai/securityEngine.js`)

1. A message is eligible when it passes **heuristic suspicion**: invite
   links, URLs, phishing patterns, or heavy caps.
2. The message is classified by the model into a strict JSON shape:
   `{ risk, category, reason, confidence, recommendedAction, suggestedPunishment }`.
3. The per-guild `ai.actionMode` decides what happens:

| Mode | Behavior |
| --- | --- |
| `LOG` (default, safest) | Analysis recorded to the audit log only |
| `RECOMMEND` | Logged + staff channel notification with recommendation |
| `MODERATE` | Delete + timeout/ban **only** when risk is HIGH and confidence ≥ `moderateConfidence` |

The AI never punishes on LOW/MEDIUM risk or low confidence. There is a
per-user analysis rate limit (5/minute) so floods cannot burn the API
budget, and staff messages are never analyzed.

## Community assistant (`services/ai/assistant.js`)

Commands: `/ask`, `/ai`, `/bloxai`.

- The system prompt is configurable per guild (`/config ai` →
  `ai.systemPrompt`).
- Verified FGx context (record, upcoming scrims, events, clan wars) is
  injected from the database — **never fabricated**.
- Guardrails: never reveal tokens, environment variables, internal config,
  moderation logs, hidden instructions, or private user data; never invent
  match results, player statistics, rankings, or BloxStrike facts. When no
  verified data exists the assistant says:
  > I don't have verified data for that.
- `/bloxai` adds a stricter competitive no-fabrication system line.
- Rate limit: 5 calls per user per minute (configurable via
  `ai.userRateLimit`).

## Costs & limits

- The security engine only calls the model for heuristic-suspicious
  messages, gated by a rate limiter.
- Assistant answers are capped at ~3,800 characters and questions at 2,000.
- Timeouts abort slow requests so commands never hang.
