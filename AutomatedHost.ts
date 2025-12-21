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
const HostBusyEvent = new NetworkEvent<{ hostID: string }>('HostBusyEvent');

export class AutomatedHost extends Component<typeof AutomatedHost> {
  static propsDefinition = {
    hostID: { type: PropTypes.String, default: "HostA", label: "Host ID" },
    displayName: { type: PropTypes.String, default: "Host", label: "My Name" },
    partnerName: { type: PropTypes.String, default: "Co-Host", label: "Partner Name" },
    roleDescription: { type: PropTypes.String, default: "TV Anchor", label: "Role Desc" },
    minSpeechDuration: { type: PropTypes.Number, default: 8, label: "Min Floor (s)" },
    padding: { type: PropTypes.Number, default: 2.0, label: "Breath Gap (s)" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private npc: Npc | undefined;
  private isBusy: boolean = false;
  private myName: string = "";

  async start() {
    this.npc = this.entity.as(Npc);
    this.connectNetworkBroadcastEvent(CueHostEvent, this.handleCue.bind(this));

    // Set identity based on hostID
    if (this.props.hostID === "HostA") {
      this.myName = "Alex";
    } else if (this.props.hostID === "HostB") {
      this.myName = "Casey";
    } else {
      this.myName = this.props.displayName;
    }
  }

  private async handleCue(data: any) {
    if (data.targetHostID !== this.props.hostID) return;
    if (!this.npc) return;
    if (this.isBusy) {
      // Reject cue if already busy - scheduler will retry
      if (this.props.debugMode) console.log(`[Host ${this.props.hostID}] Busy, rejecting cue`);
      this.sendNetworkBroadcastEvent(HostBusyEvent, { hostID: this.props.hostID });
      return;
    }

    this.isBusy = true;
    const myName = this.props.displayName;
    const otherName = this.props.partnerName;

    // 1. CINEMATIC PROMPT - Hollywood-level natural speech
    const systemPrompt =
      `CHARACTER: You are ${myName}, the ${this.props.roleDescription} on a hit late-night show.\n` +
      `SCENE: Live television discussion about "${data.topic}"\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR MOTIVATION: "${data.stance}"\n` +
      `CO-HOST JUST SAID: "${data.lastSpeakerContext}"\n` +
      `DIRECTOR'S NOTES: ${data.instructions}\n` +
      `PERFORMANCE REQUIREMENTS:\n` +
      `1. ACTING: Deliver like a Tony Award winner - natural timing, genuine reactions, vocal variety.\n` +
      `2. CHEMISTRY: Respond to your co-host as an old friend. Reference their points, challenge playfully.\n` +
      `3. HUMANITY: Add personal touches - "I remember when...", "You know what I mean?", casual asides.\n` +
      `4. SUBSTANCE: Go deeper than surface level. Connect to real human experiences.\n` +
      `5. FLOW: Make it conversational - interruptions welcome, natural pauses, authentic speech patterns.\n` +
      `6. PERSONALITY: ${this.props.hostID === 'HostA' ? 'Warm authority, leads with confidence' : 'Witty challenger, keeps it lively'}\n` +
      `OUTPUT: Pure spoken dialogue, 1-2 sentences. No stage directions, no quotation marks.`;

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
      // Dynamic failover backup from tangents/static pool
      const staticPool = [
        "That is an interesting point.",
        "I agree with that.",
        "Let's hear more about this.",
        "What do you think about that?",
        "That's a great observation."
      ];
      const tangents = data.topic?.tangents || [];
      const backupPool = [...tangents, ...staticPool];
      finalSpeech = backupPool[Math.floor(Math.random() * backupPool.length)] || "That is an interesting point.";
      this.npc.conversation.speak(finalSpeech);
    }

    // 2. CLEANER (Sanitize Text)
    const cleanText = finalSpeech.replace(/\*.*?\*/g, "")  // Remove *actions*
                                 .replace(/\(.*?\)/g, "")  // Remove (actions)
                                 .replace(/\[.*?\]/g, "")  // Remove [actions]
                                 .trim();

    // Speak the text immediately
    this.npc.conversation.speak(cleanText);

    // 3. TIMING - Sophisticated WPM with punctuation pauses (110-160 range)
    let baseWpm = 130;
    if (data.pacingStyle === "Rapid") baseWpm = 160;
    if (data.pacingStyle === "Relaxed") baseWpm = 110;

    // Count punctuation for pauses
    const punctuationCount = (cleanText.match(/[.!?;:,]/g) || []).length;
    const pauseSeconds = punctuationCount * 0.3; // 0.3s per punctuation mark

    const estimatedWords = cleanText.length / 5;
    const speechSeconds = (estimatedWords / baseWpm) * 60;
    const totalSeconds = speechSeconds + pauseSeconds;

    const finalDuration = Math.min(Math.max(this.props.minSpeechDuration, totalSeconds), 15.0) + this.props.padding;

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