// StationDirector.ts
/**
 * StationDirector.ts
 * The "Program Director".
 * 
 * UPGRADE: Now manages the "Run of Show" dynamically.
 * - Calculates Duration based on content type.
 * - Simulates a "Day Cycle" (Morning/Prime Time) to change tone.
 * - Tells hosts the "Pacing Style" (Rapid vs Relaxed).
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory } from './TopicsDatabase';
import { VortexMath, BroadcastSegment } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostInstructions: string;
  coHostInstructions: string;
  duration: number;      // New: Logic controls time, not Inspector
  pacingStyle: string;   // New: "Rapid", "Relaxed", "Debate"
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
  
  // Simulated Show Clock (0-24)
  private showHour: number = 8; // Start at 8 AM Morning Show

  private isDebug: boolean = false;

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

    // 1. Advance Show Clock (Each segment adds ~30 virtual minutes)
    this.showHour = (this.showHour + 0.5) % 24;
    const dayPart = this.getDayPart(this.showHour);

    // 2. Advance Vortex Cycle
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);
    
    // 3. Calculate Timing & Style
    const duration = VortexMath.calculateSegmentDuration(segmentLabel);
    let pacingStyle = "Casual"; // Default

    // 4. Gather Context
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Studio Guests: ${audience.join(", ")})` : "(Studio Empty)";

    // 5. Filter Stories based on Day Part
    // Morning = Weather/Light; Prime Time = Politics/Drama
    const relevantStories = this.getStoriesForDayPart(dayPart);
    const availableStories = relevantStories.filter(s => !this.recentTopicIDs.includes(s.id))
        .map(s => `ID: ${s.id} | "${s.headline}" (${s.category} - Intensity ${s.intensity})`).join('\n');
    
    const systemPrompt = 
      `ACT AS: Program Director for ATS TV.\n` +
      `CURRENT TIME: ${dayPart} Block. VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT FORMAT: ${segmentLabel}.\n` +
      `AVAILABLE WIRE:\n${availableStories}\n` +
      `TASK: Schedule the next ${duration} seconds of programming.\n` +
      `GUIDELINES: Morning=Upbeat. Night=Serious/Debate. Chaotic Room=High Energy.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: [ID]\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ANCHOR_DIR: [Direction]\n` +
      `COHOST_DIR: [Direction]`;

    if (this.isDebug) console.log(`[Director] Planning ${dayPart} show (${segmentLabel})...`);

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(segmentLabel, duration);
        return;
      }

      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel, duration, audienceStr);

    } catch (e) {
      console.warn("[Director] AI Error", e);
      this.fallbackPlan(segmentLabel, duration);
    }
  }

  private parseAndCue(aiText: string, segment: string, duration: number, audienceContext: string) {
    let selectedID = NEWS_WIRE[0].id;
    let anchorInstr = "Introduce the story.";
    let coHostInstr = "React to the story.";
    let pacing = "Casual";

    const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
    const paceMatch = aiText.match(/PACING:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (idMatch) selectedID = idMatch[1];
    if (paceMatch) pacing = paceMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    this.recentTopicIDs.push(selectedID);
    if (this.recentTopicIDs.length > 4) this.recentTopicIDs.shift();

    const story = NEWS_WIRE.find(s => s.id === selectedID) || NEWS_WIRE[0];

    // Build Context
    let contextData = `Story: ${story.body}. ${audienceContext}`;
    
    // Segment Overrides
    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       contextData = `Q&A. ${audienceContext}. Question: ${question || "None"}`;
       anchorInstr = "Answer question.";
       coHostInstr = "Engage audience.";
       pacing = "Relaxed";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: contextData,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr,
      duration: duration, // LOGIC CONTROLLED
      pacingStyle: pacing
    });
  }

  // --- Helpers ---

  private getDayPart(hour: number): string {
    if (hour >= 6 && hour < 12) return "Morning Show";
    if (hour >= 12 && hour < 18) return "Afternoon Block";
    if (hour >= 18 && hour < 23) return "Prime Time";
    return "Late Night";
  }

  private getStoriesForDayPart(dayPart: string): any[] {
    // Filter news wire based on time of day
    if (dayPart === "Morning Show") return NEWS_WIRE.filter(s => s.intensity <= 6); // Lighter news
    if (dayPart === "Prime Time") return NEWS_WIRE.filter(s => s.intensity >= 6); // Heavy hitters
    return NEWS_WIRE; // All access
  }

  private fallbackPlan(segment: string, duration: number) {
    const story = NEWS_WIRE[0];
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: story.body,
      hostInstructions: story.hostAngle,
      coHostInstructions: story.coHostAngle,
      duration: duration,
      pacingStyle: "Casual"
    });
  }
}

Component.register(StationDirector);