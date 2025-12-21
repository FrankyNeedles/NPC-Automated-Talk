// ShowScheduler.ts
/**
 * ShowScheduler.ts
 * The "Floor Manager".
 * 
 * UPDATE: Increased Watchdog to 60s to accommodate longer speeches.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { StationDirector } from './StationDirector';
import { SmartNpcMemory } from './SmartNpcMemory';
import { NEWS_WIRE, NewsStory } from './TopicsDatabase';

const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');
const HostBusyEvent = new NetworkEvent<{ hostID: string }>('HostBusyEvent');

export class ShowScheduler extends Component<typeof ShowScheduler> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private currentTurn: number = 0;
  private isSegmentActive: boolean = false;
  private segmentEndTime: number = 0;
  private isDebug: boolean = false;
  private currentTurnDelay: number = 1.0;
  private isCurrentlySpeaking: boolean = false; // Flag to prevent overlap

  private currentCue: any = null;
  private nextCue: any = null;
  private isFetching: boolean = false;
  private watchdogTimer: any = null;
  private currentStory: NewsStory | undefined;

  // Generic Banter Pool
  private readonly GENERIC_BANTER = [
    "That is a really good point.", "I honestly never looked at it that way.", "You might be right, but I have my doubts.",
    "Let's keep moving, we have a lot to cover.", "That reminds me of something I saw online.", "Wait, are you serious?",
    "Okay, fair enough.", "I'm not touching that one!"
  ];

  start() {
    this.isDebug = this.props.debugMode;
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorResponse.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));
    this.connectNetworkBroadcastEvent(HostBusyEvent, this.handleHostBusy.bind(this));

    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, 5000);
  }

  private requestNextSegment() {
      if (this.isFetching) return;
      this.isFetching = true;
      if (this.isDebug) console.log("[Scheduler] Requesting Plan...");
      this.sendNetworkBroadcastEvent(RequestSegmentEvent, {});
  }

  private handleDirectorResponse(data: any) {
    this.isFetching = false;
    if (!this.isSegmentActive) {
        this.startSegment(data);
    } else {
        if (this.isDebug) console.log(`[Scheduler] Buffered Next: ${data.segment}`);
        this.nextCue = data;
    }
  }

  private startSegment(cueData: any) {
    this.currentCue = cueData;
    this.nextCue = null;
    this.currentTurn = 0;
    this.isSegmentActive = true;
    
    this.currentStory = NEWS_WIRE.find((s: NewsStory) => s.id === cueData.topicID);

    const duration = cueData.duration || 60;
    this.segmentEndTime = Date.now() + (duration * 1000);

    const style = cueData.pacingStyle || "Casual";
    if (style === "Rapid") this.currentTurnDelay = 2.0; // Slightly reduced for better flow
    else if (style === "Debate") this.currentTurnDelay = 3.5; // Slightly reduced for debate pacing
    else if (style === "Relaxed") this.currentTurnDelay = 4.5; // Slightly reduced for relaxed pacing
    else this.currentTurnDelay = 3.0; // Slightly reduced default delay

    if (this.isDebug) console.log(`[Scheduler] LIVE: ${cueData.segment}`);
    if (this.memory) this.memory.saveGlobalState(cueData.topicID); 

    this.cueNextSpeaker();

    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, (duration / 2) * 1000);
  }

  private cueNextSpeaker() {
    if (!this.isSegmentActive || !this.currentCue || this.isCurrentlySpeaking) return;

    if (Date.now() > this.segmentEndTime) {
      this.finishSegment();
      return;
    }

    if (this.watchdogTimer) this.async.clearTimeout(this.watchdogTimer);

    const isHostA = (this.currentTurn % 2 === 0);
    const targetID = isHostA ? "HostA" : "HostB";
    const role = isHostA ? "Anchor" : "CoHost";
    const instructions = isHostA ? this.currentCue.hostInstructions : this.currentCue.coHostInstructions;

    let lastContext = "";
    if (this.memory) {
      const last = this.memory.getLastSpeechContext();
      if (last.speaker !== targetID && last.speaker !== "None") {
        lastContext = `Your co-host said: "${last.content}". React.`;
      }
    }

    let backupLine = "";
    if (Math.random() > 0.5 && this.currentStory && this.currentStory.tangents && this.currentStory.tangents.length > 0) {
        const tIdx = this.currentTurn % this.currentStory.tangents.length;
        backupLine = `Speaking of that, what about ${this.currentStory.tangents[tIdx]}?`;
    } else {
        backupLine = this.GENERIC_BANTER[Math.floor(Math.random() * this.GENERIC_BANTER.length)];
    }

    this.isCurrentlySpeaking = true; // Set flag before cueing

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: targetID,
      role: role,
      topic: this.currentCue.headline,
      context: this.currentCue.context,
      stance: isHostA ? this.currentCue.hostStance : this.currentCue.coHostStance,
      lastSpeakerContext: lastContext,
      pacingStyle: this.currentCue.pacingStyle,
      instructions: instructions,
      backupLine: backupLine
    });

    this.currentTurn++;

    // UPDATE: Increased Safety Timeout to 60s
    this.watchdogTimer = this.async.setTimeout(() => {
        console.warn(`[Scheduler] Watchdog: ${targetID} timed out!`);
        this.isCurrentlySpeaking = false; // Reset on timeout
        this.cueNextSpeaker();
    }, 60000);
  }

  private retryCueNextSpeaker() {
    // Retry after a short delay if host was busy
    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, 1000); // Wait 1 second before retrying
  }

  private handleSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.watchdogTimer) {
        this.async.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
    }
    if (this.memory) this.memory.logBroadcast(data.hostID, data.contentSummary);

    this.isCurrentlySpeaking = false; // Reset flag when speech completes

    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, this.currentTurnDelay * 1000);
  }

  private handleHostBusy(data: { hostID: string }) {
    if (this.isDebug) console.log(`[Scheduler] Host ${data.hostID} is busy, retrying...`);
    this.isCurrentlySpeaking = false; // Reset flag so we can retry
    this.retryCueNextSpeaker();
  }

  private finishSegment() {
    this.isSegmentActive = false;
    if (this.nextCue) this.startSegment(this.nextCue);
    else this.requestNextSegment();
  }
}

Component.register(ShowScheduler);