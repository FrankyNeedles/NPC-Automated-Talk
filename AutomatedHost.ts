// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent" (AI Performer).
 * 
 * FIXES:
 * 1. CLEAN SPEECH: Strips *gestures* and (parentheticals) so TTS sounds natural.
 * 2. TIMEOUT BOOST: Increased AI wait time to 8s to reduce failure rate.
 * 3. LOGIC: Ensures 'finishSpeaking' is always called.
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

    // 1. CLEAN PROMPT
    const systemPrompt = 
      `ROLE: You are ${myName}, the ${this.props.roleDescription}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `RULES: \n` +
      `1. Speak naturally to ${otherName}.\n` +
      `2. DO NOT use stage directions like *waves* or (laughs).\n` +
      `3. DO NOT use hashtags.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking...`);

    let spokenText = "";

    // 2. AI EXECUTION (8s Timeout)
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        const timeoutPromise = new Promise((_, reject) => 
            this.async.setTimeout(() => reject(new Error("AI_TIMEOUT")), 8000)
        );
        
        const response = await Promise.race([
            this.npc.conversation.elicitResponse(systemPrompt),
            timeoutPromise
        ]);
        
        // Handle Return Type
        if (typeof response === 'string') spokenText = response;
        else if ((response as any).text) spokenText = (response as any).text;

      } else {
        throw new Error("AI_OFFLINE");
      }
    } catch (e) {
      if (this.props.debugMode) console.warn(`[${this.props.hostID}] Fallback Triggered: ${e}`);
      spokenText = `Interesting point about ${data.topic}, ${otherName}. Let's discuss that further.`;
      // Manually speak fallback since elicitResponse failed
      this.npc.conversation.speak(spokenText);
    }

    // 3. SANITIZER (Double Check)
    // Remove anything inside * * or ( )
    const cleanText = spokenText.replace(/\*.*?\*/g, "").replace(/\(.*?\)/g, "").trim();

    // 4. TIMING MATH
    let wpm = 135; 
    if (data.pacingStyle === "Rapid") wpm = 165;
    if (data.pacingStyle === "Relaxed") wpm = 110;

    const estimatedWords = cleanText.length / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    // Safety Cap (15s max wait)
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), 15.0) + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Timing: ${finalDuration.toFixed(1)}s`);
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