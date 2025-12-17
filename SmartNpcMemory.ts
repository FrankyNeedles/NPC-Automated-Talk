// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * Stores Objects, Chat, Vibe, and LIVE AUDIENCE list.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatToBrainEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatToBrainEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    maxBufferSeconds: { type: PropTypes.Number, default: 45 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private tokenBuffer: NarrativeToken[] = [];
  private chatBuffer: { user: string; text: string; timestamp: number }[] = [];
  
  // Stats
  private playerCount: number = 0;
  private roomEnergy: string = "Chill";
  
  // NEW: Specific list of people in the Trigger Zone
  private studioAudience: string[] = [];

  start() {
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatToBrainEvent, this.handleChat.bind(this));
    this.async.setInterval(this.pruneMemory.bind(this), 5000);
  }

  // --- Audience Management ---
  public addStudioAudience(name: string) {
    if (!this.studioAudience.includes(name)) {
        this.studioAudience.push(name);
    }
  }

  public removeStudioAudience(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }

  public updateRoomStats(count: number, energyLabel: string) {
    this.playerCount = count;
    this.roomEnergy = energyLabel;
  }

  /**
   * Called by Scheduler to get the full picture
   */
  public getContextSnapshot() {
    return {
      roomVibe: this.roomEnergy,
      playerCount: this.playerCount,
      recentFacts: this.getRefinedFacts(3),
      recentChat: this.getRecentChat(2),
      studioAudience: [...this.studioAudience] // Send copy of list
    };
  }

  // --- Internals (Same as before) ---
  private handleObjectToken(payload: any) {
    const token = payload as NarrativeToken;
    if (!token || !token.id || token.importance < 0.2) return;

    const dupIdx = this.tokenBuffer.findIndex(t => 
      t.objectId === token.objectId && t.action === token.action && (token.timestamp - t.timestamp < 3000)
    );
    
    if (dupIdx !== -1) {
      this.tokenBuffer[dupIdx] = token; 
    } else {
      this.tokenBuffer.push(token);
    }
  }

  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
  }

  private pruneMemory() {
    const now = Date.now();
    const expiry = this.props.maxBufferSeconds * 1000;
    this.tokenBuffer = this.tokenBuffer.filter(t => (now - t.timestamp) < expiry);
    this.chatBuffer = this.chatBuffer.filter(c => (now - c.timestamp) < expiry);
  }

  private getRefinedFacts(limit: number): NarrativeToken[] {
    return [...this.tokenBuffer].sort((a, b) => b.importance - a.importance).slice(0, limit);
  }

  private getRecentChat(limit: number): { user: string; text: string }[] {
    return [...this.chatBuffer].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }
}

Component.register(SmartNpcMemory);