// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The Talent.
 * 
 * UPGRADE: Uses 'Pacing Style' to calculate clearer, more natural speech gaps.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID" },
    minSpeechDuration: { type: PropTypes.Number, default: 3, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 1.5, label: "Gap Padding (s)" }, 
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

    const myName = this.props.hostID === "HostA" ? "Alex (Anchor)" : "Casey (CoHost)";
    const otherName = this.props.hostID === "HostA" ? "Casey" : "Alex";

    // 1. Prompt
    const systemPrompt = 
      `ROLE: You are ${myName}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally to ${otherName}. Keep it broadcast quality.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking...`);

    // 2. Speak
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        this.npc.conversation.elicitResponse(systemPrompt);
      } else {
        this.npc.conversation.speak(`I have thoughts on ${data.topic}.`);
      }
    } catch (e) {
      console.warn("AI Error", e);
    }

    // 3. PACING CALCULATION
    // Extract pacing style from instructions (hacky but effective if data.instructions contains it)
    // Ideally ShowScheduler passes it explicitly, but we can infer default WPM.
    let wpm = 140; // Default Casual
    if (data.instructions.includes("Rapid")) wpm = 180;
    if (data.instructions.includes("Relaxed")) wpm = 110;

    // Estimate: Words = Length / 5 chars per word
    const estimatedWords = (data.context.length + data.instructions.length) / 5;
    
    // Seconds = (Words / WPM) * 60
    // We clamp the estimation because AI output length varies
    const estimatedSeconds = Math.min((estimatedWords / wpm) * 60, 20); 
    
    // Final Duration
    const finalDuration = Math.max(this.props.minSpeechDuration, estimatedSeconds) + this.props.padding;

    // 4. Timer
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