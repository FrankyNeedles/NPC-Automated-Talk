// StationDirector.ts
/**
 * StationDirector.ts
 * The "Head Writer" (Hidden NPC).
 * 
 * STRICT PIPELINE:
 * - Only listens to 'DirectorBriefEvent' (From EP).
 * - Does NOT decide the topic.
 * - Focuses 100% on writing stage directions for the cues.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { SmartNpcMemory } from './SmartNpcMemory';
import { BroadcastSegment } from './VortexMath';

// INPUT: Only from EP
const DirectorBriefEvent = new NetworkEvent<{ 
  segmentType: string;
  topic: any;
  formatSpin: string; 
  duration: number;
}>('DirectorBriefEvent');

// OUTPUT: To Scheduler
const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostInstructions: string;
  coHostInstructions: string;
  hostStance: string;
  coHostStance: string;
  duration: number;
  pacingStyle: string;
}>('DirectorCueEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  private isDebug: boolean = false;

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    
    if (!this.directorNPC) {
        console.error("[Director] CRITICAL: Must be attached to Hidden NPC.");
    }

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    // ONLY listen to the Boss (EP)
    this.connectNetworkBroadcastEvent(DirectorBriefEvent, this.handleCreativeBrief.bind(this));
  }

  private async handleCreativeBrief(data: { segmentType: string; topic: any; formatSpin: string; duration: number }) {
    if (!this.directorNPC) {
        this.dispatchFallback(data);
        return;
    }

    if (this.isDebug) console.log(`[Director] Writing Script for: ${data.topic.headline}`);

    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests: ${aud.join(", ")}` : "(Empty)";

    const systemPrompt = 
      `ACT AS: Lead Writer.\n` +
      `FORMAT: ${data.segmentType}. SPIN: ${data.formatSpin}. ${audienceStr}.\n` +
      `TOPIC: "${data.topic.headline}"\n` +
      `DETAILS: ${data.topic.body}\n` +
      `TASK: Write Directions.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ANCHOR_STANCE: [Opinion]\n` +
      `COHOST_STANCE: [Opinion]\n` +
      `ANCHOR_DIR: [Instruction]\n` +
      `COHOST_DIR: [Instruction]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.dispatchFallback(data);
        return;
      }

      const timeoutPromise = new Promise((_, reject) => this.async.setTimeout(() => reject(new Error("Timeout")), 15000));
      const response = await Promise.race([this.directorNPC.conversation.elicitResponse(systemPrompt), timeoutPromise]);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndDispatch(responseText, data, audienceStr);

    } catch (e) {
      if (this.isDebug) console.warn("[Director] Writing Failed, Using Fallback.");
      this.dispatchFallback(data);
    }
  }

  private parseAndDispatch(aiText: string, brief: any, audStr: string) {
    let pacing = "Casual";
    let anchorInstr = brief.topic.hostAngle;
    let coHostInstr = brief.topic.coHostAngle;
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

    let fullContext = `Topic: ${brief.topic.headline}. ${brief.topic.body}. Spin: ${brief.formatSpin}. ${audStr}`;

    if (brief.segmentType === BroadcastSegment.AUDIENCE) {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        fullContext = `Q&A. ${audStr}. Question: "${q}"`;
        pacing = "Relaxed";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
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
    });
  }

  private dispatchFallback(brief: any) {
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: brief.segmentType,
      topicID: brief.topic.id,
      headline: brief.topic.headline,
      context: brief.topic.body,
      hostInstructions: brief.topic.hostAngle || "Discuss topic.",
      coHostInstructions: brief.topic.coHostAngle || "React.",
      hostStance: "Neutral",
      coHostStance: "Neutral",
      duration: brief.duration,
      pacingStyle: "Casual"
    });
  }
}

Component.register(StationDirector);