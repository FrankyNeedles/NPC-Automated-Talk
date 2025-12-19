// SmartNpcMemory.ts
import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    // World Variables
    storylineVar: { type: PropTypes.String, label: "Var: Storyline", default: "Storyline" },
    lastPromptsVar: { type: PropTypes.String, label: "Var: LastPrompts", default: "LastPrompts" },
    playerRoleVar: { type: PropTypes.String, label: "Var: PlayerRoles", default: "PlayerRoles" },
    
    // Player Variables
    npcDataVar: { type: PropTypes.String, label: "P-Var: Data", default: "Data" },
    npcPrefsVar: { type: PropTypes.String, label: "P-Var: Prefs", default: "Prefs" },
    
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private lastSpeakerID: string = "None";
  private lastSpokenContent: string = "";
  private studioAudience: string[] = []; 
  private chatBuffer: { user: string; text: string }[] = []; 
  private roomEnergy: string = "Normal";
  private playerCount: number = 0;
  
  private usedTopicIDs: string[] = [];
  private playerReputation: Map<string, number> = new Map();
  private engagementEvents: number[] = [];
  private isDebug: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchActivity.bind(this));
    
    // Initialize World Vars access (Mock/Stub for now as direct API access varies)
    if (this.isDebug) console.log(`[Memory] Linked Vars: ${this.props.storylineVar}, ${this.props.npcDataVar}`);
  }

  // --- Persistence API ---
  public isContentBurned(topicID: string): boolean {
    return this.usedTopicIDs.includes(topicID);
  }

  public markContentAsUsed(topicID: string) {
    if (!topicID || topicID.startsWith("filler") || topicID === "generic") return;
    this.usedTopicIDs.push(topicID);
    if (this.usedTopicIDs.length > 8) this.usedTopicIDs.shift();
    if (this.isDebug) console.log(`[Memory] Burned: ${topicID}`);
  }

  public saveGlobalState(topicID: string) {
    this.markContentAsUsed(topicID);
  }

  // --- Reputation & Data ---
  public getPlayerReputation(playerName: string): number {
    return this.playerReputation.get(playerName) || 10; 
  }

  public updatePlayerReputation(playerName: string, delta: number) {
    const current = this.getPlayerReputation(playerName);
    const newVal = Math.max(0, Math.min(100, current + delta));
    this.playerReputation.set(playerName, newVal);
    // (Here we would write to npcDataVar 'reputation' field)
  }

  // --- Context API ---
  public handlePlayerEntry(player: Player) {
    this.addStudioAudience(player.name.get());
    
    // ACCESSING PLAYER VARS
    // We simulate reading 'Data' and 'Prefs' here.
    if (this.isDebug) {
        console.log(`[Memory] Reading ${this.props.npcDataVar} for ${player.name.get()}`);
        console.log(`[Memory] Reading ${this.props.npcPrefsVar} for ${player.name.get()}`);
    }
  }

  public handlePlayerExit(name: string) {
    this.removeStudioAudience(name);
  }

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
}

Component.register(SmartNpcMemory);