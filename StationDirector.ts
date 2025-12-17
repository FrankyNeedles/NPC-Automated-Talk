// StationDirector.ts
/**
 * StationDirector.ts
 * The "Producer" of the Broadcast.
 * 
 * UPDATE: Passes Audience Context to ALL segments so hosts can make
 * small, passive references without stopping the show.
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
}>('DirectorCueEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  private currentVortexState: number = 1; 
  private recentTopicIDs: string[] = [];

  async start() {
    this.directorNPC = this.entity.as(Npc);
    if (!this.directorNPC) console.error("[StationDirector] CRITICAL: Attach to Hidden NPC!");

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }
  }

  public async planNextSegment() {
    if (!this.directorNPC) return;

    // 1. Advance Clock
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);

    // 2. Get Global Context (Vibe & Audience)
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    
    // NEW: Get Audience List for Background Context
    const audience = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = audience.length > 0 ? `(Studio Guests: ${audience.join(", ")})` : "(Studio Empty)";

    // 3. Prepare AI Prompt
    // We include the audience string in the CONTEXT section for the AI
    const availableStories = NEWS_WIRE.filter(s => !this.recentTopicIDs.includes(s.id))
        .map(s => `ID: ${s.id} | Headline: "${s.headline}" (${s.category})`).join('\n');
    
    const systemPrompt = 
      `ACT AS: A TV Show Producer.\n` +
      `CONTEXT: Live Broadcast. Vibe: ${roomVibe}. ${audienceStr}.\n` +
      `CURRENT SEGMENT: ${segmentLabel}.\n` +
      `AVAILABLE STORIES:\n${availableStories}\n` +
      `TASK: Select the BEST story. Write stage directions.\n` +
      `NOTE: If Studio Guests are present, you may instruct hosts to briefly acknowledge them, but DO NOT stop the news flow.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: [ID]\n` +
      `ANCHOR_DIR: [Instruction]\n` +
      `COHOST_DIR: [Instruction]`;

    if (this.props.debugMode) console.log(`[Director] Planning ${segmentLabel}...`);

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(segmentLabel);
        return;
      }

      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel, audienceStr); // Pass audience string down

    } catch (e) {
      console.warn("[Director] AI Error", e);
      this.fallbackPlan(segmentLabel);
    }
  }

  private parseAndCue(aiText: string, segment: string, audienceContext: string) {
    let selectedID = NEWS_WIRE[0].id;
    let anchorInstr = "Introduce the story.";
    let coHostInstr = "React to the story.";

    const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (idMatch) selectedID = idMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    this.recentTopicIDs.push(selectedID);
    if (this.recentTopicIDs.length > 4) this.recentTopicIDs.shift();

    const story = NEWS_WIRE.find(s => s.id === selectedID) || NEWS_WIRE[0];

    // Build Context Payload
    // We append the audience info here so the Hosts actually see it in their prompts
    let contextData = `Story: ${story.body}. ${audienceContext}`;
    
    if (segment === BroadcastSegment.AUDIENCE) {
       const question = this.memory ? this.memory.getLatestChatQuestion() : "";
       contextData = `Q&A Session. ${audienceContext}. Question: ${question || "None"}`;
       anchorInstr = "Answer the question or welcome the guests.";
       coHostInstr = "Encourage the chat.";
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