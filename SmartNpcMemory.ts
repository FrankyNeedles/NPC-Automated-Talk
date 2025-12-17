// SmartNpcMemory.ts
import { Component, PropTypes, NetworkEvent, Player } from 'horizon/core';
import { NarrativeToken } from './NarrativeToken';

const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
  static propsDefinition = {
    storylineVar: { type: PropTypes.String, label: "Var: Storyline", default: "Storyline" },
    playerRoleVar: { type: PropTypes.String, label: "Var: PlayerRoles", default: "PlayerRoles" },
    lastPromptsVar: { type: PropTypes.String, label: "Var: LastPrompts", default: "LastPrompts" },
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
  private recentTopics: string[] = [];

  private currentTopicID: string = "tech_slop";
  private segmentIndex: number = 0;

  start() {
    this.connectNetworkBroadcastEvent(NarrativeTokenEvent, this.handleObjectToken.bind(this));
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleChat.bind(this));
  }

  // --- Public Methods (Fixing Console Errors) ---

  public addStudioAudience(name: string) {
    if (!this.studioAudience.includes(name)) this.studioAudience.push(name);
  }

  public removeStudioAudience(name: string) {
    this.studioAudience = this.studioAudience.filter(n => n !== name);
  }

  public handlePlayerEntry(player: Player) {
    this.addStudioAudience(player.name.get());
    if (this.props.debugMode) console.log(`[Memory] Player entered: ${player.name.get()}`);
  }

  public handlePlayerExit(name: string) {
    this.removeStudioAudience(name);
  }

  public updateRoomStats(count: number, energyLabel: string) {
    this.playerCount = count;
    this.roomEnergy = energyLabel;
  }

  public getRoomVibe(): string {
    return this.roomEnergy;
  }

  public getAudienceList(): string[] {
    return [...this.studioAudience];
  }

  public getLastSpeechContext() {
    return { speaker: this.lastSpeakerID, content: this.lastSpokenContent };
  }

  public logBroadcast(hostID: string, contentSummary: string) {
    this.lastSpeakerID = hostID;
    this.lastSpokenContent = contentSummary;
  }

  public getLatestChatQuestion(): string {
    if (this.chatBuffer.length === 0) return "";
    const last = this.chatBuffer[this.chatBuffer.length - 1];
    return `${last.user} asks: "${last.text}"`;
  }

  public saveGlobalState(topicID: string, segmentIdx: number) {
    this.currentTopicID = topicID;
    this.segmentIndex = segmentIdx;
    this.recentTopics.push(topicID);
    if (this.recentTopics.length > 5) this.recentTopics.shift();
  }

  private handleChat(data: { user: string; text: string; timestamp: number }) {
    this.chatBuffer.push(data);
    if (this.chatBuffer.length > 5) this.chatBuffer.shift();
  }

  private handleObjectToken(payload: any) {}
}

Component.register(SmartNpcMemory);