// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * Usage:
 * Attach to an NPC. Set 'hostID' to "HostA" or "HostB".
 * Listens for "CueHostEvent". If the ID matches, it generates speech
 * via Horizon AI, then signals "HostSpeechCompleteEvent" when done.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

// Incoming Cue
const CueHostEvent = new NetworkEvent<{ 
  targetHostID: string; 
  role: string;
  topic: string;
  context: string;
  instructions: string;
  lastSpeakerContext: string;
}>('CueHostEvent');

// Outgoing Signal
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID (A or B)" },
    minSpeechDuration: { type: PropTypes.Number, default: 5 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;

  async start() {
    // 1. Get NPC Component
    this.npc = this.entity.as(Npc);
    if (!this.npc && this.props.debugMode) {
      console.error(`[AutomatedHost] No NPC component found on ${this.props.hostID}`);
    }

    // 2. Listen for Cues
    this.connectNetworkBroadcastEvent(CueHostEvent, this.handleCue.bind(this));
  }

  /**
   * Handle the "Go" signal from the Scheduler
   */
  private async handleCue(data: any) {
    // 1. Check if this cue is for ME
    if (data.targetHostID !== this.props.hostID) return;
    if (!this.npc) return;

    this.isBusy = true;

    // 2. Construct the AI Prompt
    // We combine the role, topic, and context into a strict instruction.
    const systemPrompt = 
      `ROLE: You are the ${data.role} of a TV Broadcast.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `PREVIOUS SPEAKER SAID: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Keep it short (2 sentences max). Respond naturally. Do not repeat the previous speaker, react to them.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Received Cue. Topic: ${data.topic}`);
    }

    // 3. Speak (using Internal AI)
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        // This makes the NPC talk with lip sync
        this.npc.conversation.elicitResponse(systemPrompt);
      } else {
        // Fallback if AI is offline
        this.npc.conversation.speak(`[AI Offline] I assume we are talking about ${data.topic}.`);
      }
    } catch (e) {
      console.warn("AI Error", e);
    }

    // 4. Wait & Signal Completion
    // Since we don't know exactly when the audio ends, we estimate based on a timer.
    // This tells the Scheduler "I'm done, cue the next person."
    const speechTime = (this.props.minSpeechDuration + Math.random() * 3) * 1000;
    
    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic);
    }, speechTime);
  }

  private finishSpeaking(topic: string) {
    this.isBusy = false;
    
    // We send a summary so the memory knows what we talked about
    // (In a real system, we'd capture the actual AI text, but here we just confirm the topic)
    this.sendNetworkBroadcastEvent(HostSpeechCompleteEvent, {
      hostID: this.props.hostID,
      contentSummary: `Discussed ${topic}`
    });
  }
}

Component.register(AutomatedHost);