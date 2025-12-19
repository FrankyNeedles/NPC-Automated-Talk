// ExecutiveProducer.ts
import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, DayPart } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorBriefEvent = new NetworkEvent<any>('DirectorBriefEvent');
const ScheduleUpdateEvent = new NetworkEvent<any>('ScheduleUpdateEvent');
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const PitchSubmittedEvent = new NetworkEvent<any>('PitchSubmittedEvent');
const PitchDecisionEvent = new NetworkEvent<any>('PitchDecisionEvent');

interface ScheduleItem {
  type: string; 
  segment: BroadcastSegment;
  topic: any;
  spin: string;
  title: string;
}

export class ExecutiveProducer extends Component<typeof ExecutiveProducer> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private epNPC: Npc | undefined;
  private showQueue: ScheduleItem[] = [];
  private currentVortex: number = 1;
  private isProcessing: boolean = false;
  private lastSpinUsed: string = "";

  private readonly SPINS = ["Standard Report", "Heated Debate", "Deep Dive", "Hot Take", "Pop Quiz"];

  async start() {
    this.epNPC = this.entity.as(Npc);
    if (!this.epNPC) console.error("[EP] Critical: Must be on Hidden NPC!");

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.handleNextRequest.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchReview.bind(this));

    this.async.setTimeout(() => this.refillSchedule(), 2000);
  }

  private handleNextRequest() {
    if (this.showQueue.length === 0) {
        this.fillQueueFast();
    }
    const currentItem = this.showQueue.shift();
    if (!currentItem) return;

    this.broadcastScheduleUpdate();

    const now = new Date();
    const dayPart = VortexMath.getDayPart(now.getHours());
    const duration = VortexMath.calculateSegmentDuration(currentItem.segment, dayPart);

    if (this.props.debugMode) {
        console.log(`[EP] Greenlight: ${currentItem.title} (${currentItem.spin})`);
    }

    this.sendNetworkBroadcastEvent(DirectorBriefEvent, {
        segmentType: currentItem.segment,
        topic: currentItem.topic,
        formatSpin: currentItem.spin,
        duration: duration
    });

    this.refillSchedule();
  }

  // --- Strategic Scheduling ---

  private async refillSchedule() {
    if (this.isProcessing || this.showQueue.length >= 3) return;
    this.isProcessing = true;

    if (!this.epNPC) {
        this.fillQueueFast(); 
        this.isProcessing = false;
        return;
    }

    const now = new Date();
    const dayPart = VortexMath.getDayPart(now.getHours());
    this.currentVortex = VortexMath.getNextState(this.currentVortex);
    const segment = VortexMath.getSegmentLabel(this.currentVortex);
    
    // STRATEGY: Block Programming
    // If Morning, force News. If Night, force Debate/Weird.
    const candidates = this.getCandidates(dayPart);
    const menuString = candidates.map(s => `ID: ${s.id} | "${s.headline}" (${s.category})`).join('\n');

    const systemPrompt = 
      `ACT AS: TV Network Executive.\n` +
      `TIME: ${dayPart}.\n` +
      `GOAL: Build the lineup. Maintain variety.\n` +
      `AVAILABLE CONTENT:\n${menuString}\n` +
      `TASK: Pick the best story for this Time Block. Choose a Format/Spin.\n` +
      `OUTPUT FORMAT:\n` +
      `SELECTED_ID: [ID]\n` +
      `SPIN: [Standard Report/Heated Debate/Deep Dive/Hot Take]`;

    try {
        const aiReady = await NpcConversation.isAiAvailable();
        if (aiReady) {
            const timeoutPromise = new Promise((_, reject) => this.async.setTimeout(() => reject(new Error("Timeout")), 20000));
            const aiPromise = this.epNPC.conversation.elicitResponse(systemPrompt);
            const response = await Promise.race([aiPromise, timeoutPromise]);
            const text = typeof response === 'string' ? response : (response as any).text;

            this.parseAndSchedule(text, candidates, segment);
        } else {
            this.fillQueueFast();
        }
    } catch (e) {
        this.fillQueueFast();
    }

    this.isProcessing = false;
    
    if (this.showQueue.length < 3) {
        this.async.setTimeout(() => this.refillSchedule(), 1000);
    } else {
        this.broadcastScheduleUpdate();
    }
  }

  private parseAndSchedule(aiText: string, candidates: any[], segment: BroadcastSegment) {
      let selectedID = "";
      let spin = "Standard Report";

      const idMatch = aiText.match(/SELECTED_ID:\s*(\w+)/);
      const spinMatch = aiText.match(/SPIN:\s*(.*)/);

      if (idMatch) selectedID = idMatch[1];
      if (spinMatch) spin = spinMatch[1];

      const story = candidates.find(s => s.id === selectedID) || candidates[0];
      this.lastSpinUsed = spin; 

      this.showQueue.push({
          type: "NEWS",
          segment: segment,
          topic: story,
          spin: spin,
          title: story.headline || story.topic
      });
  }

  private fillQueueFast() {
      const now = new Date();
      const dayPart = VortexMath.getDayPart(now.getHours());
      this.currentVortex = VortexMath.getNextState(this.currentVortex);
      const segment = VortexMath.getSegmentLabel(this.currentVortex);
      const story = this.getCandidates(dayPart)[0];
      
      let spin = this.SPINS[Math.floor(Math.random() * this.SPINS.length)];
      this.lastSpinUsed = spin;

      this.showQueue.push({
          type: "NEWS",
          segment: segment,
          topic: story,
          spin: spin,
          title: story.headline || story.topic
      });
      this.broadcastScheduleUpdate();
  }

  // --- Pitch Review ---

  private async handlePitchReview(data: any) {
    if (!this.epNPC) return;

    // AI JUDGMENT
    const systemPrompt = 
      `ACT AS: TV Executive. VIEWER PITCH: "${data.text}"\n` +
      `DECISION: Is this interesting? Does it fit our network?\n` +
      `OUTPUT: \nDECISION: [APPROVED/REJECTED]\nREASON: [Short reason for the player]`;

    try {
        const aiReady = await NpcConversation.isAiAvailable();
        if (aiReady) {
            const response = await this.epNPC.conversation.elicitResponse(systemPrompt);
            const text = typeof response === 'string' ? response : (response as any).text;
            
            const isApproved = text.includes("APPROVED");
            const reasonMatch = text.match(/REASON:\s*(.*)/);
            const reason = reasonMatch ? reasonMatch[1] : "Scheduling conflicts.";

            if (isApproved) {
                this.injectPitch(data, reason);
            } else {
                this.sendNetworkBroadcastEvent(PitchDecisionEvent, { userId: data.userId, accepted: false, reason: reason });
            }
        } else {
            this.injectPitch(data, "Auto-Approved (Offline)");
        }
    } catch (e) {
        console.warn("[EP] Pitch Error", e);
    }
  }

  private injectPitch(data: any, reason: string) {
      const pitchItem: ScheduleItem = {
        type: "PITCH",
        segment: BroadcastSegment.AUDIENCE,
        topic: {
            id: "pitch_" + Date.now(),
            headline: "Viewer Request",
            body: `Viewer ${data.userId} wants to discuss: "${data.text}"`,
            hostAngle: "Read request.", coHostAngle: "React.",
            intensity: 8, validDayParts: ["Any"]
        },
        spin: "Viewer Mailbag",
        title: `REQ: ${data.text}`
    };

    // Inject into slot #1 (Up Next)
    if (this.showQueue.length > 0) {
        this.showQueue.splice(1, 0, pitchItem);
    } else {
        this.showQueue.push(pitchItem);
    }

    this.sendNetworkBroadcastEvent(PitchDecisionEvent, { userId: data.userId, accepted: true, reason: reason });
    this.broadcastScheduleUpdate();
  }

  // --- Helpers ---
  private getCandidates(dayPart: DayPart): any[] {
    let valid = NEWS_WIRE.filter(s => s.validDayParts.includes(dayPart) || s.validDayParts.includes("Any" as any));
    if (this.memory) valid = valid.filter(s => !this.memory!.isContentBurned(s.id));
    if (valid.length === 0) return FILLER_POOL.slice(0, 3);
    
    for (let i = valid.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [valid[i], valid[j]] = [valid[j], valid[i]];
    }
    return valid.slice(0, 3);
  }

  private broadcastScheduleUpdate() {
    this.sendNetworkBroadcastEvent(ScheduleUpdateEvent, {
        now: this.showQueue[0] ? this.showQueue[0].title : "Station ID",
        next: this.showQueue[1] ? this.showQueue[1].title : "Coming Up...",
        later: this.showQueue[2] ? this.showQueue[2].title : "Future..."
    });
  }
}

Component.register(ExecutiveProducer);