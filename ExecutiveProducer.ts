// ExecutiveProducer.ts
/**
 * ExecutiveProducer.ts
 * The "Station Boss" (Hidden NPC).
 * 
 * UPGRADE: "Dynamic Creative Engine"
 * - Selects topics based on DayPart/Vibe.
 * - INVENTS new topics if the room vibe triggers a "Breaking News" event.
 * - Expands player pitches from simple words into full "Show Concepts".
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
// Note: We use 'any' for the topic type to support both DB stories and AI-generated ones
import { NEWS_WIRE, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, DayPart } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

// OUTPUT: Tells the Director what to write
const DirectorBriefEvent = new NetworkEvent<{ 
  segmentType: string;
  topic: any;
  formatSpin: string; 
  duration: number;
}>('DirectorBriefEvent');

// OUTPUT: Updates the TV Screen UI
const ScheduleUpdateEvent = new NetworkEvent<{ 
  now: string; 
  next: string; 
  later: string; 
}>('ScheduleUpdateEvent');

// INPUTS
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');
const PitchDecisionEvent = new NetworkEvent<{ userId: string; accepted: boolean; reason: string }>('PitchDecisionEvent');

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
    if (!this.epNPC) console.error("[EP] CRITICAL: Script must be on a Hidden NPC!");

    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.handleNextRequest.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitchReview.bind(this));

    // Boot up: Fill the schedule
    this.async.setTimeout(() => this.refillSchedule(), 2000);
  }

  // --- Runtime Logic ---

  private handleNextRequest() {
    // Emergency fill if empty
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

    // Command the Director
    this.sendNetworkBroadcastEvent(DirectorBriefEvent, {
        segmentType: currentItem.segment,
        topic: currentItem.topic,
        formatSpin: currentItem.spin,
        duration: duration
    });

    this.refillSchedule();
  }

  // --- AI Scheduling Logic ---

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
    
    // Cycle Vortex
    this.currentVortex = VortexMath.getNextState(this.currentVortex);
    const segment = VortexMath.getSegmentLabel(this.currentVortex);
    
    let roomVibe = "Normal";
    if (this.memory) roomVibe = this.memory.getRoomVibe();

    // 1. DYNAMIC INJECTION CHECK
    // If the room is chaotic, 30% chance to INVENT a story instead of using the DB.
    if ((roomVibe === "Chaotic" || roomVibe === "Active") && Math.random() > 0.7) {
        const dynamicItem = await this.generateDynamicTopic(roomVibe);
        if (dynamicItem) {
             this.showQueue.push(dynamicItem);
             this.broadcastScheduleUpdate();
             this.isProcessing = false;
             return;
        }
    }

    // 2. Standard Selection
    const candidates = this.getCandidates(dayPart);
    const menuString = candidates.map(s => `ID: ${s.id} | "${s.headline}" (${s.category})`).join('\n');

    const systemPrompt = 
      `ACT AS: TV Network Executive.\n` +
      `TIME: ${dayPart}. VIBE: ${roomVibe}.\n` +
      `NEXT SLOT: ${segment}.\n` +
      `MENU:\n${menuString}\n` +
      `TASK: Pick best story for ratings. Choose Spin.\n` +
      `OUTPUT: SELECTED_ID: [ID] SPIN: [Format]`;

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

  // --- Dynamic Topic Generator ---

  private async generateDynamicTopic(vibe: string): Promise<ScheduleItem | null> {
      if (!this.epNPC) return null;
      
      // Ask AI to invent news based on the room
      const prompt = `Generate a fake 'Breaking News' headline appropriate for a ${vibe} room. Make it dramatic. Return Headline Only.`;
      
      try {
          const response = await this.epNPC.conversation.elicitResponse(prompt);
          const text = typeof response === 'string' ? response : (response as any).text;
          
          return {
              type: "AI_GEN",
              segment: BroadcastSegment.DEEP_DIVE, // Force Deep Dive for Breaking News
              topic: {
                  id: "ai_" + Date.now(),
                  headline: text,
                  body: "Developing story from the studio floor.",
                  hostAngle: "Report with urgency.",
                  coHostAngle: "Speculate wildly.",
                  intensity: 9,
                  validDayParts: ["Any"]
              },
              spin: "Breaking News",
              title: "BREAKING: " + text.substring(0, 20) + "..."
          };
      } catch {
          return null;
      }
  }

  // --- Parser ---

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

  // --- Pitch Review & Concept Expansion ---

  private async handlePitchReview(data: { pitchId: string; userId: string; text: string }) {
    if (!this.epNPC) return;

    if (this.props.debugMode) console.log(`[EP] Reviewing Pitch: "${data.text}"`);

    // 1. AI Judgment
    const systemPrompt = 
      `ACT AS: TV Executive. PITCH: "${data.text}" from User.\n` +
      `DECISION: Is this interesting and safe? \n` +
      `OUTPUT: DECISION: [APPROVED/REJECTED] REASON: [Short reason]`;

    try {
        const aiReady = await NpcConversation.isAiAvailable();
        let isApproved = false;
        let reason = "Schedule full.";

        if (aiReady) {
            const response = await this.epNPC.conversation.elicitResponse(systemPrompt);
            const text = typeof response === 'string' ? response : (response as any).text;
            
            isApproved = text.includes("APPROVED");
            const reasonMatch = text.match(/REASON:\s*(.*)/);
            if (reasonMatch) reason = reasonMatch[1];
        } else {
            // Offline fallback
            if (data.text.length > 5) {
                isApproved = true;
                reason = "Offline Approval.";
            }
        }

        if (isApproved) {
            // 2. CONCEPT EXPANSION (Turn "Cats" into "The Catwalk")
            const concept = await this.generateShowConcept(data.text);
            this.injectPitch(data, reason, concept);
        } else {
            this.sendNetworkBroadcastEvent(PitchDecisionEvent, { userId: data.userId, accepted: false, reason: reason });
        }
    } catch (e) {
        console.warn("[EP] Pitch Error", e);
    }
  }

  private async generateShowConcept(pitchText: string): Promise<any> {
      if (!this.epNPC) return { title: pitchText, premise: "Viewer Request" };
      
      const prompt = `Turn this pitch into a Reality Show Concept: "${pitchText}". Return TITLE and PREMISE.`;
      const response = await this.epNPC.conversation.elicitResponse(prompt);
      const text = typeof response === 'string' ? response : (response as any).text;
      
      // Simple parsing or just pass the text as the premise
      return {
          title: "Viewer Special",
          premise: text
      };
  }

  private injectPitch(data: any, reason: string, concept: any) {
      const pitchItem: ScheduleItem = {
        type: "PITCH",
        segment: BroadcastSegment.AUDIENCE,
        topic: {
            id: "pitch_" + Date.now(),
            headline: concept.title,
            body: `Viewer ${data.userId} pitched: "${data.text}". Concept: ${concept.premise}`,
            hostAngle: "Introduce the new show concept.", 
            coHostAngle: "React to the idea.",
            intensity: 8, validDayParts: ["Any"]
        },
        spin: "New Show Pitch",
        title: `PILOT: ${data.text.substring(0,10)}...`
    };

    // INJECT AT TOP (Next up!)
    if (this.showQueue.length > 0) this.showQueue.splice(0, 0, pitchItem);
    else this.showQueue.push(pitchItem);

    if (this.memory) this.memory.updatePlayerReputation(data.userId, 5);
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

  private fillQueueFast() {
      const story = NEWS_WIRE[Math.floor(Math.random() * NEWS_WIRE.length)];
      const segment = BroadcastSegment.BANTER;
      this.showQueue.push({
          type: "NEWS", segment, topic: story, spin: "Standard", title: story.headline
      });
      this.broadcastScheduleUpdate();
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