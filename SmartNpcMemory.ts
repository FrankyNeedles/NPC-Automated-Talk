// SmartNpcMemory.ts
/**
 * SmartNpcMemory.ts
 * The Shared Brain & Persistence Layer.
 * 
 * CHECKLIST ITEMS:
 * [x] Memory & Continuity (Stores reputation, pitches, history)
 * [x] Crash Fix (Safe access to props)
 */

import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    storylineVar: { type: PropTypes.String, label: "Var: Storyline", default: "Storyline" },
    playerRoleVar: { type: PropTypes.String, label: "Var: PlayerRoles", default: "PlayerRoles" },
    lastPromptsVar: { type: PropTypes.String, label: "Var: LastPrompts", default: "LastPrompts" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  // RAM - Broadcast State
  private lastSpeakerID: string = "None";
  private lastSpokenContent: string = "";
  private studioAudience: string[] = []; 
  private chatBuffer: { user: string; text: string }[] = []; 
  private roomEnergy: string = "Normal";
  private playerCount: number = 0;

  // RAM - Persistence Cache
  private usedTopicIDs: string[] = []; 
  
  // NEW: Gamification Data
  private playerReputation: Map<string, number> = new Map(); // Name -> Score (0-100)
  private showPitches: { user: string; pitch: string; score: number }[] = [];

  private isDebug: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
  }

  // --- Safe Debug Helper ---
  private log(msg: string) {
    // Safety check in case props aren't ready
    const debug = this.props ? this.props.debugMode : false;
    if (debug) console.log(`[Memory] ${msg}`);
  }

  // --- Persistence / Content Management ---

  public isContentBurned(topicID: string): boolean {
    return this.usedTopicIDs.includes(topicID);
  }

  public markContentAsUsed(topicID: string) {
    if (topicID === "generic" || topicID.startsWith("filler")) return;
    this.usedTopicIDs.push(topicID);
    if (this.usedTopicIDs.length > 8) this.usedTopicIDs.shift();
    this.log(`Burned Topic: ${topicID}`);
  }

  public saveGlobalState(topicID: string, segmentIdx: number) {
    this.markContentAsUsed(topicID);
  }

  // --- Player Data & Gamification ---

  public handlePlayerEntry(player: Player) {
    const name = player.name.get();
    this.addStudioAudience(name);
    
    // Initialize Reputation if new
    if (!this.playerReputation.has(name)) {
        this.playerReputation.set(name, 10); // Start with neutral rep
    }
    
    this.log(`Player entered: ${name} (Rep: ${this.playerReputation.get(name)})`);
  }

  public handlePlayerExit(name: string) {
    this.removeStudioAudience(name);
  }

  public getPlayerReputation(name: string): number {
    return this.playerReputation.get(name) || 10;
  }

  public updatePlayerReputation(name: string, delta: number) {
    const current = this.getPlayerReputation(name);
    const newVal = Math.max(0, Math.min(100, current + delta));
    this.playerReputation.set(name, newVal);
    this.log(`Updated Rep for ${name}: ${newVal}`);
  }

  public submitPitch(user: string, pitchText: string) {
    this.showPitches.push({ user, pitch: pitchText, score: 0 });
    this.log(`Pitch Received from ${user}`);
  }

  public getPendingPitches() {
    return [...this.showPitches];
  }

  public clearPitches() {
    this.showPitches = [];
  }

  // --- Broadcast Context API ---

  public logBroadcast(hostID: string, contentSummary: string) {
    this.lastSpeakerID = hostID;
    this.lastSpokenContent = contentSummary;
  }

  public getLastSpeechContext() {
    return { speaker: this.lastSpeakerID, content: this.lastSpokenContent };
  }

  // --- Audience / Vibe API ---

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

  public getRoomVibe(): string {
    return this.roomEnergy;
  }

  // --- Chat API ---

  public getLatestChatQuestion(): string {
    if (this.chatBuffer.length === 0) return "";
    const last = this.chatBuffer[this.chatBuffer.length - 1];
    return `${last.user} asks: "${last.text}"`;
  }

  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
    if (this.chatBuffer.length > 5) this.chatBuffer.shift();
  }

  private handleObjectToken(payload: any) {}
}

Component.register(SmartNpcMemory);