// StreamerNpc.ts
/**
 * StreamerNpc.ts
 * The Actor component (Revised for Horizon NPC System).
 * 
 * Responsibilities:
 * 1. Listen for 'StreamerPromptEvent'.
 * 2. Use the 'Npc' component to generate and speak the text (like OracleNPC).
 * 3. Signal the Brain when finished so the stream continues.
 */

import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { Npc, NpcPlayer, NpcConversation } from 'horizon/npc'; 

// Event coming IN from the Brain
const StreamerPromptEvent = new NetworkEvent<{ prompt: string; meta?: any }>('StreamerPromptEvent');

// Event going OUT to the Brain (Signaling we are done)
const StreamerSpeechCompleteEvent = new NetworkEvent<{ timestamp: number }>('StreamerSpeechCompleteEvent');

class StreamerNpc extends Component<typeof StreamerNpc> {
  static propsDefinition = {
    // We don't need voiceProfile anymore, the Npc component handles it.
    debugMode: { type: PropTypes.Boolean, default: false },
    // Since we can't easily detect exactly when the AI stops talking, 
    // we use a "Busy Time" estimate to keep the Autopilot pacing correct.
    estimatedSpeechDuration: { type: PropTypes.Number, default: 15 } 
  };

  private npc: Npc | undefined;
  private npcPlayer: NpcPlayer | undefined;
  private isBusy: boolean = false;

  async start() {
    // 1. Get the Npc Component (Must be attached to the same object)
    this.npc = this.entity.as(Npc);
    
    if (this.npc) {
        try {
            // 2. Get the Body Controller (for looking at players)
            this.npcPlayer = await this.npc.tryGetPlayer();
            if (this.props.debugMode) console.log("[StreamerNpc] NPC Player controller acquired.");
        } catch (e) {
            console.error("[StreamerNpc] Failed to get NPC Player controller:", e);
        }
    } else {
        console.error("[StreamerNpc] CRITICAL: No 'Npc' component found on this entity!");
    }

    // 3. Listen for instructions from the Brain
    this.connectNetworkBroadcastEvent(StreamerPromptEvent, this.handlePrompt.bind(this));
  }

  private async handlePrompt(data: { prompt: string; meta?: any }) {
    if (this.isBusy) return;
    if (!this.npc) return;

    this.isBusy = true;
    const { prompt, meta } = data;

    // Check availability (like in OracleNPC)
    const aiAvailable = await NpcConversation.isAiAvailable();
    if (!aiAvailable) {
        if (this.props.debugMode) console.warn("[StreamerNpc] AI unavailable. Skipping beat.");
        this.finishSpeaking(); // Skip immediately so autopilot doesn't hang
        return;
    }

    try {
        // A. Handle "Look At" (if it's a reply to a specific user)
        if (this.npcPlayer && meta && meta.user) {
            const player = this.findPlayerByNameOrId(meta.user);
            if (player) {
                // Look at them
                this.npcPlayer.addAttentionTarget(player);
                // Let the AI know this person is part of the convo
                this.npc.conversation.registerParticipant(player);

                // Stop staring after a few seconds
                this.async.setTimeout(() => {
                    if (this.npcPlayer && player) this.npcPlayer.removeAttentionTarget(player);
                }, 8000);
            }
        }

        // B. Send Prompt to NPC AI
        if (this.props.debugMode) console.log(`[StreamerNpc] Prompting AI: ${prompt.substring(0, 50)}...`);
        
        // This causes the NPC to generate text AND speak it with lip sync
        this.npc.conversation.elicitResponse(prompt);

        // C. Wait and Notify Autopilot
        // Since elicitResponse is fire-and-forget, we wait a set time before telling the Brain to continue.
        // This ensures the Streamer finishes talking before the next topic starts.
        this.async.setTimeout(() => {
            this.finishSpeaking();
        }, this.props.estimatedSpeechDuration * 1000);

    } catch (e) {
        console.error(`[StreamerNpc] Error during interaction: ${e}`);
        this.finishSpeaking(); // Reset on error
    }
  }

  private finishSpeaking() {
    this.isBusy = false;
    this.sendNetworkBroadcastEvent(StreamerSpeechCompleteEvent, { timestamp: Date.now() });
    if (this.props.debugMode) console.log('[StreamerNpc] Cycle complete. Signal sent to Brain.');
  }

  /**
   * Helper to find a player object so we can look at them
   */
  private findPlayerByNameOrId(identifier: string): Player | undefined {
    const w = this.world as any;
    const players = (w.getPlayers ? w.getPlayers() : w.players) as Player[];
    if (!players) return undefined;

    return players.find(p => 
        String(p.id) === identifier || 
        (p.name && p.name.get() === identifier)
    );
  }
}

Component.register(StreamerNpc);