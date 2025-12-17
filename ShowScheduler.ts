// ShowScheduler.ts
import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { StationDirector } from './StationDirector';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const CueHostEvent = new NetworkEvent<any>('CueHostEvent');
const HostSpeechCompleteEvent = new NetworkEvent<{ hostID: string; contentSummary: string }>('HostSpeechCompleteEvent');

export class ShowScheduler extends Component<typeof ShowScheduler> {
  static propsDefinition = {
    directorEntity: { type: PropTypes.Entity, label: "Director Link" },
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    
    // NEW: Creator Tool for Pacing
    baseSegmentDuration: { type: PropTypes.Number, default: 45, label: "Avg Segment Time (s)" },
    turnDelay: { type: PropTypes.Number, default: 1.5, label: "Turn Delay (s)" },
    
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private director: StationDirector | undefined;
  private memory: SmartNpcMemory | undefined;
  private currentTurn: number = 0;
  private isSegmentActive: boolean = false;
  private currentCue: any = null;
  private segmentEndTime: number = 0;

  start() {
    if (this.props.directorEntity) {
      const ent = this.props.directorEntity as Entity;
      this.director = ent.as(StationDirector as any) as any;
    } else {
      this.director = this.entity.as(StationDirector as any) as any;
    }

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleDirectorCue.bind(this));
    this.connectNetworkBroadcastEvent(HostSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    this.async.setTimeout(() => {
      if (this.director) this.director.planNextSegment();
    }, 5000);
  }

  private handleDirectorCue(data: any) {
    this.currentCue = data;
    this.currentTurn = 0;
    this.isSegmentActive = true;
    
    // Use the Inspector Property for duration
    this.segmentEndTime = Date.now() + (this.props.baseSegmentDuration * 1000);

    if (this.props.debugMode) console.log(`[Scheduler] Starting Segment: ${data.segment}`);
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

    if (this.props.debugMode) console.log(`[Scheduler] Cueing ${targetID}...`);

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
    if (this.memory) {
      this.memory.logBroadcast(data.hostID, data.contentSummary);
    }

    // Use Inspector Property for delay
    this.async.setTimeout(() => {
      this.cueNextSpeaker();
    }, this.props.turnDelay * 1000); 
  }

  private finishSegment() {
    this.isSegmentActive = false;
    if (this.props.debugMode) console.log(`[Scheduler] Segment Complete.`);
    
    // Update Memory State
    if (this.memory && this.currentCue) {
       this.memory.saveGlobalState(this.currentCue.topicID, 0); // Advance state
    }

    if (this.director) {
      this.director.planNextSegment();
    }
  }
}

Component.register(ShowScheduler);