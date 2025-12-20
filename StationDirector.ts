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