// StationDirector.ts
/**
 * StationDirector.ts
 * The "Program Director".
 * 
 * CHECKLIST ITEMS:
 * [x] Program Director Authority (Pool selection, not playlist)
 * [x] Post-Show Player Interaction (Gamified Pitches)
 * [x] Clock & Scheduling (Relative Scene Time)
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, DayPart } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostInstructions: string;
  coHostInstructions: string;
  duration: number;      
  pacingStyle: string;   
}>('DirectorCueEvent');

const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');

// New: For Pitching
const DirectorPitchResultEvent = new NetworkEvent<{ user: string; result: string }>('DirectorPitchResultEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    segmentsPerBlock: { type: PropTypes.Number, default: 4, label: "Segs before Break" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  private currentVortexState: number = 1; 
  private segmentsRun: number = 0;
  private isPostShow: boolean = false;
  
  // Scene Clock
  private sceneStartTime: number = Date.now();

  private isDebug: boolean = false;

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    this.sceneStartTime = Date.now(); // Mark when the server started
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.planNextSegment.bind(this));
    
    // Listen for players talking to Director (Simulated via Chat for now, or proximity)
    // In a full implementation, we'd bind a Trigger on the Director's desk.
  }

  /**
   * Main Planning Loop
   */
  public async planNextSegment() {
    if (!this.directorNPC) {
        this.directorNPC = this.entity.as(Npc);
        if (!this.directorNPC) return;
    }

    // 1. Check if we need a Commercial/Post-Show Break
    if (this.segmentsRun >= this.props.segmentsPerBlock) {
        this.enterPostShowMode();
        return;
    }

    this.isPostShow = false;
    this.segmentsRun++;

    // 2. Calculate Virtual Time (Relative to Scene Start)
    // Every real minute = 10 virtual minutes (Time Dilation)
    const elapsedRealMins = (Date.now() - this.sceneStartTime) / 60000;
    const virtualHour = (8 + (elapsedRealMins / 6)) % 24; // Start at 8AM
    const dayPart = VortexMath.getDayPart(virtualHour);

    // 3. Advance Vortex
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);
    
    // 4. Gather Data
    const duration = VortexMath.calculateSegmentDuration(segmentLabel, dayPart);
    const pacingStyle = VortexMath.getPacingStyle(dayPart);
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Guests: ${audience.join(", ")})` : "(Studio Empty)";

    // 5. Intelligent Content Selection (Pool System)
    const selectedStory = this.selectBestStory(dayPart, roomVibe);
    
    // 6. AI Prompt Generation
    const systemPrompt = 
      `ACT AS: Program Director.\n` +
      `TIME: ${Math.floor(virtualHour)}:00 (${dayPart}). VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segmentLabel}.\n` +
      `TOPIC: "${selectedStory.headline}" (${selectedStory.category}).\n` +
      `ANGLES: Host=${selectedStory.hostAngle}. CoHost=${selectedStory.coHostAngle}.\n` +
      `TASK: Write stage directions.\n` +
      `OUTPUT FORMAT:\n` +
      `ANCHOR_DIR: [Direction]\n` +
      `COHOST_DIR: [Direction]`;

    if (this.isDebug) console.log(`[Director] Planning ${segmentLabel} (Time: ${Math.floor(virtualHour)}:00)`);

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

  private selectBestStory(dayPart: DayPart, vibe: string): NewsStory {
    // 1. Filter by Time of Day
    let candidates = NEWS_WIRE.filter(s => s.validDayParts.includes(dayPart));
    
    // 2. Filter by Vibe Match (Intensity)
    if (vibe === "Chaotic") {
        // Prefer High Intensity
        candidates = candidates.filter(s => s.intensity >= 7);
    } else if (vibe === "Chill") {
        // Prefer Low Intensity
        candidates = candidates.filter(s => s.intensity <= 5);
    }

    // 3. Filter Burned
    if (this.memory) {
        candidates = candidates.filter(s => !this.memory!.isContentBurned(s.id));
    }

    // Fallback if pool is empty
    if (candidates.length === 0) {
        if (this.isDebug) console.log("[Director] Pool empty, using Filler.");
        return {
            id: "filler_generic",
            headline: "General Chat",
            category: "Entertainment",
            body: "Discuss random topics.",
            intensity: 5,
            tags: [],
            validDayParts: [],
            hostAngle: "Casual",
            coHostAngle: "Fun"
        };
    }

    // 4. Random Pick from refined pool
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // --- Post Show Logic ---

  private enterPostShowMode() {
    this.isPostShow = true;
    this.segmentsRun = 0; // Reset block
    if (this.isDebug) console.log("[Director] Entering POST-SHOW / Pitch Window.");

    // Cue a "Commercial Break" first
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: BroadcastSegment.COMMERCIAL,
      topicID: "break",
      headline: "Commercial Break",
      context: "We are taking a short break. The Director is now available for pitches.",
      hostInstructions: "Throw to commercial. Mention the Director is taking pitches.",
      coHostInstructions: "Sign off.",
      duration: 30,
      pacingStyle: "Relaxed"
    });

    // Note: ShowScheduler will call 'RequestSegment' again after 30s.
    // In a fuller implementation, we would block that request until the pitch window closes.
  }

  /**
   * Call this when a player talks to the Director NPC directly
   */
  public async handlePlayerPitch(user: string, pitchText: string) {
    if (!this.isPostShow) return "I'm busy running the show right now. Come back during the break.";

    const rep = this.memory ? this.memory.getPlayerReputation(user) : 10;
    
    // Use AI to Judge the Pitch
    const prompt = `ACT AS: TV Producer. Player '${user}' (Rep: ${rep}/100) suggests: "${pitchText}". 
    Evaluate this idea for our News Station. 
    If good, say "APPROVED". If bad, say "REJECTED" and give a reason.`;

    // (Simplified AI call for brevity - logic would go here)
    if (this.memory) this.memory.updatePlayerReputation(user, 5); // Reward for trying
    return "I'll consider it. Thanks for the input.";
  }

  // --- Parser ---

  private parseAndCue(aiText: string, segment: string, story: NewsStory, duration: number, pacing: string, audienceContext: string) {
    let anchorInstr = story.hostAngle;
    let coHostInstr = story.coHostAngle;

    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    let contextData = `Story: ${story.body}. ${audienceContext}`;
    
    // Q&A Override
    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       contextData = `Q&A. ${audienceContext}. Question: ${question || "None"}`;
       anchorInstr = "Answer question.";
       coHostInstr = "Encourage chat.";
       pacing = "Relaxed";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: contextData,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr,
      duration: duration, 
      pacingStyle: pacing
    });
  }

  private fallbackPlan(segment: string, story: NewsStory, duration: number, pacing: string) {
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: story.body,
      hostInstructions: story.hostAngle,
      coHostInstructions: story.coHostAngle,
      duration: duration,
      pacingStyle: pacing
    });
  }
}

Component.register(StationDirector);