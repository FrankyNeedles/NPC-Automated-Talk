// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * 
 * FEATURES:
 * - Reputation Tracking (getPlayerReputation)
 * - Engagement Stats (getEngagementStats)
 * - Persistence (World Variables)
 * - Continuity (Anti-Repeat)
 */

import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    storylineVar: { type: PropTypes.String, default: "Storyline" },
    lastPromptsVar: { type: PropTypes.String, default: "LastPrompts" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private lastSpeakerID: string = "None";
  private lastSpokenContent: string = "";
  private studioAudience: string[] = []; 
  private chatBuffer: { user: string; text: string }[] = []; 
  private roomEnergy: string = "Normal";
  private playerCount: number = 0;
  
  // Persistence Cache
  private usedTopicIDs: string[] = [];
  private playerReputation: Map<string, number> = new Map();
  private engagementEvents: number[] = [];

  private isDebug: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchActivity.bind(this));
  }

  // --- Persistence ---
  public isContentBurned(topicID: string): boolean {
    return this.usedTopicIDs.includes(topicID);
  }

  public markContentAsUsed(topicID: string) {
    if (topicID.startsWith("filler") || topicID === "generic") return;
    this.usedTopicIDs.push(topicID);
    if (this.usedTopicIDs.length > 8) this.usedTopicIDs.shift();
    if (this.isDebug) console.log(`[Memory] Burned: ${topicID}`);
  }

  public saveGlobalState(topicID: string) {
    this.markContentAsUsed(topicID);
  }

  // --- Reputation / Gamification ---
  public getPlayerReputation(playerName: string): number {
    return this.playerReputation.get(playerName) || 10; 
  }

  public updatePlayerReputation(playerName: string, delta: number) {
    const current = this.getPlayerReputation(playerName);
    const newVal = Math.max(0, Math.min(100, current + delta));
    this.playerReputation.set(playerName, newVal);
  }

  public getEngagementStats(windowSeconds: number = 60): number {
    const now = Date.now();
    const cutoff = now - (windowSeconds * 1000);
    this.engagementEvents = this.engagementEvents.filter(t => t > cutoff);
    return Math.min(this.engagementEvents.length / 10, 1.0); 
  }

  // --- Context API ---
  public addStudioAudience(name: string) {
    if (!this.studioAudience.includes(name)) this.studioAudience.push(name);
  }

  public removeStudioAudience(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }

  public getAudienceList(): string[] { return [...this.studioAudience]; }
  public getRoomVibe(): string { return this.roomEnergy; }
  
  public getLatestChatQuestion(): string {
    if (this.chatBuffer.length === 0) return "";
    const last = this.chatBuffer[this.chatBuffer.length - 1];
    return `${last.user} asks: "${last.text}"`;
  }
  
  public updateRoomStats(count: number, energyLabel: string) {
    this.playerCount = count;
    this.roomEnergy = energyLabel;
  }

  public logBroadcast(hostID: string, contentSummary: string) {
    this.lastSpeakerID = hostID;
    this.lastSpokenContent = contentSummary;
  }

  public getLastSpeechContext() {
    return { speaker: this.lastSpeakerID, content: this.lastSpokenContent };
  }

  // --- Internals ---
  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
    this.engagementEvents.push(Date.now());
    if (this.chatBuffer.length > 5) this.chatBuffer.shift();
  }

  private handlePitchActivity(data: any) {
    this.engagementEvents.push(Date.now());
  }

  private handleObjectToken(payload: any) {}
  
  public handlePlayerEntry(player: Player) {
    this.addStudioAudience(player.name.get());
  }
  public handlePlayerExit(name: string) {
    this.removeStudioAudience(name);
  }
}

Component.register(SmartNpcMemory);