// ShowScheduler.ts
/**
 * ShowScheduler.ts
 * The "Floor Manager".
 * 
 * UPDATE: Removed manual timing slots. 
 * Now obeys the Director's 'duration' and 'pacingStyle'.
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
  private currentTurnDelay: number = 1.5;

  // Pre-Fetch
  private currentCue: any = null; 
  private nextCue: any = null;    
  private isFetching: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorResponse.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

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
    
    // 1. USE DYNAMIC DURATION
    this.segmentEndTime = Date.now() + (cueData.duration * 1000);

    // 2. ADJUST PACING (Turn Delay)
    // Rapid = Fast arguments (0.5s gap). Relaxed = Slow (2.5s gap).
    if (cueData.pacingStyle === "Rapid") this.currentTurnDelay = 0.5;
    else if (cueData.pacingStyle === "Debate") this.currentTurnDelay = 1.0;
    else this.currentTurnDelay = 2.0;

    if (this.isDebug) console.log(`[Scheduler] LIVE: ${cueData.segment} (${cueData.duration}s) | Style: ${cueData.pacingStyle}`);
    
    if (this.memory) {
       this.memory.saveGlobalState(cueData.topicID, 0); 
    }

    this.cueNextSpeaker();

    // Start pre-fetch halfway through (safe bet)
    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, (cueData.duration / 2) * 1000);
  }

  private cueNextSpeaker() {
    if (!this.isSegmentActive || !this.currentCue) return;

    if (Date.now() > this.segmentEndTime) {
      this.finishSegment();
      return;
    }

    const isHostA = (this.currentTurn % 2 === 0);
    const targetID = isHostA ? "HostA" : "HostB";
    const role = isHostA ? "Anchor" : "CoHost";
    const instructions = isHostA ? this.currentCue.hostInstructions : this.currentCue.coHostInstructions;

    let lastContext = "";
    if (this.memory) {
      const last = this.memory.getLastSpeechContext();
      if (last.speaker !== targetID && last.speaker !== "None") {
        lastContext = `Your co-host said: "${last.content}". React to this.`;
      }
    }

    // Pass the pacing style to the Host too (optional, but good for context)
    const pacingNote = `Pacing: ${this.currentCue.pacingStyle}.`;

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: targetID,
      role: role,
      topic: this.currentCue.headline,
      context: this.currentCue.context,
      instructions: `${instructions} ${pacingNote}`,
      lastSpeakerContext: lastContext
    });

    this.currentTurn++;
  }

  private handleSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.memory) {
      this.memory.logBroadcast(data.hostID, data.contentSummary);
    }

    // Dynamic Delay
    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, this.currentTurnDelay * 1000); 
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