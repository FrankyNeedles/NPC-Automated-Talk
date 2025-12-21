import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc';

// --- Event Definitions ---
const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');
const CueExecutiveEvent = new NetworkEvent<any>('CueExecutiveEvent');

// --- Interfaces (for data structure clarity) ---
interface TopicData {
  id: string;
  headline: string;
  body: string;
  hostAngle?: string;
  coHostAngle?: string;
}

interface TopicTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  stance: string;
  instructions: string;
  backupLine: string;
}

// --- Mocked Local Dependencies ---
// In a real project, these would be in separate files.
// For this single-file script, we define them here.

class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  getAudienceList(): string[] { return []; }
  getLatestChatQuestion(): string { return "What is the meaning of life?"; }
  getRecentSpeechContent(count: number): string[] { return []; }
  setData(key: string, value: any) { console.log(`Memory Set: ${key}`); }
  start() {}
}
Component.register(SmartNpcMemory);

class TopicsDatabase extends Component<typeof TopicsDatabase> {
  getBestTopic(headline: string): TopicTemplate | null {
    // Mock implementation: return a generic template for demonstration
    if (headline) {
      return {
        id: 'fast_path_1',
        category: 'General',
        title: headline,
        description: 'A topic that was processed quickly.',
        stance: 'Neutral',
        instructions: 'Discuss the topic with enthusiasm.',
        backupLine: 'That is a fascinating subject.'
      };
    }
    return null;
  }
  start() {}
}
Component.register(TopicsDatabase);

const BroadcastSegment = {
  AUDIENCE: "AUDIENCE_Q_A"
};

