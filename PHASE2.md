# Nativa — Phase 2 delivery checklist

_shipped 2026-10-18 · speaking & pronunciation_

| Piece | Status |
|---|---|
| Voice I/O: record → Whisper STT → AI reply → native TTS | ✅ expo-audio (Expo Go), 30s cap, mic-permission flow |
| Pronunciation scoring: word-level alignment, exact/close/missed chips | ✅ 19/19 engine tests (accents, tashkeel, CJK, extras) |
| Per-scenario key-phrase phrasebook, 10 languages | ✅ `src/data/practice.ts` (45 phrases) |
| Conversation controls: Listen · 🐢 Slow · per-message Translate | ✅ on every tutor bubble |
| Best score per phrase, persisted locally | ✅ `src/lib/speaking.ts` |
| Demo mode: typed practice scores identically, no AI key needed | ✅ |
| tsc · expo lint · expo-doctor 20/20 · npm run build | ✅ all green |
| On-device mic + STT round-trip | ⏳ needs a phone + `EXPO_PUBLIC_AI_API_KEY` in `.env.local` |

**Try it:** Speak tab → pick a scenario → "Say it out loud" cards: 🐢 Slow for the
reference audio, 🎤 Say it (or ✍️ Type) → per-word score card → 🔁 Try again.

Next up: **Phase 3 — Personalization** (see [ROADMAP.md](ROADMAP.md)).
