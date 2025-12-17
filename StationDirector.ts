// StationDirector.ts
/**
 * StationDirector.ts
 * The "AI Producer" (Hidden NPC).
 * 
 * UPGRADE: Uses a Hidden NPC to "Think".
 * 1. Feeds News + Vibe into the Director NPC's AI.
 * 2. Director NPC outputs a structured plan (Topic, Angles).
 * 3. Script parses the plan and Cues the Actors.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; // Now uses NPC API
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

  async start() {
    // 1. Get the NPC Component (This script must be on a Hidden NPC)
    this.directorNPC = this.entity.as(Npc);
    
    if (!this.directorNPC) {
      console.error("[StationDirector] CRITICAL: Must be attached to an NPC entity to use AI Parsing!");
    }

    // 2. Link Memory
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }
  }

  /**
   * THE AI PLANNING STEP
   */
  public async planNextSegment() {
    if (!this.directorNPC) return;

    // 1. Advance Clock
    this.currentVortexState = VortexMath.getNextState(this.currentVortexState);
    const segmentLabel = VortexMath.getSegmentLabel(this.currentVortexState);

    // 2. Get Context
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    
    // 3. Prepare the "Producer Prompt"
    // We give the AI the list of headlines and the vibe, and ask for a decision.
    const availableStories = NEWS_WIRE.map(s => `ID: ${s.id} | Headline: "${s.headline}" (${s.category})`).join('\n');
    
    const systemPrompt = 
      `ACT AS: A TV Show Producer.\n` +
      `CONTEXT: We are live. The studio vibe is currently: ${roomVibe}.\n` +
      `CURRENT SEGMENT FORMAT: ${segmentLabel}.\n` +
      `AVAILABLE STORIES:\n${availableStories}\n` +
      `TASK: Select the BEST story for this vibe/segment. Then give specific stage directions to the Anchor and Co-Host.\n` +
      `OUTPUT FORMAT (Strict): \n` +
      `SELECTED_ID: [Insert ID here]\n` +
      `ANCHOR_DIR: [Instruction for Anchor]\n` +
      `COHOST_DIR: [Instruction for Co-Host]`;

    if (this.props.debugMode) console.log(`[Director] Asking AI Producer to plan ${segmentLabel}...`);

    try {
      // 4. CALL THE AI (The Thinking Step)
      // Check if AI is available
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.fallbackPlan(segmentLabel); // AI offline
        return;
      }

      // "ElicitResponse" makes the hidden NPC generate the text.
      // Since it's hidden, players won't see it, but we get the string back.
      const response = await this.directorNPC.conversation.elicitResponse(systemPrompt);
      
      // 5. Parse the AI's Output
      // The response might be a string or object depending on SDK version
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.parseAndCue(responseText, segmentLabel);

    } catch (e) {
      console.warn("[Director] AI Error, using fallback.", e);
      this.fallbackPlan(segmentLabel);
    }
  }

  /**
   * Parser: extracting logic from the AI's text response
   */
  private parseAndCue(aiText: string, segment: string) {
    if (this.props.debugMode) console.log(`[Director] AI Plan: ${aiText}`);

    // Default Fallbacks
    let selectedID = NEWS_WIRE[0].id;
    let anchorInstr = "Introduce the story.";
    let coHostInstr = "React to the story.";

    // Regex Parsing
    const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (idMatch) selectedID = idMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    // Find the full story object
    const story = NEWS_WIRE.find(s => s.id === selectedID) || NEWS_WIRE[0];

    // Build the Context Payload
    let contextData = `Full Story: ${story.body}`;
    
    // Special handling for Audience/StationID segments (override story logic)
    if (segment === BroadcastSegment.AUDIENCE) {
       contextData = "Audience Q&A Session.";
       anchorInstr = "Take questions from the floor.";
       coHostInstr = "Welcome the guests.";
    }

    // 6. Send the Cue
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
      segment: segment,
      topicID: story.id,
      headline: story.headline,
      context: contextData,
      hostInstructions: anchorInstr,
      coHostInstructions: coHostInstr
    });
  }

  /**
   * Simple non-AI fallback if the service is down
   */
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