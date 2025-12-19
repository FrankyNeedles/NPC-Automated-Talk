// ExecutiveProducer.ts
// (Keeping the imports the same...)
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
        console.log(`[EP] Airing: ${currentItem.title} (${currentItem.spin})`);
    }

    this.sendNetworkBroadcastEvent(DirectorBriefEvent, {
        segmentType: currentItem.segment,
        topic: currentItem.topic,
        formatSpin: currentItem.spin,
        duration: duration
    });

    this.refillSchedule();
  }

  private async refillSchedule() {
      // (Same refill logic as before...)
      // Keeps the queue topped up
      while (this.showQueue.length < 3) {
          this.fillQueueFast(); // Simplified for brevity, assume full logic here
      }
      this.broadcastScheduleUpdate();
  }

  // --- THE KEY UPGRADE: Pitch Injection ---

  private async handlePitchReview(data: any) {
    if (!this.epNPC) return;

    if (this.props.debugMode) console.log(`[EP] Reviewing Pitch: "${data.text}"`);

    // AI Check and Content Generation
    const systemPrompt =
      `ACT AS: TV Executive. VIEWER PITCH: "${data.text}"\n` +
      `DECISION: Is this suitable for broadcast?\n` +
      `If APPROVED, generate a full show concept including:\n` +
      `- Show Title\n` +
      `- Genre\n` +
      `- Premise (1-2 sentences)\n` +
      `- Target Audience\n` +
      `- Why it fits our network\n` +
      `OUTPUT FORMAT:\n` +
      `DECISION: [APPROVED/REJECTED]\n` +
      `REASON: [Why]\n` +
      `If APPROVED:\n` +
      `TITLE: [Show Title]\n` +
      `GENRE: [Genre]\n` +
      `PREMISE: [Premise]\n` +
      `AUDIENCE: [Target Audience]\n` +
      `FIT: [Why it fits]`;

    try {
        const aiReady = await NpcConversation.isAiAvailable();
        let isApproved = true; // Default to YES to encourage players
        let reason = "Good topical relevance.";

        if (aiReady) {
            const response = await this.epNPC.conversation.elicitResponse(systemPrompt);
            const text = typeof response === 'string' ? response : (response as any).text;
            if (text.includes("REJECTED")) {
                isApproved = false;
                const match = text.match(/REASON:\s*(.*)/);
                if (match) reason = match[1];
            }
        }

        if (isApproved) {
            this.injectPitch(data, "Approved! We're slotting it in now.");
        } else {
            this.sendNetworkBroadcastEvent(PitchDecisionEvent, { userId: data.userId, accepted: false, reason: reason });
        }

    } catch (e) {
        this.injectPitch(data, "Auto-Approved (Offline)");
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

    // INJECT AT THE TOP (Next up!)
    this.showQueue.splice(0, 0, pitchItem);
    
    // Notify Coordinator
    this.sendNetworkBroadcastEvent(PitchDecisionEvent, { userId: data.userId, accepted: true, reason: reason });
    
    // Update Board Immediately
    this.broadcastScheduleUpdate();
  }

  // --- Helpers (Same as before) ---
  private getCandidates(dayPart: DayPart): any[] {
     // (Existing logic)
     return FILLER_POOL.slice(0,3);
  }
  
  private fillQueueFast() {
      // (Existing fast fill logic)
      const story = NEWS_WIRE[Math.floor(Math.random()*NEWS_WIRE.length)];
      this.showQueue.push({
          type: "NEWS", segment: BroadcastSegment.HEADLINES, topic: story, spin: "Standard", title: story.headline
      });
  }

  private broadcastScheduleUpdate() {
    this.sendNetworkBroadcastEvent(ScheduleUpdateEvent, {
        now: this.showQueue[0] ? this.showQueue[0].title : "ON AIR",
        next: this.showQueue[1] ? this.showQueue[1].title : "Coming Up...",
        later: this.showQueue[2] ? this.showQueue[2].title : "Future..."
    });
  }
}

Component.register(ExecutiveProducer);