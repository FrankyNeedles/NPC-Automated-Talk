// StationDirector.ts
/**
 * StationDirector.ts
 * 
 * UPGRADE: "Emotional Direction"
 * - Director now assigns specific emotions (Shock, Laughter, Sarcasm) 
 *   to ensure hosts don't sound flat.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, DayPart } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

const DirectorCueEvent = new NetworkEvent<any>('DirectorCueEvent');
const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  
  private recentTopicIDs: string[] = [];
  private showHour: number = 12; 
  private isDebug: boolean = false;
  private cachedCue: any = null; 
  private isGenerating: boolean = false;

  // EMOTIONAL SPINS
  private readonly SPINS = [
    { label: "Conflict", p1: "Argue passionately.", p2: "Dismiss their claim." },
    { label: "Comedy", p1: "Make a joke about this.", p2: "Laugh loudly." },
    { label: "Mystery", p1: "Whisper a secret detail.", p2: "Gasp in shock." },
    { label: "Nostalgia", p1: "Recall a fond memory.", p2: "Agree warmly." },
    { label: "Sarcasm", p1: "Be incredibly sarcastic.", p2: "Roll your eyes verbally." }
  ];

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.handleSegmentRequest.bind(this));

    this.async.setTimeout(() => {
        this.generateFutureSegment();
    }, 2000); 
  }

  public handleSegmentRequest() {
    if (this.cachedCue) {
        if (this.isDebug) console.log(`[Director] Deploying Cached Plan.`);
        this.sendNetworkBroadcastEvent(DirectorCueEvent, this.cachedCue);
        this.cachedCue = null;
        this.generateFutureSegment();
    } else {
        if (this.isDebug) console.log("[Director] Cache Empty. Using Logic Plan.");
        const instantPlan = this.createLogicPlan();
        this.sendNetworkBroadcastEvent(DirectorCueEvent, instantPlan);
        this.generateFutureSegment();
    }
  }

  // --- Logic Plan (Fast Path) ---
  private createLogicPlan(): any {
    const { dayPart, segment, duration, roomVibe, audienceStr } = this.getEnvironmentData();
    const story = this.pickBestStory(dayPart);
    
    // Pick Emotional Spin
    let spinIndex = Math.floor(Math.random() * this.SPINS.length);
    if (roomVibe === "Chaotic") spinIndex = 1; // Force Comedy/Conflict
    const spin = this.SPINS[spinIndex];

    const anchorInstr = `${spin.p1} Context: ${story.hostAngle}`;
    const coHostInstr = `${spin.p2} Context: ${story.coHostAngle}`;
    
    let contextData = `Topic: ${story.headline}. ${story.body}. Vibe: ${spin.label}. ${audienceStr}`;
    let pacing = "Casual";

    if (segment === "AUDIENCE_Q_A") {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        contextData = `Q&A. ${audienceStr}. Question: "${q || "None"}"`;
        pacing = "Relaxed";
    }

    if (this.memory && story.id && !story.id.startsWith("filler")) {
        this.memory.markContentAsUsed(story.id);
    }

    return {
      segment, topicID: story.id, headline: story.headline, context: contextData,
      hostInstructions: anchorInstr, coHostInstructions: coHostInstr, duration, pacingStyle: pacing
    };
  }

  // --- AI Plan (Slow Path) ---
  private async generateFutureSegment() {
    if (this.isGenerating || !this.directorNPC) return;
    this.isGenerating = true;

    const { dayPart, segment, duration, roomVibe, audienceStr } = this.getEnvironmentData();
    const story = this.pickBestStory(dayPart);

    // AI PROMPT: Demand Emotion
    const systemPrompt = 
      `ACT AS: TV Producer. TIME: ${dayPart}. VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segment}.\n` +
      `TOPIC: ${story.headline}\n` +
      `TASK: Write stage directions. Give distinct EMOTIONS to each host.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed]\n` +
      `ANCHOR_DIR: [Action + Emotion]\n` +
      `COHOST_DIR: [Action + Emotion]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.cachedCue = this.createLogicPlan();
        this.isGenerating = false;
        return;
      }

      // 40s Timeout
      const timeoutPromise = new Promise((_, reject) => this.async.setTimeout(() => reject(new Error("Timeout")), 40000));
      const aiPromise = this.directorNPC.conversation.elicitResponse(systemPrompt);
      const response = await Promise.race([aiPromise, timeoutPromise]);
      const responseText = typeof response === 'string' ? response : (response as any).text;
      
      this.cachedCue = this.parseAIResponse(responseText, segment, story, duration, audienceStr);

    } catch (e) {
      if (this.isDebug) console.warn("[Director] Background Gen Failed. Using Logic.");
      this.cachedCue = this.createLogicPlan();
    }
    
    this.isGenerating = false;
  }

  // --- Helpers ---
  private getEnvironmentData() {
    const now = new Date();
    this.showHour = now.getHours();
    const dayPart = VortexMath.getDayPart(this.showHour);
    const cycle = ["HEADLINES", "DEEP_DIVE", "BANTER", "AUDIENCE_Q_A"];
    const rnd = Math.floor(Date.now() / 1000 / 120) % cycle.length; 
    const segment = cycle[rnd];
    const duration = VortexMath.calculateSegmentDuration(segment as any, dayPart);
    let roomVibe = this.memory ? this.memory.getRoomVibe() : "Normal";
    const aud = this.memory ? this.memory.getAudienceList() : [];
    const audienceStr = aud.length > 0 ? `Guests: ${aud.length}` : "(No Guests)";
    return { dayPart, segment, duration, roomVibe, audienceStr };
  }

  private pickBestStory(dayPart: DayPart): any {
    let valid = NEWS_WIRE.filter(s => s.validDayParts.includes(dayPart));
    if (this.memory) valid = valid.filter(s => !this.memory!.isContentBurned(s.id));
    if (valid.length === 0) return FILLER_POOL[0]; 
    return valid[Math.floor(Math.random() * valid.length)];
  }

  private parseAIResponse(aiText: string, segment: string, story: any, duration: number, audienceContext: string): any {
    let pacing = "Casual";
    let anchorInstr = story.hostAngle;
    let coHostInstr = story.coHostAngle;

    const paceMatch = aiText.match(/PACING:\s*(\w+)/);
    const anchorMatch = aiText.match(/ANCHOR_DIR:\s*(.*)/);
    const cohostMatch = aiText.match(/COHOST_DIR:\s*(.*)/);

    if (paceMatch) pacing = paceMatch[1];
    if (anchorMatch) anchorInstr = anchorMatch[1];
    if (cohostMatch) coHostInstr = cohostMatch[1];

    if (this.memory && story.id && !story.id.startsWith("filler")) this.memory.markContentAsUsed(story.id);

    let contextData = `Topic: ${story.headline}. ${story.body}. ${audienceContext}`;
    
    if (segment === "AUDIENCE_Q_A") {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        contextData = `Q&A. ${audienceContext}. Question: "${q}"`;
        pacing = "Relaxed";
    }

    return { segment, topicID: story.id, headline: story.headline, context: contextData,
      hostInstructions: anchorInstr, coHostInstructions: coHostInstr, duration, pacingStyle: pacing };
  }
}

Component.register(StationDirector);