// --- Main Component ---

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    topicsEntity: { type: PropTypes.Entity, label: "Topics Database Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private topicsDB: TopicsDatabase | undefined;
  private directorNPC: Npc | undefined;
  private isDebug: boolean = false;
  private pendingCue: any | null = null;
  private currentSpeaker: string | null = null;
  private lastSpeechSummary: string = "";

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);

    if (!this.directorNPC) {
        console.error("[StationDirector] CRITICAL: Must be attached to a Hidden NPC.");
    }

    if (this.props.memoryEntity) {
      this.memory = this.props.memoryEntity.getComponents(SmartNpcMemory)[0];
    }

    if (this.props.topicsEntity) {
      this.topicsDB = this.props.topicsEntity.getComponents(TopicsDatabase)[0];
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleCreativeBrief.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleHostSpeechComplete.bind(this));
  }

  private async handleCreativeBrief(data: any) {
    if (!this.directorNPC) return;

    if (this.isDebug) console.log(`[Director] Writing Script: ${data.topic.headline} (${data.formatSpin})`);

    const fastPathCue = this.tryFastPath(data);
    if (fastPathCue) {
      if (this.isDebug) console.log(`[Director] Using fast path for ${data.topic.headline}`);
      this.dispatchCue(fastPathCue, data);
      return;
    }

    if (this.isDebug) console.log(`[Director] Using slow path for ${data.topic.headline}`);

    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests in Studio: ${aud.join(", ")}` : "(Studio Empty)";

    // Get conversation history to prevent repetition
    const recentSpeeches = this.memory ? this.memory.getRecentSpeechContent(5) : [];
    const speechHistory = recentSpeeches.length > 0 ? `RECENT SPEECH HISTORY: ${recentSpeeches.join(' | ')}\n` : '';

    const systemPrompt =
      `ACT AS: Academy Award-Winning Screenwriter for a hit late-night talk show.\n` +
      `FORMAT: ${data.segmentType}. STYLE: ${data.formatSpin}. ${audienceStr}.\n` +
      `TOPIC: "${data.topic.headline}"\n` +
      `DETAILS: ${data.topic.body}\n` +
      `${speechHistory}` +
      `TASK: Write distinct, sequential monologues for two hosts to create a natural back-and-forth discussion.\n` +
      `REQUIREMENTS:\n` +
      `1. UNIQUENESS: Avoid repeating any phrases, topics, or ideas from recent speech history. Be completely original.\n` +
      `2. DRAMATIC ARC: HostA hooks, HostB builds tension, HostA climactic insight, HostB memorable close\n` +
      `3. CHEMISTRY: Write as if they're old friends with inside jokes, playful rivalry, genuine reactions.\n` +
      `4. SUBSTANCE: Explore the human angle. What does this mean for real people? Use vivid anecdotes.\n` +
      `5. HOLLYWOOD MAGIC: Make it cinematic. Use timing, pauses, callbacks. Feel like a scene from a prestige drama.\n` +
      `6. AUTHENTIC VOICE: Natural speech patterns. Interruptions, "you know what I mean?", vocal variety.\n` +
      `7. PERSONALITY: HostA (Anchor) is authoritative but warm. HostB (Co-host) is witty, challenges assumptions.\n` +
      `8. CONTEXT AWARENESS: Reference current audience, room vibe, and recent interactions naturally.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `HOSTA_STANCE: [HostA's position with emotional depth]\n` +
      `HOSTB_STANCE: [HostB's contrasting view that creates productive tension]\n` +
      `HOSTA_SCRIPT: [HostA's complete monologue - natural, engaging, no repetition]\n` +
      `HOSTB_SCRIPT: [HostB's complete monologue - responds to HostA, builds on discussion, no repetition]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.dispatchFallback(data);
        return;
      }

      let response: any;
      let retryCount = 0;
      const maxRetries = 1;

      while (retryCount <= maxRetries) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            this.async.setTimeout(() => reject(new Error("Timeout")), 6000)
          );

          response = await (Promise.race([
            this.directorNPC.conversation.elicitResponse(systemPrompt),
            timeoutPromise
          ]) as Promise<any>);

          if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
            throw new Error("Empty AI response");
          }

          break; 
        } catch (e) {
          retryCount++;
          if (this.isDebug) console.warn(`[Director] AI attempt ${retryCount} failed:`, e);

          if (this.memory && (e as any).message === "Timeout") {
            this.memory.setData(`timeout_log_${Date.now()}`, {
              topic: data.topic.headline,
              attempt: retryCount,
              timestamp: Date.now()
            });
          }

          if (retryCount > maxRetries) {
            throw e;
          }
        }
      }

      const responseText = typeof response === 'string' ? response : (response as any)?.text || '';
      this.parseAndDispatch(responseText, data, audienceStr);

    } catch (e) {
      if (this.isDebug) console.warn("[Director] Writing Failed after retries:", e);
      this.dispatchFallback(data);
    }
  }

  private parseAndDispatch(aiText: string, brief: any, audStr: string) {
    let pacing = "Casual";
    let anchorInstr = (brief.topic as any).hostAngle || "Discuss the topic.";
    let coHostInstr = (brief.topic as any).coHostAngle || "React to the discussion.";
    let hStance = "Neutral";
    let cStance = "Neutral";

    const paceMatch = aiText.match(/PACING:\s*(\w+)/);
    const anchorMatch = aiText.match(/HOSTA_SCRIPT:\s*(.*)/);
    const cohostMatch = aiText.match(/HOSTB_SCRIPT:\s*(.*)/);
    const hStanceMatch = aiText.match(/HOSTA_STANCE:\s*(.*)/);
    const cStanceMatch = aiText.match(/HOSTB_STANCE:\s*(.*)/);

    if (paceMatch) pacing = paceMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1].trim() || anchorInstr;
    if (cohostMatch) coHostInstr = cohostMatch[1].trim() || coHostInstr;
    if (hStanceMatch) hStance = hStanceMatch[1].trim() || hStance;
    if (cStanceMatch) cStance = cStanceMatch[1].trim() || cStance;

    let fullContext = `Topic: ${brief.topic.headline}. ${brief.topic.body}. Spin: ${brief.formatSpin}. ${audStr}`;

    if (brief.segmentType === BroadcastSegment.AUDIENCE) {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        fullContext = `Q&A. ${audStr}. Question: "${q}"`;
        anchorInstr = "Answer question.";
        coHostInstr = "Engage.";
        pacing = "Relaxed";
    }

    const cueData = {
      segment: brief.segmentType,
      topicID: brief.topic.id,
      headline: brief.topic.headline,
      context: fullContext,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr,
      hostStance: hStance,
      coHostStance: cStance,
      duration: brief.duration,
      pacingStyle: pacing
    };

    this.dispatchCue(cueData, brief);
  }

  private dispatchFallback(brief: any) {
    const fullContext = brief.topic.body;
    const anchorInstr = brief.topic.hostAngle || "Discuss topic.";
    const coHostInstr = brief.topic.coHostAngle || "React.";

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: "HostA",
      topic: {
        id: brief.topic.id,
        headline: brief.topic.headline,
        body: fullContext,
        hostAngle: anchorInstr,
        coHostAngle: coHostInstr,
        intensity: 8,
        validDayParts: ["Any"],
        tangents: []
      },
      context: fullContext,
      instructions: anchorInstr,
      stance: "Neutral",
      lastSpeakerContext: "",
      pacingStyle: "Casual",
      backupLine: "That is an interesting point."
    });

    this.async.setTimeout(() => {
      this.sendNetworkBroadcastEvent(CueHostEvent, {
        targetHostID: "HostB",
        topic: {
          id: brief.topic.id,
          headline: brief.topic.headline,
          body: fullContext,
          hostAngle: coHostInstr,
          coHostAngle: anchorInstr,
          intensity: 8,
          validDayParts: ["Any"],
          tangents: []
        },
        context: fullContext,
        instructions: coHostInstr,
        stance: "Neutral",
        lastSpeakerContext: "",
        pacingStyle: "Casual",
        backupLine: "I agree with that."
      });
    }, 1000);
  }

  private tryFastPath(data: { segmentType: string; topic: TopicData; formatSpin: string; duration: number }): any | null {
    if (!this.topicsDB) return null;

    const topicTemplate = this.topicsDB.getBestTopic(data.topic.headline);
    if (!topicTemplate) return null;

    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests in Studio: ${aud.join(", ")}` : "(Studio Empty)";

    let fullContext = `Topic: ${data.topic.headline}. ${data.topic.body}. Spin: ${data.formatSpin}. ${audienceStr}`;

    if (data.segmentType === BroadcastSegment.AUDIENCE) {
      const q = this.memory ? this.memory.getLatestChatQuestion() : "";
      fullContext = `Q&A. ${audienceStr}. Question: "${q}"`;
    }

    return {
      segment: data.segmentType,
      topicID: data.topic.id,
      headline: data.topic.headline,
      context: fullContext,
      hostInstructions: topicTemplate.instructions,
      coHostInstructions: topicTemplate.backupLine,
      hostStance: topicTemplate.stance,
      coHostStance: "Contrasting",
      duration: data.duration,
      pacingStyle: "Casual"
    };
  }

  private dispatchCue(cueData: any, brief: any) {
    const fullContext = cueData.context;
    const anchorInstr = cueData.hostInstructions;
    const coHostInstr = cueData.coHostInstructions;

    this.pendingCue = {
      cueData,
      brief,
      fullContext,
      anchorInstr,
      coHostInstr,
      nextSpeaker: "HostA"
    };

    this.cueExecutiveProducer();

    // Use adaptive timing for initial cue based on context length
    const contextLength = fullContext.length;
    const initialDelay = Math.min(4000, 2000 + (contextLength * 5)); // 2-4 seconds based on context

    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, initialDelay);
  }

  private cueNextSpeaker() {
    if (!this.pendingCue) return;

    const { cueData, fullContext, anchorInstr, coHostInstr, nextSpeaker } = this.pendingCue;

    if (nextSpeaker === "HostA") {
      this.currentSpeaker = "HostA";
      this.sendNetworkBroadcastEvent(CueHostEvent, {
        targetHostID: "HostA",
        topic: {
          id: cueData.topicID,
          headline: cueData.headline,
          body: fullContext,
          hostAngle: anchorInstr,
          coHostAngle: coHostInstr,
          intensity: 8,
          validDayParts: ["Any"],
          tangents: []
        },
        context: fullContext,
        instructions: anchorInstr,
        stance: cueData.hostStance,
        lastSpeakerContext: "",
        pacingStyle: cueData.pacingStyle,
        backupLine: "That is an interesting point."
      });
      this.pendingCue.nextSpeaker = "HostB";
    } else if (nextSpeaker === "HostB") {
      this.currentSpeaker = "HostB";
      this.sendNetworkBroadcastEvent(CueHostEvent, {
        targetHostID: "HostB",
        topic: {
          id: cueData.topicID,
          headline: cueData.headline,
          body: fullContext,
          hostAngle: coHostInstr,
          coHostAngle: anchorInstr,
          intensity: 8,
          validDayParts: ["Any"],
          tangents: []
        },
        context: fullContext,
        instructions: coHostInstr,
        stance: cueData.coHostStance,
        lastSpeakerContext: this.lastSpeechSummary,
        pacingStyle: cueData.pacingStyle,
        backupLine: "I agree with that."
      });
      this.pendingCue.nextSpeaker = "HostA";
    }
  }

  private handleHostSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.isDebug) console.log(`[Director] ${data.hostID} finished speaking: ${data.contentSummary}`);

    this.lastSpeechSummary = data.contentSummary;

    if (this.pendingCue && this.currentSpeaker === data.hostID) {
      this.async.setTimeout(() => {
        this.cueNextSpeaker();
      }, 3000);
    }

    if (this.pendingCue && this.currentSpeaker === "HostB") {
      this.async.setTimeout(() => {
        this.cueExecutiveProducer();
      }, 1500);
    }
  }

  private cueExecutiveProducer() {
    if (!this.pendingCue) return;

    const { cueData } = this.pendingCue;

    this.sendNetworkBroadcastEvent(CueExecutiveEvent, {
      context: cueData.context,
      showStatus: "Live broadcast in progress",
      backupLine: "That's an interesting development in our show."
    });

    if (this.isDebug) console.log(`[Director] Cued Executive Producer for commentary`);
  }
}

Component.register(StationDirector);