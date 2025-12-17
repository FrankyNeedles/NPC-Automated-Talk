// StationDirector.ts
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
  
  // Real-Time Tracking
  private showHour: number = 12; 

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

    // 1. Get REAL Time
    // This syncs the show to the server's local clock
    const now = new Date();
    this.showHour = now.getHours();
    const dayPart = this.getDayPart(this.showHour);

    // 2. Advance Vortex
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);
    
    // 3. Calculate Params
    const duration = VortexMath.calculateSegmentDuration(segmentLabel);
    
    // 4. Context
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Guests: ${audience.join(", ")})` : "(Studio Empty)";

    // 5. Select Stories
    const relevantStories = this.getStoriesForDayPart(dayPart);
    const availableStories = relevantStories.filter(s => !this.recentTopicIDs.includes(s.id))
        .map(s => `ID: ${s.id} | "${s.headline}" (${s.category} - Intensity ${s.intensity})`).join('\n');
    
    const systemPrompt = 
      `ACT AS: Program Director for ATS TV.\n` +
      `TIME: ${now.toLocaleTimeString()} (${dayPart}). VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segmentLabel}.\n` +
      `WIRE:\n${availableStories}\n` +
      `TASK: Schedule the next ${duration}s block.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: [ID]\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ALEX_DIR: [Direction]\n` +
      `CASEY_DIR: [Direction]`;

    if (this.isDebug) console.log(`[Director] Planning ${dayPart} (${segmentLabel})...`);

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(segmentLabel, duration, "AI Offline");
        return;
      }

      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel, duration, audienceStr);

    } catch (e) {
      // Better error logging
      const errMsg = e instanceof Error ? e.message : String(e);
      if (this.isDebug) console.warn(`[Director] AI Failed: ${errMsg}`);
      
      // INSTANT FALLBACK to keep show moving
      this.fallbackPlan(segmentLabel, duration, "Technical Difficulties");
    }
  }

  private parseAndCue(aiText: string, segment: string, duration: number, audienceContext: string) {
    let selectedID = NEWS_WIRE[0].id;
    let anchorInstr = "Introduce story.";
    let coHostInstr = "React.";
    let pacing = "Casual";

    const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
    const paceMatch = aiText.match(/PACING:\s*(\w+)/);
    const anchorMatch = aiText.match(/ALEX_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/CASEY_DIR:\s*(.*)/);

    if (idMatch) selectedID = idMatch[1];
    if (paceMatch) pacing = paceMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    this.recentTopicIDs.push(selectedID);
    if (this.recentTopicIDs.length > 4) this.recentTopicIDs.shift();

    const story = NEWS_WIRE.find(s => s.id === selectedID) || NEWS_WIRE[0];
    let contextData = `Story: ${story.body}. ${audienceContext}`;
    
    // Q&A Override
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
      duration: duration, 
      pacingStyle: pacing
    });
  }

  // --- Helpers ---

  private getDayPart(hour: number): string {
    if (hour >= 5 && hour < 11) return "Morning Show";
    if (hour >= 11 && hour < 17) return "Mid-Day";
    if (hour >= 17 && hour < 22) return "Prime Time";
    return "Late Night"; // 10pm to 5am
  }

  private getStoriesForDayPart(dayPart: string): any[] {
    if (dayPart === "Morning Show") return NEWS_WIRE.filter(s => s.intensity <= 6); 
    if (dayPart === "Prime Time") return NEWS_WIRE.filter(s => s.intensity >= 6); 
    return NEWS_WIRE; 
  }

  private fallbackPlan(segment: string, duration: number, reason: string) {
    if (this.isDebug) console.log(`[Director] Executing Fallback (${reason})`);
    const story = NEWS_WIRE[0]; // Default story
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: story.body,
      hostInstructions: "Apologize for technical glitch.",
      coHostInstructions: "Make a joke about the server.",
      duration: duration,
      pacingStyle: "Casual"
    });
  }
}

Component.register(StationDirector);