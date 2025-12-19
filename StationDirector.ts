// StationDirector.ts
/**
 * StationDirector.ts
 * The "Executive Producer".
 * 
 * UPGRADE: "Showrunner Engine"
 * - Plans full Episodes (Stacks of segments) based on Show Type.
 * - Monitors Real-Time Ratings to pivot strategy mid-show.
 * - Supports Games, Debates, and News blocks.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, ShowType } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  
  // Show State
  private currentShowType: ShowType = ShowType.VARIETY;
  private segmentQueue: BroadcastSegment[] = [];
  private showHour: number = 12; 
  private recentTopicIDs: string[] = [];
  private isDebug: boolean = false;

  // Real-Time Stats
  private lastAudienceCount: number = 0;

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.handleSegmentRequest.bind(this));
  }

  public async handleSegmentRequest() {
    if (!this.directorNPC) {
        this.directorNPC = this.entity.as(Npc);
        if (!this.directorNPC) return;
    }

    // 1. UPDATE CLOCK & AUDIENCE
    const now = new Date();
    this.showHour = now.getHours();
    const dayPart = VortexMath.getDayPart(this.showHour);
    
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const currentCount = audience.length;
    const audienceStr = currentCount > 0 ? `(Guests: ${audience.join(", ")})` : "(Studio Empty)";

    // 2. RATINGS CHECK (The "Panic" Logic)
    let ratingsAlert = "";
    if (currentCount < this.lastAudienceCount && currentCount === 0) {
        ratingsAlert = "RATINGS CRASH. Audience left. Switch format immediately to something controversial or loud.";
        // Wipe queue to force a pivot
        this.segmentQueue = []; 
    }
    this.lastAudienceCount = currentCount;

    // 3. EPISODE MANAGEMENT
    // If queue is empty, plan a new "Episode"
    if (this.segmentQueue.length === 0) {
        this.planNewEpisode(dayPart);
    }

    // Pop the next segment from the stack
    const nextSegment = this.segmentQueue.shift() || BroadcastSegment.BANTER;
    
    // 4. PLAN THE SEGMENT
    const duration = VortexMath.calculateSegmentDuration(nextSegment, dayPart);
    const pacingStyle = VortexMath.getPacingStyle(dayPart, this.currentShowType);
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";

    // Select Story Logic
    const selectedStory = this.selectBestStory(dayPart, roomVibe, nextSegment);
    
    // AI Prompt Construction
    const systemPrompt = 
      `ACT AS: Executive Producer for '${this.currentShowType}'.\n` +
      `TIME: ${dayPart}. VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${nextSegment}.\n` +
      `TOPIC: "${selectedStory.headline}"\n` +
      `RATINGS ALERT: ${ratingsAlert}\n` +
      `TASK: Direct the Hosts. Make it fit the '${this.currentShowType}' format.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: ${selectedStory.id}\n` +
      `ANCHOR_DIR: [Direction]\n` +
      `COHOST_DIR: [Direction]`;

    if (this.isDebug) console.log(`[Director] Planning ${nextSegment} for ${this.currentShowType}`);

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(nextSegment, selectedStory, duration, pacingStyle);
        return;
      }

      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, nextSegment, selectedStory, duration, pacingStyle, audienceStr);

    } catch (e) {
      console.warn("[Director] AI Error", e);
      this.fallbackPlan(nextSegment, selectedStory, duration, pacingStyle);
    }
  }

  // --- Episode Planner ---

  private planNewEpisode(dayPart: any) {
    // Pick a Show Type based on Time
    if (dayPart === "Morning Show") this.currentShowType = Math.random() > 0.5 ? ShowType.MORNING_ZOO : ShowType.NEWS_HOUR;
    else if (dayPart === "Prime Time") this.currentShowType = Math.random() > 0.5 ? ShowType.THE_DEBATE : ShowType.VARIETY;
    else if (dayPart === "Late Night") this.currentShowType = ShowType.LATE_NIGHT;
    else this.currentShowType = ShowType.VARIETY;

    // Build the Stack
    this.segmentQueue = [
        BroadcastSegment.STATION_ID, // Intro
        BroadcastSegment.HEADLINES,  // Setup
        BroadcastSegment.DEEP_DIVE,  // Main Content
        BroadcastSegment.BANTER,     // Cool down
        BroadcastSegment.COMMERCIAL  // Outro
    ];

    if (this.currentShowType === ShowType.MORNING_ZOO) {
        // Swap Deep Dive for Game Show
        this.segmentQueue[2] = BroadcastSegment.GAME_SHOW;
    }

    if (this.isDebug) console.log(`[Director] New Episode Scheduled: ${this.currentShowType}`);
  }

  // --- Helpers ---

  private selectBestStory(dayPart: any, vibe: string, segment: BroadcastSegment): any {
    // Logic for specific segments
    if (segment === BroadcastSegment.GAME_SHOW) {
        return {
            id: "game_trivia", headline: "Trivia Time!", category: "Fun",
            body: "Host A quizzes Host B on random facts.",
            hostAngle: "Quizmaster.", coHostAngle: "Guessing."
        };
    }

    let candidates = NEWS_WIRE.filter(s => s.validDayParts.includes(dayPart));
    if (this.memory) candidates = candidates.filter(s => !this.memory!.isContentBurned(s.id));

    // Desperation Mode (Ratings Crash)
    if (vibe === "Chaotic" || vibe === "Desperate") {
        const intense = NEWS_WIRE.filter(s => s.intensity >= 7);
        if (intense.length > 0) return intense[Math.floor(Math.random() * intense.length)];
    }

    if (candidates.length === 0) {
        const filler = FILLER_POOL[Math.floor(Math.random() * FILLER_POOL.length)];
        return {
            id: "filler_" + Date.now(), headline: filler.topic, category: "Random",
            body: `Subject: ${filler.topic}.`, hostAngle: "Bring it up.", coHostAngle: "React."
        };
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private parseAndCue(aiText: string, segment: string, story: any, duration: number, pacing: string, audienceContext: string) {
    let anchorInstr = story.hostAngle;
    let coHostInstr = story.coHostAngle;

    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    if (this.memory && story.id && !story.id.startsWith("filler") && !story.id.startsWith("game")) {
        this.memory.markContentAsUsed(story.id);
    }

    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       audienceContext = `Question: ${question || "None"}`;
       anchorInstr = "Answer question.";
       coHostInstr = "Engage.";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: `Format: ${this.currentShowType}. Story: ${story.body}. ${audienceContext}`,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr,
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
      hostInstructions: "Start topic.",
      coHostInstructions: "React.",
      duration: duration,
      pacingStyle: pacing
    });
  }
}

Component.register(StationDirector);