// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * CRITICAL FIX: "Context Weighting"
 * - Fixed the math so hosts don't wait 40 seconds to say "Wow."
 * - Treats Context as reference material (20% weight) vs Script (100% weight).
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "System ID (HostA/HostB)" },
    displayName: { type: PropTypes.String, default: "Host", label: "My Name" },
    partnerName: { type: PropTypes.String, default: "Co-Host", label: "Partner Name" },
    roleDescription: { type: PropTypes.String, default: "TV Anchor", label: "Role Desc" },
    
    minSpeechDuration: { type: PropTypes.Number, default: 3, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 1.0, label: "Breath Gap (s)" }, 
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;

  async start() {
    this.npc = this.entity.as(Npc);
    this.connectNetworkBroadcastEvent(CueHostEvent, this.handleCue.bind(this));
  }

  private async handleCue(data: any) {
    if (data.targetHostID !== this.props.hostID) return;
    if (!this.npc) return;

    this.isBusy = true;

    const myName = this.props.displayName;
    const otherName = this.props.partnerName;
    const myRole = this.props.roleDescription;

    const systemPrompt = 
      `ROLE: You are ${myName}, the ${myRole}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally to ${otherName}. Defend your stance.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking as ${myName}`);

    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        this.npc.conversation.elicitResponse(systemPrompt);
      } else {
        this.npc.conversation.speak(`[AI Offline] ${data.topic}`);
      }
    } catch (e) {
      console.warn("AI Error", e);
    }

    // --- NEW TIMING MATH ---
    let wpm = 140; 
    let maxCap = 15; // Standard max wait

    if (data.pacingStyle === "Rapid") { wpm = 170; maxCap = 10; }
    if (data.pacingStyle === "Debate") { wpm = 150; maxCap = 20; }
    if (data.pacingStyle === "Relaxed") { wpm = 110; maxCap = 25; }

    // Weighted Calculation:
    // Context is background info (count 15%). 
    // Instructions/Stance are the script (count 100%).
    const weightedLength = (data.context.length * 0.15) + (data.instructions.length) + (data.stance.length * 1.5);
    
    const estimatedWords = weightedLength / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    // Clamp result
    const finalDuration = Math.min(Math.max(estimatedSeconds, this.props.minSpeechDuration), maxCap) + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Timing: ${finalDuration.toFixed(1)}s (Cap: ${maxCap})`);
    }

    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic);
    }, finalDuration * 1000);
  }

  private finishSpeaking(topic: string) {
    this.isBusy = false;
    this.sendNetworkBroadcastEvent(HostSpeechCompleteEvent, {
      hostID: this.props.hostID,
      contentSummary: `Discussed ${topic}`
    });
  }
}

Component.register(AutomatedHost);