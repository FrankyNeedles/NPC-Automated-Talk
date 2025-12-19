// AudienceCoordinator.ts
/**
 * AudienceCoordinator.ts
 * The "Studio Concierge".
 * 
 * UPGRADE: "Natural Conversation"
 * - Converses with players in the lobby.
 * - Helps refine ideas before submitting.
 * - No longer treats players like data entry clerks.
 */

import { Component, PropTypes, NetworkEvent, Entity, Player, CodeBlockEvents } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { SmartNpcMemory } from './SmartNpcMemory';

const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');
const PitchDecisionEvent = new NetworkEvent<{ userId: string; accepted: boolean; reason: string }>('PitchDecisionEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

export class AudienceCoordinator extends Component<typeof AudienceCoordinator> {
  static propsDefinition = {
    coordinatorName: { type: PropTypes.String, default: "Jamie", label: "NPC Name" },
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    greetTrigger: { type: PropTypes.Entity, label: "Lobby Trigger" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private memory: SmartNpcMemory | undefined;
  
  // Track players in the lobby to know who to talk to
  private playersInZone: string[] = [];
  // Track conversation state: Is the player brainstorming?
  private playerStates: Map<string, string> = new Map(); // "Chatting" | "Pitching"

  async start() {
    this.npc = this.entity.as(Npc);
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    // Listen for Chat (To converse)
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handlePlayerChat.bind(this));
    // Listen for Decisions (To inform)
    this.connectNetworkBroadcastEvent(PitchDecisionEvent, this.handleDecision.bind(this));

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
  }

  // --- Zone Logic ---

  private handleEnter(player: Player) {
    const name = player.name.get();
    if (!this.playersInZone.includes(name)) {
        this.playersInZone.push(name);
        this.playerStates.set(name, "Chatting");
        
        // Friendly Greet (No "Type Here" demands)
        this.npc?.conversation.speak(`Hey ${name}! Welcome to the studio. Enjoying the show?`);
    }
  }

  private handleExit(player: Player) {
    const name = player.name.get();
    this.playersInZone = this.playersInZone.filter(n => n !== name);
    this.playerStates.delete(name);
  }

  // --- Conversation Logic ---

  private async handlePlayerChat(data: { user: string; text: string }) {
    // Only reply if player is standing near me
    if (!this.playersInZone.includes(data.user)) return;
    if (!this.npc) return;

    const currentState = this.playerStates.get(data.user) || "Chatting";

    // AI BRAIN for the Coordinator
    const prompt = 
        `ACT AS: Jamie, a friendly TV Studio Page.\n` +
        `USER: ${data.user}.\n` +
        `USER SAID: "${data.text}"\n` +
        `CURRENT STATE: ${currentState}.\n` +
        `GOAL: Chat casually. If they suggest a show topic, ask if they want to pitch it to the producer.\n` +
        `IF PITCHING: If they say "Yes" to pitching, output: [SUBMIT_PITCH].\n` +
        `OUTPUT: Natural dialogue reply.`;

    try {
        const aiAvailable = await NpcConversation.isAiAvailable();
        if (aiAvailable) {
            const response = await this.npc.conversation.elicitResponse(prompt);
            const text = typeof response === 'string' ? response : (response as any).text;

            // Check for AI Command
            if (text.includes("[SUBMIT_PITCH]")) {
                // Submit the PREVIOUS idea (simplified logic for now, we just submit the current text)
                this.submitPitch(data.user, data.text);
                this.npc.conversation.speak(`On it! Sending that idea to the control room right now.`);
            } else {
                // Just chat
                this.npc.conversation.speak(text);
            }
        }
    } catch (e) {
        this.npc.conversation.speak("Haha, yeah! The show is wild today.");
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
    // Only speak if player is still here
    if (!this.playersInZone.includes(data.userId)) return;

    if (data.accepted) {
        this.npc.conversation.speak(`Updates, ${data.userId}! The producer LOVED your idea. It's airing next!`);
    } else {
        this.npc.conversation.speak(`Hey ${data.userId}, bad news. Producer passed. They said: "${data.reason}". Maybe try a different angle?`);
    }
  }
}

Component.register(AudienceCoordinator);