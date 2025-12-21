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
  private debugModeVar: string = "DebugMode";

  // Persistent Variables
  private storyline: string = "";
  private storylineTimestamps: number[] = [];
  private lastPrompts: string[] = [];
  private data: Map<string, any> = new Map();
  private prefs: Map<string, any> = new Map();
  private playerRole: string = "";
  private topicReuseTimestamps: Map<string, number> = new Map();

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchActivity.bind(this));

    // Initialize world variables if they don't exist
    this.initializeWorldVariables();

    // Load debug mode from world variable
    try {
      const world = this.world;
      if (world) {
        const debugFromWorld = world.persistentStorageWorld.getWorldVariable(this.debugModeVar);
        if (debugFromWorld !== null) {
          this.isDebug = debugFromWorld === "true";
        }
      }
    } catch (e) {
      // Fallback to props
    }

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

  public logDeniedPitch(name: string, reason: string) {
    const profile = this.getPlayerProfile(name);
    profile.reputation = Math.max(0, profile.reputation - 1); // Slight reputation penalty
    this.playerProfiles.set(name, profile);
    // Log the denied pitch for analytics
    this.setData(`denied_pitch_${name}_${Date.now()}`, reason);
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
    this.storylineTimestamps.push(Date.now());
    if (this.storylineTimestamps.length > 10) this.storylineTimestamps.shift(); // Keep last 10 timestamps

    // Limit storyline length to 5000 chars
    if (this.storyline.length > 5000) {
      this.storyline = this.storyline.substring(0, 5000) + "...";
    }

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
    // Enhanced learning: Build narrative arcs and character development
    const currentStoryline = this.getStoryline();
    const enhancedInteraction = this.enhanceInteractionContext(playerName, interaction);

    // Create narrative progression - build on previous context
    const narrativeUpdate = this.buildNarrativeProgression(currentStoryline, enhancedInteraction);
    this.setStoryline(narrativeUpdate);

    // Store last prompts for context with timestamps
    this.addLastPrompt(`${playerName}: ${interaction}`);

    // Update player data with sophisticated tracking
    this.updatePlayerAnalytics(playerName, interaction);

    // Dynamic preference learning
    this.learnPlayerPreferences(playerName, interaction);

    // Cross-player narrative connections
    this.updateNetworkNarrative(playerName, interaction);
  }

  private enhanceInteractionContext(playerName: string, interaction: string): string {
    const profile = this.getPlayerProfile(playerName);
    const context = `Player ${playerName} (reputation: ${profile.reputation}, visits: ${profile.visits}) ${interaction}`;
    return context;
  }

  private buildNarrativeProgression(currentStoryline: string, newInteraction: string): string {
    // Create Hollywood-style narrative arcs
    if (currentStoryline.length > 1000) {
      // Summarize and continue - prevent infinite growth
      const summary = this.summarizeStoryline(currentStoryline);
      return `${summary}. Latest development: ${newInteraction}`;
    }
    return `${currentStoryline} ${newInteraction}`;
  }

  private summarizeStoryline(storyline: string): string {
    // Simple summarization - in production, use AI for better summaries
    const words = storyline.split(' ');
    if (words.length > 50) {
      return words.slice(0, 50).join(' ') + '...';
    }
    return storyline;
  }

  private updatePlayerAnalytics(playerName: string, interaction: string) {
    const interactions = (this.getData(`player_${playerName}_interactions`) || 0) + 1;
    this.setData(`player_${playerName}_interactions`, interactions);

    // Track interaction types for personality profiling
    const interactionType = this.categorizeInteraction(interaction);
    const typeCount = (this.getData(`player_${playerName}_${interactionType}_count`) || 0) + 1;
    this.setData(`player_${playerName}_${interactionType}_count`, typeCount);

    // Update engagement metrics
    this.updateEngagementMetrics(playerName, interaction);
  }

  private categorizeInteraction(interaction: string): string {
    if (interaction.includes("pitch")) return "creative";
    if (interaction.includes("question")) return "curious";
    if (interaction.includes("compliment")) return "positive";
    if (interaction.includes("criticism")) return "critical";
    return "general";
  }

  private updateEngagementMetrics(playerName: string, interaction: string) {
    const engagementScore = this.calculateEngagementScore(interaction);
    const currentScore = this.getData(`player_${playerName}_engagement_score`) || 0;
    const newScore = (currentScore + engagementScore) / 2; // Running average
    this.setData(`player_${playerName}_engagement_score`, newScore);
  }

  private calculateEngagementScore(interaction: string): number {
    let score = 0.5; // Base score
    if (interaction.length > 50) score += 0.2; // Longer interactions show more engagement
    if (interaction.includes("?")) score += 0.1; // Questions show curiosity
    if (interaction.includes("!")) score += 0.1; // Exclamation shows enthusiasm
    return Math.min(score, 1.0);
  }

  private learnPlayerPreferences(playerName: string, interaction: string) {
    // Sophisticated preference learning
    if (interaction.includes("pitch") || interaction.includes("idea")) {
      this.setPrefs(`player_${playerName}_prefers_creative`, true);
    }
    if (interaction.includes("question") || interaction.includes("curious")) {
      this.setPrefs(`player_${playerName}_prefers_discussion`, true);
    }
    if (interaction.includes("funny") || interaction.includes("joke")) {
      this.setPrefs(`player_${playerName}_prefers_humor`, true);
    }
    if (interaction.includes("serious") || interaction.includes("deep")) {
      this.setPrefs(`player_${playerName}_prefers_substance`, true);
    }
  }

  private updateNetworkNarrative(playerName: string, interaction: string) {
    // Create connections between players for richer narratives
    const activePlayers = this.getAudienceList();
    activePlayers.forEach(otherPlayer => {
      if (otherPlayer !== playerName) {
        const connectionKey = `connection_${playerName}_${otherPlayer}`;
        const currentConnection = this.getData(connectionKey) || 0;
        this.setData(connectionKey, currentConnection + 0.1); // Strengthen connections
      }
    });
  }

  public getPersonalizedContext(playerName: string): string {
    const profile = this.getPlayerProfile(playerName);
    const interactions = this.getData(`player_${playerName}_interactions`) || 0;
    const prefersPitching = this.getPrefs(`player_${playerName}_prefers_pitching`) || false;

    return `Player ${playerName} has visited ${profile.visits} times, reputation ${profile.reputation}, ${interactions} interactions. ${prefersPitching ? 'Enjoys pitching ideas.' : ''} Storyline: ${this.getStoryline()}`;
  }

  // --- Persistence Methods ---

  private async initializeWorldVariables() {
    try {
      const world = this.world;
      if (world) {
        // Initialize world variables with defaults if they don't exist
        try {
          const debugVar = world.persistentStorageWorld.getWorldVariable(this.debugModeVar);
          if (debugVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.debugModeVar, "false");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing DebugMode variable");
        }

        try {
          const storylineVar = world.persistentStorageWorld.getWorldVariable(this.props.storylineVar);
          if (storylineVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.storylineVar, "");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing Storyline variable");
        }

        try {
          const lastPromptsVar = world.persistentStorageWorld.getWorldVariable(this.props.lastPromptsVar);
          if (lastPromptsVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.lastPromptsVar, "[]");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing LastPrompts variable");
        }

        try {
          const dataVar = world.persistentStorageWorld.getWorldVariable(this.props.dataVar);
          if (dataVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.dataVar, "{}");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing Data variable");
        }

        try {
          const prefsVar = world.persistentStorageWorld.getWorldVariable(this.props.prefsVar);
          if (prefsVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.prefsVar, "{}");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing Prefs variable");
        }

        try {
          const playerRoleVar = world.persistentStorageWorld.getWorldVariable(this.props.playerRoleVar);
          if (playerRoleVar === null) {
            await world.persistentStorageWorld.setWorldVariableAcrossAllInstancesAsync(this.props.playerRoleVar, "");
          }
        } catch (e) {
          if (this.isDebug) console.log("[Memory] Initializing PlayerRole variable");
        }
      }
    } catch (e) {
      if (this.isDebug) console.log("[Memory] Failed to initialize world variables:", e);
    }
  }

  private loadPersistentData() {
    // Load persistent variables from Horizon's world data
    // Assuming access to world persistent storage
    try {
      const world = this.world;
      if (world) {
        try {
          this.storyline = world.persistentStorageWorld.getWorldVariable(this.props.storylineVar) || "";
        } catch (e) {
          this.storyline = "";
          if (this.isDebug) console.log("[Memory] Storyline variable not found, initializing to empty");
        }
        try {
          this.lastPrompts = JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.lastPromptsVar) || "[]");
        } catch (e) {
          this.lastPrompts = [];
          if (this.isDebug) console.log("[Memory] LastPrompts variable not found, initializing to empty array");
        }
        try {
          this.data = new Map(JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.dataVar) || "{}"));
        } catch (e) {
          this.data = new Map();
          if (this.isDebug) console.log("[Memory] Data variable not found, initializing to empty map");
        }
        try {
          this.prefs = new Map(JSON.parse(world.persistentStorageWorld.getWorldVariable(this.props.prefsVar) || "{}"));
        } catch (e) {
          this.prefs = new Map();
          if (this.isDebug) console.log("[Memory] Prefs variable not found, initializing to empty map");
        }
        try {
          this.playerRole = world.persistentStorageWorld.getWorldVariable(this.props.playerRoleVar) || "";
        } catch (e) {
          this.playerRole = "";
          if (this.isDebug) console.log("[Memory] PlayerRole variable not found, initializing to empty");
        }
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
