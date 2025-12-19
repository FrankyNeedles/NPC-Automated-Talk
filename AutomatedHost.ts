// AutomatedHost.ts
import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID" },
    displayName: { type: PropTypes.String, default: "Host", label: "My Name" },
    partnerName: { type: PropTypes.String, default: "Co-Host", label: "Partner Name" },
    roleDescription: { type: PropTypes.String, default: "TV Anchor", label: "Role Desc" },
    minSpeechDuration: { type: PropTypes.Number, default: 3, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 1.0, label: "Breath Gap (s)" }, 
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;
  private lastWords: string = ""; // Memory of my own last sentence

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

    // ANTI-REPETITION PROMPT
    const systemPrompt = 
      `ROLE: You are ${myName}, the ${this.props.roleDescription}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: \n` +
      `1. Speak naturally to ${otherName}.\n` +
      `2. Defend your stance.\n` +
      `3. Do NOT repeat this phrase: "${this.lastWords.substring(0, 50)}..."\n` +
      `OUTPUT: Spoken dialogue only.`;

    let finalSpeech = "";

    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        const timeoutPromise = new Promise((_, reject) => 
            this.async.setTimeout(() => reject(new Error("AI_TIMEOUT")), 6000)
        );
        const result = await Promise.race([
            this.npc.conversation.elicitResponse(systemPrompt),
            timeoutPromise
        ]);
        
        if (typeof result === 'string') finalSpeech = result;
        else if ((result as any).text) finalSpeech = (result as any).text;
        
      } else {
        throw new Error("AI_OFFLINE");
      }
    } catch (e) {
      if (this.props.debugMode) console.warn(`[${this.props.hostID}] Using Backup Line.`);
      finalSpeech = data.backupLine || "I definitely have thoughts on that.";
      this.npc.conversation.speak(finalSpeech);
    }

    // Save for next time
    this.lastWords = finalSpeech;

    // Timing
    let wpm = 135; 
    if (data.pacingStyle === "Rapid") wpm = 165;
    if (data.pacingStyle === "Relaxed") wpm = 110;

    const estimatedWords = finalSpeech.length / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), 12.0) + this.props.padding;

    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic, finalSpeech);
    }, finalDuration * 1000);
  }

  private finishSpeaking(topic: string, text: string) {
    this.isBusy = false;
    this.sendNetworkBroadcastEvent(HostSpeechCompleteEvent, {
      hostID: this.props.hostID,
      contentSummary: text.substring(0, 80) // Summarize for the next host
    });
  }
}

Component.register(AutomatedHost);