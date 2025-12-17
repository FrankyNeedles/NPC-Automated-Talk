// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * The Shared Brain for the Broadcast System.
 * 
 * Responsibilities:
 * 1. Tracks "Who Spoke Last" (Context for the next host).
 * 2. Tracks "Audience" (People in the studio).
 * 3. Tracks "Chat Questions" (For the Q&A Segment).
 * 4. Tracks "Room Vibe" (From NpcContextAgent).
 * 5. Bridges World Persistent Variables (Storyline/Schedule).
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

// Internal Events
const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    storylineVar: { type: PropTypes.String, label: "Var: Storyline", default: "Storyline" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  // -- Short Term Memory (RAM) --
  private lastSpeakerID: string = "None";
  private lastSpokenContent: string = "";
  
  private studioAudience: string[] = []; 
  private chatBuffer: { user: string; text: string }[] = []; 
  private roomEnergy: string = "Normal";
  private playerCount: number = 0;

  private tokenBuffer: NarrativeToken[] = [];

  start() {
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
  }

  // --- Broadcast Tracking ---

  public logBroadcast(hostID: string, contentSummary: string) {
    this.lastSpeakerID = hostID;
    this.lastSpokenContent = contentSummary;
    if (this.props.debugMode) console.log(`[Memory] ${hostID} finished speaking.`);
  }

  public getLastSpeechContext() {
    return {
      speaker: this.lastSpeakerID,
      content: this.lastSpokenContent
    };
  }

  // --- Audience & Vibe Tracking ---
  
  public addStudioAudience(name: string) {
    if (!this.studioAudience.includes(name)) this.studioAudience.push(name);
  }

  public removeStudioAudience(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }

  public getAudienceList(): string[] {
    return [...this.studioAudience];
  }

  public updateRoomStats(count: number, energyLabel: string) {
    this.playerCount = count;
    this.roomEnergy = energyLabel;
  }

  /**
   * FIX: Added this method to resolve the error in StationDirector.
   */
  public getRoomVibe(): string {
    return this.roomEnergy;
  }

  // --- Chat Tracking ---

  public getLatestChatQuestion(): string {
    if (this.chatBuffer.length === 0) return "";
    const last = this.chatBuffer[this.chatBuffer.length - 1];
    return `${last.user} asks: "${last.text}"`;
  }

  // --- Persistence Stubs ---
  // (These allow other scripts to call save/load without crashing, even if logic is simplified)
  public saveGlobalState(topicID: string, segmentIdx: number) {
    // Placeholder for future persistence logic
  }

  // --- Internal Handlers ---

  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
    if (this.chatBuffer.length > 5) this.chatBuffer.shift();
    if (this.props.debugMode) console.log(`[Memory] Stored Question: ${data.text}`);
  }

  private handleObjectToken(payload: any) {
    // Placeholder for object interactions
  }
}

Component.register(SmartNpcMemory);