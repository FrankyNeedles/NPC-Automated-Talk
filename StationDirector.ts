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

const DirectorBriefEvent = new NetworkEvent<{ 
  segmentType: string;
  topic: any;
  formatSpin: string; 
  duration: number;
}>('DirectorBriefEvent');

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
        console.error("[StationDirector] CRITICAL: Must be attached to a Hidden NPC.");
    }

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorBriefEvent, this.handleCreativeBrief.bind(this));
  }

  private async handleCreativeBrief(data: { segmentType: string; topic: any; formatSpin: string; duration: number }) {
    if (!this.directorNPC) return;

    if (this.isDebug) console.log(`[Director] Writing Script: ${data.topic.headline} (${data.formatSpin})`);

    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests in Studio: ${aud.join(", ")}` : "(Studio Empty)";

    const systemPrompt = 
      `ACT AS: Lead Writer for a TV Show.\n` +
      `FORMAT: ${data.segmentType}. ANGLE: ${data.formatSpin}. ${audienceStr}.\n` +
      `TOPIC: "${data.topic.headline}" (${data.topic.body})\n` +
      `TASK: Write Stage Directions for HOST A (Anchor) and HOST B (Co-Host).\n` +
      `REQUIREMENTS:\n` +
      `1. STRUCTURE: Create a mini-arc. Start with a Hook, move to Conflict/Discussion, end with a Punchline/Insight.\n` +
      `2. RELATIONSHIP: They must react to each other, not just read lines.\n` +
      `3. DEPTH: Do not stay surface level. Dig into the 'Why' of the topic.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ANCHOR_STANCE: [Specific Opinion]\n` +
      `COHOST_STANCE: [Opposing/Complementary Opinion]\n` +
      `ANCHOR_DIR: [Step-by-step direction on how to lead the arc]\n` +
      `COHOST_DIR: [Step-by-step direction on how to react/escalate]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.dispatchFallback(data);
        return;
      }

      const timeoutPromise = new Promise((_, reject) => 
        this.async.setTimeout(() => reject(new Error("Timeout")), 15000)
      );
      
      const response = await Promise.race([
          this.directorNPC.conversation.elicitResponse(systemPrompt),
          timeoutPromise
      ]);
      
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndDispatch(responseText, data, audienceStr);

    } catch (e) {
      if (this.isDebug) console.warn("[Director] Writing Failed:", e);
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

    // FIX: Changed 'const' to 'let' so we can reassign it below
    let fullContext = `Topic: ${brief.topic.headline}. ${brief.topic.body}. Spin: ${brief.formatSpin}. ${audStr}`;

    if (brief.segmentType === BroadcastSegment.AUDIENCE) {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        fullContext = `Q&A. ${audStr}. Question: "${q}"`;
        anchorInstr = "Answer question.";
        coHostInstr = "Engage.";
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