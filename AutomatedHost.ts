// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * FIX: Replaced 'Set' iteration with Array.filter to fix TS compilation error.
 * Maintains "Instant Failover" and "Safe Timing" logic.
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
    padding: { type: PropTypes.Number, default: 2.0, label: "Breath Gap (s)" }, 
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
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally. No stage directions.\n` +
      `OUTPUT: Spoken words ONLY.`;

    let finalSpeech = "";

    // 1. AI EXECUTION
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        // Race: AI vs 6s Timeout
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
      if (this.props.debugMode) console.warn(`[${this.props.hostID}] AI Fail. Using Backup.`);
      finalSpeech = data.backupLine || "That is an interesting point. Let's keep going.";
      
      try {
          this.npc.conversation.speak(finalSpeech);
      } catch (ttsError) { /* Ignore TTS error */ }
    }

    // 2. CLEANER & DEDUPE (Compatibility Fix)
    let cleanText = finalSpeech.replace(/\*.*?\*/g, "")
                               .replace(/\(.*?\)/g, "")
                               .replace(/\[.*?\]/g, "")
                               .trim();
    
    // Fix: Use filter instead of Set for older TS targets
    const sentences = cleanText.split('. ');
    const uniqueSentences = sentences.filter((val, i, arr) => arr.indexOf(val) === i);
    cleanText = uniqueSentences.join('. ');

    // 3. TIMING MATH
    let wpm = 135; 
    if (data.pacingStyle === "Rapid") wpm = 150;
    if (data.pacingStyle === "Relaxed") wpm = 120;

    const estimatedWords = Math.max(cleanText.length / 5, 1);
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), 15.0) + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Timing: ${finalDuration.toFixed(1)}s`);
    }

    // 4. SIGNAL FINISH
    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic, cleanText);
    }, finalDuration * 1000);
  }

  private finishSpeaking(topic: string, text: string) {
    this.isBusy = false;
    let summary = text;
    if (!summary || summary.includes("Error") || summary.includes("Timeout")) {
        summary = "made a point.";
    }
    this.sendNetworkBroadcastEvent(HostSpeechCompleteEvent, {
      hostID: this.props.hostID,
      contentSummary: summary.substring(0, 100)
    });
  }
}

Component.register(AutomatedHost);