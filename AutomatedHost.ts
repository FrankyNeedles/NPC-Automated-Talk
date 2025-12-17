// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * UPDATE: Added "Smart Timing".
 * It estimates speech duration based on the length of the prompt instructions.
 * This prevents the Anchor from being cut off during long news stories.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID (A or B)" },
    
    // TIMING CONTROLS
    minSpeechDuration: { type: PropTypes.Number, default: 5, label: "Min Duration (s)" },
    padding: { type: PropTypes.Number, default: 2.0, label: "Safety Padding (s)" },
    
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

    // 1. Construct Prompt
    const systemPrompt = 
      `ROLE: You are the ${data.role} of a TV Broadcast.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `PREVIOUS SPEAKER SAID: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Respond naturally. Do not repeat the previous speaker.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking on: ${data.topic}`);

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

    // 3. SMART TIMING LOGIC
    // We guess the duration based on how complex the instructions were.
    // Long context (News Body) = Longer Speech.
    const contextLength = data.context.length + data.instructions.length;
    
    // Rough formula: 1 second for every 15 characters of input context (capped)
    const estimatedSpeech = Math.min(contextLength / 15, 20); 
    
    // Take the larger of: Minimum setting OR Calculated estimate
    const finalDuration = Math.max(this.props.minSpeechDuration, estimatedSpeech) + this.props.padding;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Waiting ${finalDuration.toFixed(1)}s`);

    // 4. Wait & Signal
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