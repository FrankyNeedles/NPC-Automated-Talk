// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent" (AI Performer).
 * 
 * CRITICAL UPDATE: "Precision Timing"
 * 1. REMOVED Max Duration Cap (Fixes overlap on long speeches).
 * 2. ADDED Punctuation Math (Commas/Periods add wait time).
 * 3. TUNED WPM (Slower default to ensure audio clears).
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
    
    // Increased safety floor
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

    // 1. Prompt Generation
    const systemPrompt = 
      `ROLE: You are ${myName}, the ${this.props.roleDescription}.\n` +
      `TOPIC: ${data.topic}\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR STANCE: "${data.stance}"\n` +
      `PREVIOUSLY: ${otherName} said: "${data.lastSpeakerContext}"\n` +
      `INSTRUCTIONS: ${data.instructions}\n` +
      `CONSTRAINTS: Speak naturally to ${otherName}. No names.\n` +
      `OUTPUT: Spoken dialogue only.`;

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Cue Rec'd. Processing...`);

    let finalSpeech = "";

    // 2. AI Execution
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      if (aiAvailable) {
        const timeoutPromise = new Promise((_, reject) => 
            this.async.setTimeout(() => reject(new Error("AI_TIMEOUT")), 8000)
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
      if (this.props.debugMode) console.warn(`[${this.props.hostID}] Using Backup.`);
      finalSpeech = data.backupLine || "That is an interesting perspective.";
      this.npc.conversation.speak(finalSpeech);
    }

    // 3. CLEAN UP
    finalSpeech = finalSpeech.replace(/\*.*?\*/g, "").replace(/\(.*?\)/g, "").trim();

    // 4. PRECISION TIMING MATH
    let wpm = 100; // Slower base for safety
    if (data.pacingStyle === "Rapid") wpm = 140;
    if (data.pacingStyle === "Relaxed") wpm = 90;

    // Word Count
    const wordCount = finalSpeech.split(' ').length;
    const speakingTime = (wordCount / wpm) * 60;

    // Punctuation Bonus (TTS pauses at commas/periods)
    const commas = (finalSpeech.match(/,/g) || []).length;
    const periods = (finalSpeech.match(/[.!?]/g) || []).length;
    const pauseBonus = (commas * 0.3) + (periods * 0.8);

    // Total Duration (No Cap!)
    const finalDuration = Math.max(this.props.minSpeechDuration, speakingTime + pauseBonus) + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Words: ${wordCount} | Pauses: ${pauseBonus.toFixed(1)}s | Total: ${finalDuration.toFixed(1)}s`);
    }

    // 5. Wait & Signal
    this.async.setTimeout(() => {
      this.finishSpeaking(data.topic, finalSpeech);
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