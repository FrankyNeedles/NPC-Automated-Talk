// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent" (NPC Actor).
 * 
 * FINAL UPGRADE: 
 * 1. Self-identifies as "Alex" (HostA) or "Casey" (HostB).
 * 2. Reads 'Pacing Style' to adjust speech duration timers dynamically.
 * 3. Prevents overlap with a robust word-count estimator.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID (HostA/HostB)" },
    minSpeechDuration: { type: PropTypes.Number, default: 4, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 2.5, label: "Safety Gap (s)" }, 
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;

  async start() {
    this.npc = this.entity.as(Npc);
    this.connectNetworkBroadcastEvent(CueHostEvent, this.handleCue.bind(this));
  }

  private async handleCue(data: any) {
    // 1. Check ID
    if (data.targetHostID !== this.props.hostID) return;
    if (!this.npc) return;

    this.isBusy = true;

    // 2. Resolve Identities
    const myName = this.props.hostID === "HostA" ? "Alex (Lead Anchor)" : "Casey (Co-Host)";
    const otherName = this.props.hostID === "HostA" ? "Casey" : "Alex";

    // 3. Build the Performance Prompt
    const systemPrompt = 
      `ROLE: You are ${myName} for ATS News.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally to ${otherName}. Do not repeat them; react to them. Broadcast quality grammar.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking as ${myName}...`);

    // 4. Speak
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        this.npc.conversation.elicitResponse(systemPrompt);
      } else {
        this.npc.conversation.speak(`[AI Offline] Moving on to ${data.topic}.`);
      }
    } catch (e) {
      console.warn("AI Error", e);
    }

    // 5. SMART TIMING ENGINE
    // We calculate how long to wait based on the Pacing Style.
    // "Rapid" = We assume they talk fast (180 WPM).
    // "Relaxed" = We assume they talk slow (110 WPM).
    
    let wpm = 140; // Casual Default
    if (data.instructions.includes("Rapid")) wpm = 180;
    if (data.instructions.includes("Debate")) wpm = 160;
    if (data.instructions.includes("Relaxed")) wpm = 110;

    // Estimate Word Count (Chars / 5)
    const contextLength = data.context.length + data.instructions.length;
    const estimatedWords = contextLength / 5;
    
    // Calculate Seconds
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    // Clamp limits (Don't wait 40 seconds for a short cue, don't cut off at 2 seconds)
    const clampedSeconds = Math.min(Math.max(estimatedSeconds, this.props.minSpeechDuration), 20);
    
    const finalDuration = clampedSeconds + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Timing: ${finalDuration.toFixed(1)}s (Style: ${wpm} wpm)`);
    }

    // 6. Wait & Signal Done
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