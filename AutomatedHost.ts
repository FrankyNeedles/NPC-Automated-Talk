// AutomatedHost.ts
import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "System ID" },
    displayName: { type: PropTypes.String, default: "Host", label: "My Name" },
    partnerName: { type: PropTypes.String, default: "Co-Host", label: "Partner Name" },
    roleDescription: { type: PropTypes.String, default: "TV Anchor", label: "Role Desc" },
    minSpeechDuration: { type: PropTypes.Number, default: 3 },
    padding: { type: PropTypes.Number, default: 1.0 }, 
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

    const systemPrompt = 
      `ROLE: You are ${myName}, the ${this.props.roleDescription}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally to ${otherName}. Defend your stance.\n` +
      `OUTPUT: Spoken dialogue only.`;

    // AI Race Logic
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        const timeoutPromise = new Promise((_, reject) => 
            this.async.setTimeout(() => reject(new Error("AI_TIMEOUT")), 5000)
        );
        await Promise.race([
            this.npc.conversation.elicitResponse(systemPrompt),
            timeoutPromise
        ]);
      } else {
        throw new Error("AI_OFFLINE");
      }
    } catch (e) {
      const fallback = `(Nods) Interesting point about ${data.topic}, ${otherName}.`;
      this.npc.conversation.speak(fallback);
    }

    // Timing
    let wpm = 140; 
    if (data.pacingStyle === "Rapid") wpm = 170;
    if (data.pacingStyle === "Relaxed") wpm = 110;

    const contextLength = (data.instructions.length) * 1.5; 
    const estimatedWords = contextLength / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    // Capped Duration (Max 12s wait)
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), 12.0) + this.props.padding;

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