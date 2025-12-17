// README.md
# Streamer NPC (Vortex) System for Horizon Worlds

This project implements a 24/7 autonomous streamer NPC with a Vortex pacing cycle, diegetic chat input, and internal AI-driven dialogue. It uses only Horizon Worlds APIs (no external calls).

## Files
- `StreamerAutopilot.ts` - Brain: Manages Vortex cycle, topics, and chat interrupts.
- `PromptDirector.ts` - Generates detailed prompts from short topics.
- `StreamChatManager.ts` - Displays chat overlay and forwards messages to the brain.
- `ChatInputTerminal.ts` - Diegetic keyboard for players to input chat messages.
- `StreamerNPC.ts` - NPC actor: calls the internal AI, plays speech, handles animations.
- `topics.json` - Example topic list (can be edited manually or via the inspector).
- `INSTALL.md` - Setup and publishing instructions.
- `TEST_PLAN.md` - Testing and QA checklist.
- `EXAMPLES.md` - Sample prompts and NPC outputs.
- `DEBUG_HELPERS.ts` - (Optional) utilities for debugging.

## Architecture
```plaintext
Player input (UI keyboard) -> ChatInputTerminal -> StreamChatManager (overlay) -> StreamerAutopilot (brain) -> PromptDirector -> StreamerPromptEvent -> StreamerNPC (actor)
