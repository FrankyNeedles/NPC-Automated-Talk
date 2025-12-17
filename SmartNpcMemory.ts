// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * The Central Memory Hub.
 * Stores:
 * 1. Object Interactions (NarrativeTokens)
 * 2. Overheard Chat
 * 3. Room Vibe Stats (Player count/Energy)
 * 4. Studio Audience List (Players in the trigger zone)
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

// Events
const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatToBrainEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatToBrainEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    maxBufferSeconds: { type: PropTypes.Number, default: 45 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  // -- State Storage --
  private tokenBuffer: NarrativeToken[] = [];
  private chatBuffer: { user: string; text: string; timestamp: number }[] = [];
  
  // Room Stats (from NpcContextAgent)
  private playerCount: number = 0;
  private roomEnergy: string = "Chill";
  
  // Specific list of people in the "Studio" Trigger Zone
  private studioAudience: string[] = [];

  start() {
    // 1. Listen for World Events
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    
    // 2. Listen for Chat (Keyboard)
    this.connectNetworkBroadcastEvent(ChatToBrainEvent, this.handleChat.bind(this));
    
    // 3. Start cleanup loop
    this.async.setInterval(this.pruneMemory.bind(this), 5000);
  }

  // --- Public API (Called by Sensors) ---

  /**
   * Called by NpcContextAgent when players enter/leave the Studio Trigger
   */
  public addStudioAudience(name: string) {
    if (!this.studioAudience.includes(name)) {
        this.studioAudience.push(name);
        if (this.props.debugMode) console.log(`[Memory] Audience added: ${name}`);
    }
  }

  public removeStudioAudience(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
    if (this.props.debugMode) console.log(`[Memory] Audience removed: ${name}`);
  }

  /**
   * Called by NpcContextAgent to update general room vibe
   */
  public updateRoomStats(count: number, energyLabel: string) {
    this.playerCount = count;
    this.roomEnergy = energyLabel;
  }

  /**
   * Called by PromptScheduler to get the full picture
   */
  public getContextSnapshot() {
    return {
      roomVibe: this.roomEnergy,
      playerCount: this.playerCount,
      recentFacts: this.getRefinedFacts(3), // Top 3 object events
      recentChat: this.getRecentChat(2),    // Top 2 chat messages
      studioAudience: [...this.studioAudience] // Copy of the list
    };
  }

  // --- Internal Handlers ---

  private handleObjectToken(payload: any) {
    const token = payload as NarrativeToken;
    if (!token || !token.id || token.importance < 0.2) return;

    // Deduplicate: If same action happened on same object within 3 seconds, just update timestamp
    const dupIdx = this.tokenBuffer.findIndex(t => 
      t.objectId === token.objectId && 
      t.action === token.action && 
      (token.timestamp - t.timestamp < 3000)
    );
    
    if (dupIdx !== -1) {
      this.tokenBuffer[dupIdx] = token; 
    } else {
      this.tokenBuffer.push(token);
      if (this.props.debugMode) console.log(`[Memory] Token stored: ${token.objectLabel} (${token.action})`);
    }
  }

  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
    if (this.props.debugMode) console.log(`[Memory] Chat stored from: ${data.user}`);
  }

  private pruneMemory() {
    const now = Date.now();
    const expiry = this.props.maxBufferSeconds * 1000;
    
    const startCount = this.tokenBuffer.length;
    this.tokenBuffer = this.tokenBuffer.filter(t => (now - t.timestamp) < expiry);
    this.chatBuffer = this.chatBuffer.filter(c => (now - c.timestamp) < expiry);
  }

  private getRefinedFacts(limit: number): NarrativeToken[] {
    // Sort by Importance (High -> Low), then Recency
    return [...this.tokenBuffer]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  private getRecentChat(limit: number): { user: string; text: string }[] {
    // Sort by Newest -> Oldest
    return [...this.chatBuffer]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

Component.register(SmartNpcMemory);