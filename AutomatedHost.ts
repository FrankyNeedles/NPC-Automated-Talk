// AutomatedHost.ts
/**
 * AutomatedHost.ts
 * The "Talent".
 * 
 * UPGRADE: "Clean & Natural"
 * - Strips stage directions (*laughs*) from output.
 * - Uses human-like timing gaps.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc';
import { SmartNpcMemory } from './SmartNpcMemory';

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
    debugMode: { type: PropTypes.Boolean, default: false },
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" }
  };

  private npc: Npc | undefined;
  private memory: SmartNpcMemory | undefined;
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

    // Initialize memory link
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
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
    let memoryContext = "";
    if (this.memory) {
      const storyline = this.memory.getStoryline();
      const playerRole = this.memory.getPlayerRole();
      const lastPrompts = this.memory.getLastPrompts().slice(-3).join('; ');
      const audienceList = this.memory.getAudienceList().join(', ');
      const roomVibe = this.memory.getRoomVibe();
      memoryContext = `\nSTORYLINE: ${storyline}\nPLAYER ROLE: ${playerRole}\nRECENT PROMPTS: ${lastPrompts}\nAUDIENCE: ${audienceList}\nROOM VIBE: ${roomVibe}`;
    }

    const systemPrompt =
      `CHARACTER: You are ${myName}, the ${this.props.roleDescription} on a hit late-night show.\n` +
      `SCENE: Live television discussion about "${data.topic}"\n` +
      `CONTEXT: ${data.context}\n` +
      `YOUR MOTIVATION: "${data.stance}"\n` +
      `CO-HOST JUST SAID: "${data.lastSpeakerContext}"\n` +
      `DIRECTOR'S NOTES: ${data.instructions}${memoryContext}\n` +
      `PERFORMANCE REQUIREMENTS:\n` +
      `1. NATURAL SPEECH: Speak like a real person - use contractions, filler words like "you know", "I mean", vary sentence length.\n` +
      `2. CHEMISTRY: Respond directly to co-host's points, build on their ideas, show agreement or playful disagreement.\n` +
      `3. EMOTIONAL DEPTH: Add genuine reactions - surprise, enthusiasm, skepticism. Connect to audience and storyline.\n` +
      `4. CONVERSATIONAL FLOW: Start with acknowledgment, add personal insight, end with question or transition.\n` +
      `5. TIMING AWARENESS: Include natural pauses in dialogue for emphasis, questions, or thoughtfulness.\n` +
      `6. PERSONALITY: ${this.props.hostID === 'HostA' ? 'Warm, authoritative leader who guides the conversation' : 'Witty, engaging challenger who keeps energy high'}\n` +
      `7. AVOID REPETITION: Never repeat phrases from recent speech history. Be completely original.\n` +
      `OUTPUT: Pure spoken dialogue, 1-2 sentences. No stage directions, no quotation marks, no asterisks.`;

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
      // Graceful fallback: speak the backup line
      try {
        this.npc.conversation.speak(finalSpeech);
      } catch (ttsError) {
        if (this.props.debugMode) console.warn(`[Host ${this.props.hostID}] TTS fallback failed:`, ttsError);
      }
    }

    // 2. CLEANER (Sanitize Text)
    const cleanText = finalSpeech.replace(/\*.*?\*/g, "")  // Remove *actions*
                                 .replace(/\(.*?\)/g, "")  // Remove (actions)
                                 .replace(/\[.*?\]/g, "")  // Remove [actions]
                                 .trim();

    // Speak the text immediately with error handling
    try {
      this.npc.conversation.speak(cleanText);
    } catch (e) {
      if (this.props.debugMode) console.warn(`[Host ${this.props.hostID}] TTS failed:`, e);
      // Fallback: do nothing, as speech completion will still trigger
    }

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