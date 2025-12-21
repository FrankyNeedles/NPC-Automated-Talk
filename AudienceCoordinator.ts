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
  private currentMeeting: string | null = null; // One meeting at a time

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
        `You are Jamie, the Studio Coordinator.
         Your job is to chat with players and help them pitch TV Show ideas.
         If a player says "Pitch: [Idea]", you should say "SUBMITTING: [Idea]".
         Otherwise, just be friendly and helpful.`;

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

    const playerName = player.name.get();

    // Check if there's already an active meeting
    if (this.currentMeeting && this.currentMeeting !== playerName) {
      this.npc.conversation.speak(`Sorry ${playerName}, I'm currently helping ${this.currentMeeting}. Please wait your turn!`);
      if (this.memory) {
        this.memory.logDeniedPitch(playerName, "Meeting in progress with another player");
      }
      return;
    }

    // Set current meeting
    this.currentMeeting = playerName;

    // 1. Register Participant (Native Mode)
    this.npc.conversation.registerParticipant(player);
    this.activePitchers.push(playerName);

    if (this.memory) {
        this.memory.handlePlayerEntry(player);
        const profile = this.memory.getPlayerProfile(playerName);

        // Optional: Send a hidden context update to the AI about this player
        // "Player Franky has visited 5 times."
    }

    // 2. Initial Greet (Optional - AI might do this auto, but we force it for consistency)
    // We use .speak() for the initial hello so it's instant
    this.npc.conversation.speak(`Hi ${playerName}! Got a show idea? Let's make it great - aim for at least 10 words and keep it positive!`);
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

          // Validate the pitch
          const validation = this.validatePitch(content);
          if (validation.isValid) {
              this.submitPitch(user, content);
          } else {
              // Pitch denied - provide feedback and encouragement
              this.npc?.conversation.speak(`Sorry ${user}, your pitch was denied: ${validation.reason}. Keep trying - great ideas take time!`);
              if (this.memory) {
                  this.memory.logDeniedPitch(user, validation.reason);
              }
          }
      }
  }

  private validatePitch(text: string): { isValid: boolean; reason: string } {
    // Check minimum word count (10 words)
    const words = text.trim().split(/\s+/);
    if (words.length < 10) {
      return { isValid: false, reason: "Pitch must be at least 10 words long" };
    }

    // Check for offensive content (basic filter)
    const offensiveWords = ["offensive", "inappropriate", "hate", "violence", "explicit"]; // Simplified list
    const lowerText = text.toLowerCase();
    for (const word of offensiveWords) {
      if (lowerText.includes(word)) {
        return { isValid: false, reason: "Pitch contains inappropriate content" };
      }
    }

    return { isValid: true, reason: "" };
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