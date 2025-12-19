// ShowScheduler.ts
/**
 * ShowScheduler.ts
 * The "Floor Manager" / Sequencer.
 * 
 * RESPONSIBILITIES:
 * 1. BUFFERING: Holds the 'Next Segment' ready to play instantly.
 * 2. SEQUENCING: Cues Host A -> Wait -> Cue Host B -> Wait.
 * 3. PACING: Adjusts the gap between speakers based on the Director's style.
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
  
  // State
  private currentTurn: number = 0;
  private isSegmentActive: boolean = false;
  private segmentEndTime: number = 0;
  private isDebug: boolean = false;
  private currentTurnDelay: number = 1.0;

  // Pipeline
  private currentCue: any = null; 
  private nextCue: any = null;    
  private isFetching: boolean = false;
  
  // Watchdog
  private watchdogTimer: any = null;

  start() {
    this.isDebug = this.props.debugMode;
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorResponse.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    // Initial Kickoff (Wait for Director to boot)
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
        // Floor is cold, start immediately
        this.startSegment(data);
    } else {
        // Floor is hot, buffer it
        if (this.isDebug) console.log(`[Scheduler] Buffered Next: ${data.segment}`);
        this.nextCue = data;
    }
  }

  private startSegment(cueData: any) {
    this.currentCue = cueData;
    this.nextCue = null;
    this.currentTurn = 0;
    this.isSegmentActive = true;
    
    // 1. Set Duration (From Director)
    const duration = cueData.duration || 60;
    this.segmentEndTime = Date.now() + (duration * 1000);

    // 2. Set Pacing (From Director)
    const style = cueData.pacingStyle || "Casual";
    if (style === "Rapid") this.currentTurnDelay = 0.5;
    else if (style === "Debate") this.currentTurnDelay = 0.8; 
    else if (style === "Relaxed") this.currentTurnDelay = 2.0; 
    else this.currentTurnDelay = 1.2;

    if (this.isDebug) console.log(`[Scheduler] LIVE: ${cueData.segment} (${duration}s) | Style: ${style}`);
    
    // 3. Save State
    if (this.memory) {
       // We only pass the ID, memory handles the indexing logic
       this.memory.saveGlobalState(cueData.topicID); 
    }

    // 4. Begin
    this.cueNextSpeaker();

    // 5. Pre-Fetch Next (Halfway through)
    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, (duration / 2) * 1000);
  }

  private cueNextSpeaker() {
    if (!this.isSegmentActive || !this.currentCue) return;

    // Check Time
    if (Date.now() > this.segmentEndTime) {
      this.finishSegment();
      return;
    }

    // Clear Watchdog
    if (this.watchdogTimer) this.async.clearTimeout(this.watchdogTimer);

    // Ping Pong Logic
    const isHostA = (this.currentTurn % 2 === 0);
    const targetID = isHostA ? "HostA" : "HostB";
    const role = isHostA ? "Anchor" : "CoHost";
    
    const instructions = isHostA ? this.currentCue.hostInstructions : this.currentCue.coHostInstructions;

    // Get Context (What did the other person just say?)
    let lastContext = "";
    if (this.memory) {
      const last = this.memory.getLastSpeechContext();
      if (last.speaker !== targetID && last.speaker !== "None") {
        lastContext = `Your co-host said: "${last.content}". React.`;
      }
    }

    if (this.isDebug) console.log(`[Scheduler] Cueing ${targetID}...`);

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: targetID,
      role: role,
      topic: this.currentCue.headline,
      context: this.currentCue.context,
      // Pass the instruction + stance + pacing so the Host knows how to act
      instructions: instructions,
      stance: isHostA ? this.currentCue.hostStance : this.currentCue.coHostStance,
      lastSpeakerContext: lastContext,
      pacingStyle: this.currentCue.pacingStyle
    });

    this.currentTurn++;

    // Safety Watchdog (45s)
    this.watchdogTimer = this.async.setTimeout(() => {
        console.warn(`[Scheduler] Watchdog: ${targetID} timed out! Forcing next.`);
        this.cueNextSpeaker();
    }, 45000);
  }

  private handleSpeechComplete(data: { hostID: string; contentSummary: string }) {
    // Clear watchdog
    if (this.watchdogTimer) {
        this.async.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
    }

    if (this.memory) {
      this.memory.logBroadcast(data.hostID, data.contentSummary);
    }

    // Wait for the "Turn Delay" (Paced Gap) then cue next
    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, this.currentTurnDelay * 1000); 
  }

  private finishSegment() {
    this.isSegmentActive = false;
    if (this.isDebug) console.log(`[Scheduler] Segment Complete.`);

    if (this.nextCue) {
        // Seamless transition to buffer
        this.startSegment(this.nextCue);
    } else {
        // Emergency: Request again
        console.warn("[Scheduler] Buffer empty! Stalling...");
        this.requestNextSegment();
    }
  }
}

Component.register(ShowScheduler);