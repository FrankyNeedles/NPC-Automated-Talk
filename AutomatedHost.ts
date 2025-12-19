// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * UPGRADE: "Clean & Natural"
 * - Strips stage directions (*laughs*) from output.
 * - Uses human-like timing gaps.
 */

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
    minSpeechDuration: { type: PropTypes.Number, default: 4, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 1.5, label: "Breath Gap (s)" }, 
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

    // 1. NATURAL PROMPT
    const systemPrompt = 
      `ROLE: You are ${myName}, the ${this.props.roleDescription}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `RULES:\n` +
      `1. Respond naturally. Use fillers like "Look," or "Honestly."\n` +
      `2. DO NOT use stage directions like *waves* or (laughs).\n` +
      `3. Keep it spoken-word style.\n` +
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
      finalSpeech = data.backupLine || "That is an interesting point.";
      this.npc.conversation.speak(finalSpeech);
    }

    // 2. CLEANER (Sanitize Text)
    const cleanText = finalSpeech.replace(/\*.*?\*/g, "")  // Remove *actions*
                                 .replace(/\(.*?\)/g, "")  // Remove (actions)
                                 .replace(/\[.*?\]/g, "")  // Remove [actions]
                                 .trim();

    // 3. TIMING
    let wpm = 135; 
    if (data.pacingStyle === "Rapid") wpm = 160;
    if (data.pacingStyle === "Relaxed") wpm = 110;

    const estimatedWords = cleanText.length / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), 15.0) + this.props.padding;

    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic, cleanText);
    }, finalDuration * 1000);
  }

  private finishSpeaking(topic: string, text: string) {
    this.isBusy = false;
    this.sendNetworkBroadcastEvent(HostSpeechCompleteEvent, {
      hostID: this.props.hostID,
      contentSummary: text.substring(0, 100)
    });
  }
}

Component.register(AutomatedHost);