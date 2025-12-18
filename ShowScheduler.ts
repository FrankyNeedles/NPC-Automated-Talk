// ShowScheduler.ts
/**
 * ShowScheduler.ts
 * The "Floor Manager".
 * 
 * UPDATE: Increased Watchdog timer to 45s to prevent false positives.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { StationDirector } from './StationDirector';
import { SmartNpcMemory } from './SmartNpcMemory';

const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

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
  private currentCue: any = null; 
  private nextCue: any = null;    
  private isFetching: boolean = false;
  private watchdogTimer: any = null;

  // Speaker Availability
  private hostBusy: Map<string, boolean> = new Map();

  start() {
    this.isDebug = this.props.debugMode;
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorResponse.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    this.hostBusy.set("HostA", false);
    this.hostBusy.set("HostB", false);

    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, 5000);
  }

  private requestNextSegment() {
      if (this.isFetching) return;
      this.isFetching = true;
      if (this.isDebug) console.log("[Scheduler] Requesting Director Plan...");
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
    
    const duration = cueData.duration || 60;
    this.segmentEndTime = Date.now() + (duration * 1000);

    const style = cueData.pacingStyle || "Casual";
    if (style === "Rapid") this.currentTurnDelay = 0.3;
    else if (style === "Debate") this.currentTurnDelay = 0.8; 
    else if (style === "Relaxed") this.currentTurnDelay = 1.5; 
    else this.currentTurnDelay = 1.0;

    if (this.isDebug) console.log(`[Scheduler] LIVE: ${cueData.segment} | Style: ${style}`);
    
    if (this.memory) {
       this.memory.saveGlobalState(cueData.topicID, 0); 
    }

    this.cueNextSpeaker();

    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, (duration / 2) * 1000);
  }

  private cueNextSpeaker() {
    if (!this.isSegmentActive || !this.currentCue) return;

    if (Date.now() > this.segmentEndTime) {
      this.finishSegment();
      return;
    }

    if (this.watchdogTimer) this.async.clearTimeout(this.watchdogTimer);

    const isHostA = (this.currentTurn % 2 === 0);
    const targetID = isHostA ? "HostA" : "HostB";
    const role = isHostA ? "Anchor" : "CoHost";
    
    if (this.hostBusy.get(targetID)) {
        this.async.setTimeout(() => this.cueNextSpeaker(), 500);
        return;
    }

    const myStance = isHostA ? this.currentCue.hostStance : this.currentCue.coHostStance;

    let lastContext = "";
    if (this.memory) {
      const last = this.memory.getLastSpeechContext();
      if (last.speaker !== targetID && last.speaker !== "None") {
        lastContext = `Your co-host said: "${last.content}". React to this.`;
      }
    }

    const pacingNote = `Pacing: ${this.currentCue.pacingStyle || "Casual"}.`;

    this.hostBusy.set(targetID, true);

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: targetID,
      role: role,
      topic: this.currentCue.headline,
      context: this.currentCue.context,
      stance: myStance,
      lastSpeakerContext: lastContext,
      pacingStyle: this.currentCue.pacingStyle, // Pass Raw Style
      instructions: `${isHostA ? this.currentCue.hostInstructions : this.currentCue.coHostInstructions}. ${pacingNote}`
    });

    this.currentTurn++;

    // RELAXED WATCHDOG: 45 Seconds
    this.watchdogTimer = this.async.setTimeout(() => {
        console.warn(`[Scheduler] Watchdog: ${targetID} timed out! Forcing next turn.`);
        this.hostBusy.set(targetID, false); // Force free
        this.cueNextSpeaker();
    }, 45000);
  }

  private handleSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.watchdogTimer) {
        this.async.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
    }

    if (this.memory) {
      this.memory.logBroadcast(data.hostID, data.contentSummary);
    }
    this.hostBusy.set(data.hostID, false);

    const jitter = 0.2 + (Math.random() * 0.6);
    const totalDelay = this.currentTurnDelay + jitter;

    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, totalDelay * 1000); 
  }

  private finishSegment() {
    this.isSegmentActive = false;
    if (this.nextCue) {
        this.startSegment(this.nextCue);
    } else {
        this.requestNextSegment();
    }
  }
}

Component.register(ShowScheduler);