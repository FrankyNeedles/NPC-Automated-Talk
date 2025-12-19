// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent" (AI Performer).
 * 
 * UPGRADE:
 * 1. AI TIMEOUT: Aborts AI generation after 5s to prevent show freezing.
 * 2. SMART MATH: Calculates speech duration based on 'Pacing Style'.
 * 3. IDENTITY: Uses Inspector slots for Name/Role.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    // Identity
    hostID: { type: PropTypes.String, default: "HostA", label: "System ID (HostA/HostB)" },
    displayName: { type: PropTypes.String, default: "Host", label: "My Name" },
    partnerName: { type: PropTypes.String, default: "Co-Host", label: "Partner Name" },
    roleDescription: { type: PropTypes.String, default: "TV Anchor", label: "Role Desc" },
    
    // Timing
    minSpeechDuration: { type: PropTypes.Number, default: 3, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 1.0, label: "Breath Gap (s)" }, 
    
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;

  async start() {
    this.npc = this.entity.as(Npc);
    if (!this.npc && this.props.debugMode) {
        console.error(`[AutomatedHost] Script attached to non-NPC!`);
    }
    this.connectNetworkBroadcastEvent(CueHostEvent, this.handleCue.bind(this));
  }

  private async handleCue(data: any) {
    if (data.targetHostID !== this.props.hostID) return;
    if (!this.npc) return;

    this.isBusy = true;

    // 1. Build Persona
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

    if (this.props.debugMode) console.log(`[${this.props.hostID}] Speaking as ${myName}...`);

    // 2. AI Execution (With 5s Timeout Protection)
    try {
      const aiAvailable = await NpcConversation.isAiAvailable();
      
      if (aiAvailable) {
        // Race: AI vs 5-second Timer
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
      // Fallback if AI dies
      if (this.props.debugMode) console.warn(`[${this.props.hostID}] Fallback: ${e}`);
      const fallbackLine = `(Nods) Interesting point about ${data.topic}, ${otherName}.`;
      this.npc.conversation.speak(fallbackLine);
    }

    // 3. Smart Timing Calculation
    let wpm = 135; // Default Casual
    let maxWait = 15; // Max seconds to wait before forcing next turn

    if (data.pacingStyle === "Rapid") { wpm = 165; maxWait = 10; }
    if (data.pacingStyle === "Debate") { wpm = 150; maxWait = 18; }
    if (data.pacingStyle === "Relaxed") { wpm = 110; maxWait = 25; }

    // Weighted Word Count:
    // We heavily weight the Instructions/Stance (Script) and barely count Context (Background info)
    const weightedLength = (data.context.length * 0.1) + (data.instructions.length) + (data.stance.length * 1.2);
    
    const estimatedWords = weightedLength / 5;
    const estimatedSeconds = (estimatedWords / wpm) * 60;
    
    // Clamp the duration: At least Min, No more than MaxWait
    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, estimatedSeconds), maxWait) + this.props.padding;

    if (this.props.debugMode) {
      console.log(`[${this.props.hostID}] Timing: ${finalDuration.toFixed(1)}s (Limit: ${maxWait}s)`);
    }

    // 4. Signal Finish
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