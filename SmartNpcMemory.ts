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
    dataVar: { type: PropTypes.String, default: "Data" },
    prefsVar: { type: PropTypes.String, default: "Prefs" },
    playerRoleVar: { type: PropTypes.String, default: "PlayerRole" },
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

  // Persistent Variables
  private storyline: string = "";
  private lastPrompts: string[] = [];
  private data: Map<string, any> = new Map();
  private prefs: Map<string, any> = new Map();
  private playerRole: string = "";

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchActivity.bind(this));

    // Load persistent data
    this.loadPersistentData();
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
    this.learnFromInteraction(data.userId, `Pitched: ${data.text}`);
  }

  private handleObjectToken(payload: any) {}
  
  public handlePlayerEntry(player: Player) {
    const name = player.name.get();
    if (!this.studioAudience.includes(name)) this.studioAudience.push(name);
  }
  public handlePlayerExit(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }

  // --- Persistent Variables API ---

  public getStoryline(): string {
    return this.storyline;
  }

  public setStoryline(value: string) {
    this.storyline = value;
    this.savePersistentData();
  }

  public getLastPrompts(): string[] {
    return [...this.lastPrompts];
  }

  public addLastPrompt(prompt: string) {
    this.lastPrompts.push(prompt);
    if (this.lastPrompts.length > 10) this.lastPrompts.shift(); // Keep last 10
    this.savePersistentData();
  }

  public getData(key: string): any {
    return this.data.get(key);
  }

  public setData(key: string, value: any) {
    this.data.set(key, value);
    this.savePersistentData();
  }

  public getPrefs(key: string): any {
    return this.prefs.get(key);
  }

  public setPrefs(key: string, value: any) {
    this.prefs.set(key, value);
    this.savePersistentData();
  }

  public getPlayerRole(): string {
    return this.playerRole;
  }

  public setPlayerRole(role: string) {
    this.playerRole = role;
    this.savePersistentData();
  }

  // --- Learning and Personalization ---

  public learnFromInteraction(playerName: string, interaction: string) {
    // Update storyline based on interactions
    this.setStoryline(this.getStoryline() + ` ${interaction}`);

    // Store last prompts for context
    this.addLastPrompt(interaction);

    // Update player data
    this.setData(`player_${playerName}_interactions`, (this.getData(`player_${playerName}_interactions`) || 0) + 1);

    // Adjust prefs based on player behavior
    if (interaction.includes("pitch")) {
      this.setPrefs(`player_${playerName}_prefers_pitching`, true);
    }
  }

  public getPersonalizedContext(playerName: string): string {
    const profile = this.getPlayerProfile(playerName);
    const interactions = this.getData(`player_${playerName}_interactions`) || 0;
    const prefersPitching = this.getPrefs(`player_${playerName}_prefers_pitching`) || false;

    return `Player ${playerName} has visited ${profile.visits} times, reputation ${profile.reputation}, ${interactions} interactions. ${prefersPitching ? 'Enjoys pitching ideas.' : ''} Storyline: ${this.getStoryline()}`;
  }

  // --- Persistence Methods ---

  private loadPersistentData() {
    // Load persistent variables from Horizon's world data
    // Assuming access to world persistent storage
    try {
      const world = this.world;
      if (world) {
        this.storyline = world.persistentStorageWorld.getWorldVariable(this.props.storylineVar) || "";
        this.lastPrompts = JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.lastPromptsVar) || "[]");
        this.data = new Map(JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.dataVar) || "{}"));
        this.prefs = new Map(JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.prefsVar) || "{}"));
        this.playerRole = world.persistentStorageWorld.getWorldVariable(this.props.playerRoleVar) || "";
      }
    } catch (e) {
      if (this.isDebug) console.log("[Memory] Failed to load persistent data:", e);
    }
  }

  private async savePersistentData() {
    // Save persistent variables to Horizon's world data
    try {
      const world = this.world;
      if (world) {
        await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.storylineVar, this.storyline);
        await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.lastPromptsVar, JSON.stringify(this.lastPrompts));
        await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.dataVar, JSON.stringify(Object.fromEntries(this.data)));
        await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.prefsVar, JSON.stringify(Object.fromEntries(this.prefs)));
        await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.playerRoleVar, this.playerRole);
      }
    } catch (e) {
      if (this.isDebug) console.log("[Memory] Failed to save persistent data:", e);
    }
  }
}

Component.register(SmartNpcMemory);
