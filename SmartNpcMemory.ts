// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * The Shared Brain.
 * 
 * FEATURES:
 * - Player Profiles (Reputation/Visits).
 * - Audience Tracking (Hearing).
 * - Broadcast State.
 */

import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

// Data Structure
export interface PlayerProfile {
  name: string;
  reputation: number;
  visits: number;
  lastPitch: string;
}

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    storylineVar: { type: PropTypes.String, default: "Storyline" },
    lastPromptsVar: { type: PropTypes.String, default: "LastPrompts" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private lastSpeakerID: string = "None";
  private lastSpokenContent: string = "";
  
  // Lists
  private studioAudience: string[] = []; 
  private activeListeners: string[] = []; // People talking to Coordinator

  private chatBuffer: { user: string; text: string }[] = []; 
  private roomEnergy: string = "Normal";
  private playerCount: number = 0;
  
  private usedTopicIDs: string[] = [];
  private playerProfiles: Map<string, PlayerProfile> = new Map();
  private engagementEvents: number[] = [];

  private isDebug: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchActivity.bind(this));
  }

  // --- PLAYER PROFILE API (Fixes your error) ---

  public getPlayerProfile(name: string): PlayerProfile {
    if (!this.playerProfiles.has(name)) {
        this.playerProfiles.set(name, {
            name: name,
            reputation: 10,
            visits: 0,
            lastPitch: "None"
        });
    }
    return this.playerProfiles.get(name)!;
  }

  public incrementVisit(name: string) {
    const profile = this.getPlayerProfile(name);
    profile.visits++;
    this.playerProfiles.set(name, profile);
  }

  public updateLastPitch(name: string, pitch: string) {
    const profile = this.getPlayerProfile(name);
    profile.lastPitch = pitch;
    profile.reputation += 2;
    this.playerProfiles.set(name, profile);
  }

  public getPlayerReputation(name: string): number {
    return this.getPlayerProfile(name).reputation;
  }

  public updatePlayerReputation(name: string, delta: number) {
    const profile = this.getPlayerProfile(name);
    profile.reputation = Math.max(0, Math.min(100, profile.reputation + delta));
    this.playerProfiles.set(name, profile);
  }

  // --- HEARING API (For Coordinator) ---

  public enableHearingForPlayer(player: Player) {
    const name = player.name.get();
    if (!this.activeListeners.includes(name)) {
        this.activeListeners.push(name);
    }
    this.incrementVisit(name);
    if (this.isDebug) console.log(`[Memory] Hearing Enabled: ${name}`);
  }

  public disableHearingForPlayer(player: Player) {
    const name = player.name.get();
    this.activeListeners = this.activeListeners.filter(n => n !== name);
    if (this.isDebug) console.log(`[Memory] Hearing Disabled: ${name}`);
  }

  public isPlayerBeingHeard(name: string): boolean {
    return this.activeListeners.includes(name);
  }

  // --- Standard API ---

  public isContentBurned(topicID: string): boolean {
    return this.usedTopicIDs.includes(topicID);
  }

  public markContentAsUsed(topicID: string) {
    if (!topicID || topicID.startsWith("filler") || topicID === "generic") return;
    this.usedTopicIDs.push(topicID);
    if (this.usedTopicIDs.length > 8) this.usedTopicIDs.shift();
  }

  public saveGlobalState(topicID: string) {
    this.markContentAsUsed(topicID);
  }

  public getEngagementStats(): number {
    return this.studioAudience.length > 2 ? 0.9 : 0.4;
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
    if (this.chatBuffer.length > 5) this.chatBuffer.shift();
  }

  private handlePitchActivity(data: { userId: string; text: string }) {
    this.updateLastPitch(data.userId, data.text);
  }

  private handleObjectToken(payload: any) {}
  
  public handlePlayerEntry(player: Player) {
    const name = player.name.get();
    if (!this.studioAudience.includes(name)) this.studioAudience.push(name);
  }
  public handlePlayerExit(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }
}

Component.register(SmartNpcMemory);