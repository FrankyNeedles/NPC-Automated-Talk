// PromptScheduler.ts
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
  
  // FIX 1: Cache the debug flag locally to avoid 'undefined' errors during external calls
  private isDebug: boolean = false;

  start() {
    // FIX 2: Store the prop value immediately
    this.isDebug = this.props.debugMode;

    if (this.props.memoryEntity) {
      const busEnt = this.props.memoryEntity as Entity;
      this.memory = busEnt.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }
  }

  public executeBeat() {
    this.stateIndex = (this.stateIndex + 1) % VORTEX_SEQUENCE.length;
    const currentSegment = VORTEX_SEQUENCE[this.stateIndex];

    let context = { roomVibe: "Chill", playerCount: 0, recentFacts: [], recentChat: [], studioAudience: [] };
    
    if (this.memory) {
      context = this.memory.getContextSnapshot() as any;
    }

    const topicObj = TOPIC_DATA[Math.floor(Math.random() * TOPIC_DATA.length)];
    
    // Safety check for audience array
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

    const result = PromptAssembler.assemble(pkg as any); 
    this.updateContinuity(result.promptText);

    // FIX 3: Use the cached 'this.isDebug' instead of 'this.props.debugMode'
    if (this.isDebug) {
      console.log(`[PromptScheduler] Beat: ${currentSegment} | Audience: ${audienceList.length}`);
    }
    
    this.sendNetworkBroadcastEvent(StreamerPromptEvent, { 
      prompt: result.promptText, 
      meta: result.meta 
    });
  }

  public handleChatInterrupt(user: string, text: string) {
    const currentSegment = VORTEX_SEQUENCE[this.stateIndex];
    if (currentSegment === "RANT") return false; 

    const prompt = 
      `ROLE: Streamer. SEGMENT: ${currentSegment}. INTERRUPT.\n` +
      `USER '${user}' SAYS: "${text}"\n` +
      `INSTRUCTIONS: Reply directly to this user.\n`;

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