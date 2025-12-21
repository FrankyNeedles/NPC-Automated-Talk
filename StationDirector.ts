// StationDirector.ts
/**
 * StationDirector.ts
 * The "Head Writer" (Hidden NPC).
 * 
 * FIX: Changed 'fullContext' from const to let so it can be updated.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc';
import { SmartNpcMemory } from './SmartNpcMemory';
import { BroadcastSegment } from './VortexMath';
import { TopicsDatabase } from './TopicsDatabase';

const DirectorBriefEvent = new NetworkEvent<any>('DirectorBriefEvent');

const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');
const CueExecutiveEvent = new NetworkEvent<any>('CueExecutiveEvent');

interface TopicData {
  id: string;
  headline: string;
  body: string;
  hostAngle?: string;
  coHostAngle?: string;
}

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
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    if (this.props.topicsEntity) {
      const ent = this.props.topicsEntity as Entity;
      this.topicsDB = ent.as(TopicsDatabase as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorBriefEvent, this.handleCreativeBrief.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleHostSpeechComplete.bind(this));
  }

  private async handleCreativeBrief(data: any) {
    if (!this.directorNPC) return;

    if (this.isDebug) console.log(`[Director] Writing Script: ${data.topic.headline} (${data.formatSpin})`);

    // Zero-Latency Hybrid Pipeline: Try fast path first
    const fastPathCue = this.tryFastPath(data);
    if (fastPathCue) {
      if (this.isDebug) console.log(`[Director] Using fast path for ${data.topic.headline}`);
      this.dispatchCue(fastPathCue, data);
      return;
    }

    // Slow path: AI generation with resilience
    if (this.isDebug) console.log(`[Director] Using slow path for ${data.topic.headline}`);

    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests in Studio: ${aud.join(", ")}` : "(Studio Empty)";

    const systemPrompt =
      `ACT AS: Academy Award-Winning Screenwriter for a hit late-night talk show.\n` +
      `FORMAT: ${data.segmentType}. STYLE: ${data.formatSpin}. ${audienceStr}.\n` +
      `TOPIC: "${data.topic.headline}"\n` +
      `DETAILS: ${data.topic.body}\n` +
      `TASK: Craft Oscar-caliber stage directions for two charismatic hosts in a dynamic conversation.\n` +
      `REQUIREMENTS:\n` +
      `1. DRAMATIC ARC: Hook → Build Tension → Climactic Insight → Memorable Close\n` +
      `2. CHEMISTRY: Write as if they're old friends with inside jokes, playful rivalry, genuine reactions.\n` +
      `3. SUBSTANCE: Explore the human angle. What does this mean for real people? Use vivid anecdotes.\n` +
      `4. HOLLYWOOD MAGIC: Make it cinematic. Use timing, pauses, callbacks. Feel like a scene from a prestige drama.\n` +
      `5. AUTHENTIC VOICE: Natural speech patterns. Interruptions, "you know what I mean?", vocal variety.\n` +
      `6. PERSONALITY: Anchor is authoritative but warm. Co-host is witty, challenges assumptions.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ANCHOR_STANCE: [Nuanced position with emotional depth]\n` +
      `COHOST_STANCE: [Contrasting view that creates productive tension]\n` +
      `ANCHOR_DIR: [Detailed scene direction - how to open, pivot, close with charisma]\n` +
      `COHOST_DIR: [How to counter, escalate, humanize the discussion]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.dispatchFallback(data);
        return;
      }

      // AI Resilience: 6s timeout, one retry, fallback, log timeouts
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

          // Check if response is empty or invalid
          if (!response || (typeof response === 'object' && Object.keys(response).length === 0)) {
            throw new Error("Empty AI response");
          }

          break; // Success, exit retry loop
        } catch (e) {
          retryCount++;
          if (this.isDebug) console.warn(`[Director] AI attempt ${retryCount} failed:`, e);

          // Log timeout in SmartNpcMemory
          if (this.memory && (e as any).message === "Timeout") {
            this.memory.setData(`timeout_log_${Date.now()}`, {
              topic: data.topic.headline,
              attempt: retryCount,
              timestamp: Date.now()
            });
          }

          if (retryCount > maxRetries) {
            throw e; // Max retries reached, throw error
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
    let anchorInstr = (brief.topic as any).hostAngle;
    let coHostInstr = (brief.topic as any).coHostAngle;
    let hStance = "Neutral";
    let cStance = "Neutral";

    const paceMatch = aiText.match(/PACING:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);
    const hStanceMatch = aiText.match(/ANCHOR_STANCE:\s*(.*)/);
    const cStanceMatch = aiText.match(/COHOST_STANCE:\s*(.*)/);

    if (paceMatch) pacing = paceMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];
    if (hStanceMatch) hStance = hStanceMatch[1];
    if (cStanceMatch) cStance = cStanceMatch[1];

    // FIX: Changed 'const' to 'let' so we can reassign it below
    let fullContext = `Topic: ${brief.topic.headline}. ${brief.topic.body}. Spin: ${brief.formatSpin}. ${audStr}`;

    if (brief.segmentType === BroadcastSegment.AUDIENCE) {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        fullContext = `Q&A. ${audStr}. Question: "${q}"`;
        anchorInstr = "Answer question.";
        coHostInstr = "Engage.";
        pacing = "Relaxed";
    }

    // Use sequential cueing to prevent overlap
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

    // Send cue to HostA (Anchor)
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

    // Send cue to HostB (Co-Host) after a short delay
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

  // Zero-Latency Hybrid Pipeline: Fast path implementation
  private tryFastPath(data: { segmentType: string; topic: TopicData; formatSpin: string; duration: number }): any | null {
    if (!this.topicsDB) return null;

    // Try to get a relevant topic template from TopicsDatabase
    const topicTemplate = this.topicsDB.getBestTopic(data.topic.headline);
    if (!topicTemplate) return null;

    // Use template to create fast-path cue
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

  // Unified dispatch method for both fast and slow paths
  private dispatchCue(cueData: any, brief: any) {
    const fullContext = cueData.context;
    const anchorInstr = cueData.hostInstructions;
    const coHostInstr = cueData.coHostInstructions;

    // Store the cue data for sequential dispatch
    this.pendingCue = {
      cueData,
      brief,
      fullContext,
      anchorInstr,
      coHostInstr,
      nextSpeaker: "HostA" // Start with HostA
    };

    // Cue Executive Producer to introduce the segment
    this.cueExecutiveProducer();

    // Start the conversation with HostA after a delay
    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, 3000); // 3 second delay to let EP speak first
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
      this.pendingCue.nextSpeaker = "HostA"; // Reset to HostA for next round if needed
    }
  }

  private handleHostSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.isDebug) console.log(`[Director] ${data.hostID} finished speaking: ${data.contentSummary}`);

    // Store the last speech summary for context
    this.lastSpeechSummary = data.contentSummary;

    // Cue the next speaker sequentially
    if (this.pendingCue && this.currentSpeaker === data.hostID) {
      // Increased delay before next speaker to prevent overlap
      this.async.setTimeout(() => {
        this.cueNextSpeaker();
      }, 3000); // 3000ms delay
    }

    // After both hosts have spoken, cue the Executive Producer for commentary
    if (this.pendingCue && this.currentSpeaker === "HostB") {
      this.async.setTimeout(() => {
        this.cueExecutiveProducer();
      }, 1500); // 1.5 second delay after HostB finishes
    }
  }

  private cueExecutiveProducer() {
    if (!this.pendingCue) return;

    const { cueData } = this.pendingCue;

    // Send cue to Executive Producer
    this.sendNetworkBroadcastEvent(CueExecutiveEvent, {
      context: cueData.context,
      showStatus: "Live broadcast in progress",
      backupLine: "That's an interesting development in our show."
    });

    if (this.isDebug) console.log(`[Director] Cued Executive Producer for commentary`);
  }
}

Component.register(StationDirector);
