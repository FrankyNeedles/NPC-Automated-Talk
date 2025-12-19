// AudienceCoordinator.ts
/**
 * AudienceCoordinator.ts
 * The "Front Desk" / Pitch Coach.
 * 
 * FIX: Native Conversation Mode.
 * - Registers player as participant (like Dice NPC).
 * - Uses Native AI Loop for chat (no manual event handling).
 * - Monitors AI output for specific "Command Phrases" to trigger logic.
 */

import { Component, PropTypes, NetworkEvent, Entity, Player, CodeBlockEvents } from 'horizon/core';
import { Npc, NpcConversation, NpcEvents } from 'horizon/npc';
import { SmartNpcMemory } from './SmartNpcMemory';

const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');
const PitchDecisionEvent = new NetworkEvent<{ userId: string; accepted: boolean; reason: string }>('PitchDecisionEvent');

export class AudienceCoordinator extends Component<typeof AudienceCoordinator> {
  static propsDefinition = {
    coordinatorName: { type: PropTypes.String, default: "Jamie", label: "NPC Name" },
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    greetTrigger: { type: PropTypes.Entity, label: "Desk Trigger" },
    reactionDelay: { type: PropTypes.Number, default: 0.8, label: "Reaction Time (s)" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private memory: SmartNpcMemory | undefined;
  
  private playerTimers: Map<number, number> = new Map();
  private activePitchers: string[] = [];

  async start() {
    this.npc = this.entity.as(Npc);
    if (!this.npc) console.error("[Coordinator] Must be on NPC!");

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    // Listen for Decision from Boss
    this.connectNetworkBroadcastEvent(PitchDecisionEvent, this.handleDecision.bind(this));

    // Listen for NPC Output (To detect if a pitch was made)
    // We hook into the conversation to see what the NPC said
    if (this.npc) {
        this.connectNetworkBroadcastEvent(NpcEvents.OnNpcFullResponse, this.handleNpcResponse.bind(this));
    }

    if (this.props.greetTrigger) {
        this.connectCodeBlockEvent(
            this.props.greetTrigger,
            CodeBlockEvents.OnPlayerEnterTrigger,
            this.handleEnter.bind(this)
        );
        this.connectCodeBlockEvent(
            this.props.greetTrigger,
            CodeBlockEvents.OnPlayerExitTrigger,
            this.handleExit.bind(this)
        );
    }
    
    // Set the Persona immediately
    this.setupPersona();
  }

  private async setupPersona() {
      if (!this.npc) return;
      const context =
        `You are Jamie, the friendly Studio Coordinator at a bustling TV network.
         Your role is to engage in natural, flowing, and truthful conversations with players, guiding them through the pitch process to help their ideas get approved.
         Be warm, enthusiastic, and conversational – like chatting with a creative friend at a coffee shop.
         Explain the process clearly: Players pitch ideas, the executive reviews them, and if approved by the boss, the show will start next or soon depending on the lineup.
         Help players refine their pitches by asking thoughtful questions, offering constructive feedback, and encouraging creativity to increase approval chances.
         If a player mentions a pitch or says something like "Pitch: [Idea]", respond naturally by acknowledging it, providing brief feedback, and then say "SUBMITTING: [Idea]" to trigger the process.
         Otherwise, keep the chat light, ask questions to draw out their ideas, share fun anecdotes about TV production, and encourage them to pitch.
         Always be truthful, helpful, and focused on getting their shows approved – you're their advocate in the network!`;

      // Inject context into the NPC brain
      // Note: Actual API for setting context varies, simplified here for clarity
      // Most updated Horizon API uses the Character Builder for this text.
  }

  // --- Proximity Logic (Exact match to Dice NPC) ---

  private handleEnter(player: Player) {
    const pid = player.id;
    if (this.playerTimers.has(pid)) {
        this.async.clearTimeout(this.playerTimers.get(pid)!);
        this.playerTimers.delete(pid);
    }

    const tId = this.async.setTimeout(() => {
        this.activateInteraction(player);
        this.playerTimers.delete(pid);
    }, this.props.reactionDelay * 1000);

    this.playerTimers.set(pid, tId);
  }

  private activateInteraction(player: Player) {
    if (!this.npc) return;
    
    // 1. Register Participant (Native Mode)
    this.npc.conversation.registerParticipant(player);
    this.activePitchers.push(player.name.get());

    if (this.memory) {
        this.memory.handlePlayerEntry(player);
        const profile = this.memory.getPlayerProfile(player.name.get());
        
        // Optional: Send a hidden context update to the AI about this player
        // "Player Franky has visited 5 times."
    }

    // 2. Initial Greet (Optional - AI might do this auto, but we force it for consistency)
    // We use .speak() for the initial hello so it's instant
    this.npc.conversation.speak(`Hi ${player.name.get()}! Got a show idea?`);
  }

  private handleExit(player: Player) {
    if (!this.npc) return;
    
    const pid = player.id;
    const name = player.name.get();

    // Unregister (Native Mode)
    this.npc.conversation.unregisterParticipant(player);
    this.activePitchers = this.activePitchers.filter(n => n !== name);

    if (this.memory) {
        this.memory.handlePlayerExit(name);
    }

    if (this.playerTimers.has(pid)) {
        this.async.clearTimeout(this.playerTimers.get(pid)!);
        this.playerTimers.delete(pid);
    }
  }

  // --- The Logic Hook ---

  /**
   * Called whenever the NPC speaks (Native AI Response).
   * We parse the text to see if the AI decided to submit a pitch.
   */
  private handleNpcResponse(text: string) {
      // The instructions say: Say "SUBMITTING: [Idea]" if the player confirms.
      if (text.includes("SUBMITTING:")) {
          const content = text.split("SUBMITTING:")[1].trim();
          // Find who we are talking to (Simple version: assumed the last active player)
          const user = this.activePitchers.length > 0 ? this.activePitchers[0] : "Player";
          
          this.submitPitch(user, content);
      }
  }

  private submitPitch(user: string, text: string) {
    this.sendNetworkBroadcastEvent(PitchSubmittedEvent, {
        pitchId: Date.now().toString(),
        userId: user,
        text: text,
        timestamp: Date.now()
    });
  }

  private handleDecision(data: { userId: string; accepted: boolean; reason: string }) {
    if (!this.npc) return;
    // Note: We don't check if they are here, because we want the NPC to say it anyway
    // "Oh, Franky left, but his idea got approved!"

    if (data.accepted) {
        this.npc.conversation.speak(`Breaking News! The pitch "${data.reason}" was APPROVED!`);
    } else {
        this.npc.conversation.speak(`Update: The pitch was denied. Reason: ${data.reason}`);
    }
  }
}

Component.register(AudienceCoordinator);