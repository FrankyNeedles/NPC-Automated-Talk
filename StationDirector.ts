// StationDirector.ts
/**
 * StationDirector.ts
 * The "Producer" (Hidden NPC).
 * 
 * UPDATE: Now listens for 'RequestSegmentEvent' instead of direct method calls.
 * This fixes the communication breakdown between the Brain and the NPC.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory } from './TopicsDatabase';
import { VortexMath, BroadcastSegment } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

// NEW: The "Start" Signal
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');

const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostInstructions: string;
  coHostInstructions: string;
}>('DirectorCueEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  private currentVortexState: number = 1; 
  private recentTopicIDs: string[] = [];
  
  private isDebug: boolean = false;

  async start() {
    this.isDebug = this.props.debugMode;

    // 1. Get NPC Reference
    this.directorNPC = this.entity.as(Npc);
    
    // 2. Link Memory
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    if (this.isDebug) console.log(`[Director] Online. Waiting for signal...`);

    // 3. LISTEN FOR THE SIGNAL (The Fix)
    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.planNextSegment.bind(this));
  }

  public async planNextSegment() {
    if (this.isDebug) console.log("[Director] Signal Received! Thinking...");

    // Safety: Ensure we have the NPC component
    if (!this.directorNPC) {
        this.directorNPC = this.entity.as(Npc);
    }
    if (!this.directorNPC) {
        console.error("[Director] CRITICAL: Script is not on an NPC.");
        return;
    }

    // Advance Clock
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);

    // Get Data
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Guests: ${audience.join(", ")})` : "(Empty)";

    // Prepare AI
    const availableStories = NEWS_WIRE.filter(s => !this.recentTopicIDs.includes(s.id))
        .map(s => `ID: ${s.id} | Headline: "${s.headline}" (${s.category})`).join('\n');
    
    const systemPrompt = 
      `ACT AS: TV Producer.\n` +
      `CONTEXT: Live. Vibe: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segmentLabel}.\n` +
      `STORIES:\n${availableStories}\n` +
      `TASK: Pick 1 story. Write directions.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: [ID]\n` +
      `ANCHOR_DIR: [Instruction]\n` +
      `COHOST_DIR: [Instruction]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        if (this.isDebug) console.log("[Director] AI Unavailable. Using Fallback.");
        this.fallbackPlan(segmentLabel);
        return;
      }

      // "Think" (Generate Text)
      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel, audienceStr);

    } catch (e) {
      console.warn("[Director] AI Error", e);
      this.fallbackPlan(segmentLabel);
    }
  }

  private parseAndCue(aiText: string, segment: string, audienceContext: string) {
    if (this.isDebug) console.log(`[Director] Plan Generated.`);

    let selectedID = NEWS_WIRE[0].id;
    let anchorInstr = "Introduce story.";
    let coHostInstr = "React.";

    const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (idMatch) selectedID = idMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    this.recentTopicIDs.push(selectedID);
    if (this.recentTopicIDs.length > 4) this.recentTopicIDs.shift();

    const story = NEWS_WIRE.find(s => s.id === selectedID) || NEWS_WIRE[0];
    let contextData = `Story: ${story.body}. ${audienceContext}`;
    
    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       contextData = `Q&A. ${audienceContext}. Question: ${question || "None"}`;
       anchorInstr = "Answer question/Welcome guests.";
       coHostInstr = "Encourage chat.";
    }

    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: contextData,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr
    });
  }

  private fallbackPlan(segment: string) {
    const story = NEWS_WIRE[0];
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: story.body,
      hostInstructions: story.hostAngle,
      coHostInstructions: story.coHostAngle
    });
  }
}

Component.register(StationDirector);