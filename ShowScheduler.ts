// ShowScheduler.ts
import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';

// Events
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class ShowScheduler extends Component<typeof ShowScheduler> {
  static propsDefinition = {
    // directorEntity removed (we use events now)
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    baseSegmentDuration: { type: PropTypes.Number, default: 45, label: "Avg Segment Time (s)" },
    turnDelay: { type: PropTypes.Number, default: 1.5, label: "Turn Delay (s)" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private currentTurn: number = 0;
  private isSegmentActive: boolean = false;
  private currentCue: any = null;
  private segmentEndTime: number = 0;
  private isDebug: boolean = false;

  start() {
    this.isDebug = this.props.debugMode;

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    if (this.isDebug) console.log(`[Scheduler] Online.`);

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorCue.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    // Kickoff
    this.async.setTimeout(() => {
        this.requestNextSegment();
    }, 5000);
  }

  private requestNextSegment() {
      if (this.isDebug) console.log("[Scheduler] Broadcasting Request Signal...");
      // FIRE THE EVENT
      this.sendNetworkBroadcastEvent(RequestSegmentEvent, {});
  }

  private handleDirectorCue(data: any) {
    if (this.isDebug) console.log(`[Scheduler] Received Plan: ${data.segment}`);
    this.currentCue = data;
    this.currentTurn = 0;
    this.isSegmentActive = true;
    this.segmentEndTime = Date.now() + (this.props.baseSegmentDuration * 1000);
    this.cueNextSpeaker();
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
        lastContext = `Your co-host just said: "${last.content}". React to this.`;
      }
    }

    if (this.isDebug) console.log(`[Scheduler] Cueing ${targetID}...`);

    this.sendNetworkBroadcastEvent(CueHostEvent, {
      targetHostID: targetID,
      role: role,
      topic: this.currentCue.headline,
      context: this.currentCue.context,
      instructions: instructions,
      lastSpeakerContext: lastContext
    });

    this.currentTurn++;
  }

  private handleSpeechComplete(data: { hostID: string; contentSummary: string }) {
    if (this.isDebug) console.log(`[Scheduler] ${data.hostID} finished.`);
    if (this.memory) {
      this.memory.logBroadcast(data.hostID, data.contentSummary);
    }

    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, this.props.turnDelay * 1000); 
  }

  private finishSegment() {
    this.isSegmentActive = false;
    if (this.isDebug) console.log(`[Scheduler] Segment Complete. Requesting next...`);
    
    if (this.memory && this.currentCue) {
       this.memory.saveGlobalState(this.currentCue.topicID, 0); 
    }

    // Loop back to Director
    this.requestNextSegment();
  }
}

Component.register(ShowScheduler);