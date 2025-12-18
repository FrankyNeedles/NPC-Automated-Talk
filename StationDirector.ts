// StationDirector.ts
/**
 * StationDirector.ts
 * The "Creative Producer".
 * 
 * UPGRADE: Name Agnostic.
 * - Generates cues for "HOST_A" and "HOST_B".
 * - Allows Scene Creator to name NPCs whatever they want.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostStance: string;   
  coHostStance: string; 
  duration: number;
  pacingStyle: string;
}>('DirectorCueEvent');

const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  private currentVortexState: number = 1; 
  private recentTopicIDs: string[] = [];
  private showHour: number = 12; 
  private isDebug: boolean = false;

  private readonly ANGLES = [
    "Heated Debate", "Mystery/Conspiracy", "Comedy/Mockery", 
    "Nostalgia", "Future Hype", "Skeptical vs. Believer"
  ];

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.planNextSegment.bind(this));
  }

  public async planNextSegment() {
    if (!this.directorNPC) {
        this.directorNPC = this.entity.as(Npc);
        if (!this.directorNPC) return;
    }

    const now = new Date();
    this.showHour = now.getHours();
    const dayPart = VortexMath.getDayPart(this.showHour);

    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);
    const duration = VortexMath.calculateSegmentDuration(segmentLabel, dayPart);
    const pacingStyle = VortexMath.getPacingStyle(dayPart);

    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Guests: ${audience.join(", ")})` : "(Studio Empty)";

    const angle = this.ANGLES[Math.floor(Math.random() * this.ANGLES.length)];
    const selectedStory = this.selectBestStory(dayPart, roomVibe);
    
    // UPDATED PROMPT: Generic Roles
    const systemPrompt = 
      `ACT AS: TV Showrunner.\n` +
      `CONTEXT: Live. Vibe: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segmentLabel}.\n` +
      `TOPIC: "${selectedStory.headline}"\n` +
      `CREATIVE ANGLE: ${angle}.\n` +
      `MANDATE: Assign OPPOSING STANCES to Host A (Anchor) and Host B (Co-Host).\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: ${selectedStory.id}\n` +
      `HOST_A_DIR: [Specific stance/emotion for Anchor]\n` +
      `HOST_B_DIR: [Specific stance/emotion for Co-Host]`;

    if (this.isDebug) console.log(`[Director] Planning: ${selectedStory.headline} (${angle})`);

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(segmentLabel, selectedStory, duration, pacingStyle);
        return;
      }

      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel, selectedStory, duration, pacingStyle, audienceStr);

    } catch (e) {
      console.warn("[Director] AI Error", e);
      this.fallbackPlan(segmentLabel, selectedStory, duration, pacingStyle);
    }
  }

  // --- Logic Helpers ---

  private selectBestStory(dayPart: any, vibe: string): any {
    let candidates = NEWS_WIRE.filter(s => s.validDayParts.includes(dayPart));
    if (this.memory) candidates = candidates.filter(s => !this.memory!.isContentBurned(s.id));

    if (candidates.length === 0) {
        const filler = FILLER_POOL[Math.floor(Math.random() * FILLER_POOL.length)];
        return {
            id: "filler_" + Date.now(),
            headline: filler.topic,
            category: "Random",
            body: `Subject: ${filler.topic}.`,
            hostAngle: "Opinionated.",
            coHostAngle: "Contrarian."
        };
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private parseAndCue(aiText: string, segment: string, story: any, duration: number, pacing: string, audienceContext: string) {
    let hostStance = story.hostAngle;
    let coHostStance = story.coHostAngle;

    // UPDATED REGEX: Generic Matches
    const anchorMatch = aiText.match(/HOST_A_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/HOST_B_DIR:\s*(.*)/);

    if (anchorMatch) hostStance = anchorMatch[1];
    if (cohostMatch) coHostStance = cohostMatch[1];

    if (this.memory && story.id && !story.id.startsWith("filler")) this.memory.markContentAsUsed(story.id);

    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       audienceContext = `Question: ${question || "None"}`;
       hostStance = "Answer the question professionally.";
       coHostStance = "Add a personal joke about the question.";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: `Topic: ${story.body}. ${audienceContext}`,
      hostStance: hostStance,
      coHostStance: coHostStance,
      duration: duration,
      pacingStyle: pacing
    });
  }

  private fallbackPlan(segment: string, story: any, duration: number, pacing: string) {
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: story.body,
      hostStance: "Introduce topic.",
      coHostStance: "React.",
      duration: duration,
      pacingStyle: pacing
    });
  }
}

Component.register(StationDirector);