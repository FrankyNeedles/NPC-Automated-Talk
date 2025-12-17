// PromptScheduler.ts
/**
 * PromptScheduler.ts
 * The Decision Engine.
 * Orchestrates the "Vortex" cycle and builds prompts using Memory + Assembler.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';
import { PromptAssembler } from './PromptAssembler';
import { TOPIC_DATA } from './TopicsDatabase';
import { NarrativeToken } from './NarrativeToken';

const StreamerPromptEvent = new NetworkEvent<{ prompt: string; meta?: any }>('StreamerPromptEvent');

const VORTEX_SEQUENCE = ['INTRO', 'ACTION', 'ENGAGEMENT', 'RANT', 'CHILL', 'TRANSITION'];

export class PromptScheduler extends Component<typeof PromptScheduler> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, default: null }, 
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private stateIndex: number = 0;
  private continuityKeys: string[] = []; 
  private memory: SmartNpcMemory | undefined;
  
  // Local cache for debug flag to prevent access errors during external calls
  private isDebug: boolean = false;

  start() {
    // 1. Cache Debug Flag
    this.isDebug = this.props.debugMode;

    // 2. Connect to Memory
    // (Using 'as any' casts to bypass strict type checking on custom components)
    if (this.props.memoryEntity) {
      const busEnt = this.props.memoryEntity as Entity;
      this.memory = busEnt.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    if (!this.memory && this.isDebug) {
      console.warn('[PromptScheduler] SmartNpcMemory not found! Facts will be ignored.');
    }
  }

  /**
   * Main Logic Loop (The Beat)
   * Called by StreamerAutopilot every ~20 seconds.
   */
  public executeBeat() {
    // 1. Advance Vortex State
    this.stateIndex = (this.stateIndex + 1) % VORTEX_SEQUENCE.length;
    const currentSegment = VORTEX_SEQUENCE[this.stateIndex];

    // 2. Gather Context from Memory
    let context = { roomVibe: "Chill", playerCount: 0, recentFacts: [], recentChat: [], studioAudience: [] };
    
    if (this.memory) {
      context = this.memory.getContextSnapshot() as any;
    }

    // 3. Pick a Topic
    const topicObj = TOPIC_DATA[Math.floor(Math.random() * TOPIC_DATA.length)];
    
    // 4. Construct the Prompt Package
    // Safety check: ensure audience array exists
    const audienceList = context.studioAudience || [];

    const pkg = {
      segment: currentSegment,
      topic: topicObj.label,
      facts: context.recentFacts,
      roomVibe: context.roomVibe,
      playerCount: context.playerCount,
      recentChat: context.recentChat,
      studioAudience: audienceList,
      energy: "medium",
      lengthTarget: "20-30 words",
      continuityKeys: this.continuityKeys
    };

    // 5. Assemble Final Text
    const result = PromptAssembler.assemble(pkg as any); 
    this.updateContinuity(result.promptText);

    if (this.isDebug) {
      console.log(`[PromptScheduler] Beat: ${currentSegment} | Vibe: ${context.roomVibe} | Audience: ${audienceList.length}`);
    }
    
    // 6. Send to NPC
    this.sendNetworkBroadcastEvent(StreamerPromptEvent, { 
      prompt: result.promptText, 
      meta: result.meta 
    });
  }

  /**
   * Called when a player types directly to the Streamer.
   */
  public handleChatInterrupt(user: string, text: string) {
    const currentSegment = VORTEX_SEQUENCE[this.stateIndex];

    // If Ranting, ignore direct replies (simulates focus)
    if (currentSegment === "RANT") {
        if (this.isDebug) console.log('[Scheduler] Ignoring chat during RANT.');
        return false; 
    }

    const prompt = 
      `ROLE: Streamer. SEGMENT: ${currentSegment}. INTERRUPT.\n` +
      `USER '${user}' SAYS: "${text}"\n` +
      `INSTRUCTIONS: Reply directly to this user. Be witty.\n` +
      `OUTPUT: Dialogue only.`;

    this.sendNetworkBroadcastEvent(StreamerPromptEvent, { 
      prompt: prompt, 
      meta: { type: 'reply', user } 
    });
    return true; 
  }

  private updateContinuity(text: string) {
    this.continuityKeys.push(text.substring(0, 20));
    if (this.continuityKeys.length > 5) this.continuityKeys.shift();
  }
}

Component.register(PromptScheduler);