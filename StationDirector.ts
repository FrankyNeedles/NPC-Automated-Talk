// StationDirector.ts
/**
 * StationDirector.ts
 * The "Program Director" (Hidden NPC).
 * 
 * RESPONSIBILITIES:
 * 1. CLOCK: Tracks virtual Day Parts.
 * 2. STRATEGY: Selects topics based on Vibe + History + Engagement.
 * 3. GAMIFICATION: Opens "Pitch Window" after episodes. Scores pitches.
 * 4. VISUALS: Controls the "Availability Light" and "Office Trigger".
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { Npc, NpcConversation } from 'horizon/npc'; 
import { NEWS_WIRE, NewsStory, FILLER_POOL } from './TopicsDatabase';
import { VortexMath, BroadcastSegment, DayPart } from './VortexMath';
import { SmartNpcMemory } from './SmartNpcMemory';

// Standard Events
const DirectorCueEvent = new NetworkEvent<{ 
  segment: string; 
  topicID: string; 
  headline: string;
  context: string;
  hostInstructions: string;
  coHostInstructions: string;
  duration: number;
  pacingStyle: string;
}>('DirectorCueEvent');

const RequestSegmentEvent = new NetworkEvent('RequestSegmentEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

// Feedback to player
const DirectorPitchResultEvent = new NetworkEvent<{ user: string; result: string }>('DirectorPitchResultEvent');

export class StationDirector extends Component<typeof StationDirector> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, label: "Memory Link" },
    
    // Physical Office Props
    availabilityLight: { type: PropTypes.Entity, label: "Office Light" }, // Turns Green when taking pitches
    officeTrigger: { type: PropTypes.Entity, label: "Office Trigger" },   // Only enabled during breaks
    
    // Tuning
    segmentsPerEpisode: { type: PropTypes.Number, default: 5 },
    pitchWindowDuration: { type: PropTypes.Number, default: 45 },
    minScoreThreshold: { type: PropTypes.Number, default: 20 },
    
    debugMode: { type: PropTypes.Boolean, default: true }
  };

  private memory: SmartNpcMemory | undefined;
  private directorNPC: Npc | undefined;
  
  private showHour: number = 12; 
  private isDebug: boolean = false;
  private cachedCue: any = null; 
  private isGenerating: boolean = false;

  // Episode State
  private segmentsRun: number = 0;
  private isPostShow: boolean = false;
  private pendingPitches: { user: string; text: string; score: number }[] = [];

  // Creative Spins
  private readonly SPINS = [
    { label: "Standard", p1: "Lead discussion.", p2: "Add commentary." },
    { label: "Heated Debate", p1: "Take strong stance FOR.", p2: "Take strong stance AGAINST." },
    { label: "Conspiracy", p1: "Whisper about truth.", p2: "Act paranoid." },
    { label: "Roast", p1: "Mock this topic.", p2: "Laugh and punchline." },
    { label: "Pop Quiz", p1: "Quiz co-host.", p2: "Guess answer." }
  ];

  async start() {
    this.isDebug = this.props.debugMode;
    this.directorNPC = this.entity.as(Npc);
    
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    }

    this.connectNetworkBroadcastEvent(RequestSegmentEvent, this.handleSegmentRequest.bind(this));
    this.connectNetworkBroadcastEvent(PitchSubmittedEvent, this.handlePitch.bind(this));

    // Initialize Office State (Closed)
    this.setOfficeState(false);

    // Boot Pipeline
    this.async.setTimeout(() => this.generateFutureSegment(), 2000); 
  }

  public handleSegmentRequest() {
    if (this.isPostShow) return; 

    if (this.segmentsRun >= this.props.segmentsPerEpisode) {
        this.startPostShow();
        return;
    }

    if (this.cachedCue) {
        if (this.isDebug) console.log(`[Director] Deploying Cached Plan.`);
        this.sendNetworkBroadcastEvent(DirectorCueEvent, this.cachedCue);
        this.cachedCue = null;
        this.segmentsRun++;
        this.generateFutureSegment();
    } else {
        if (this.isDebug) console.log("[Director] Cache Empty. Using Fast Path.");
        const instantPlan = this.createLogicPlan();
        this.sendNetworkBroadcastEvent(DirectorCueEvent, instantPlan);
        this.segmentsRun++;
        this.generateFutureSegment();
    }
  }

  // --- Post Show / Pitch Logic ---

  private startPostShow() {
    this.isPostShow = true;
    this.segmentsRun = 0;
    this.pendingPitches = [];
    
    // OPEN THE OFFICE
    this.setOfficeState(true);
    if (this.isDebug) console.log("[Director] *** PITCH WINDOW OPEN ***");

    // Cue "Commercial"
    this.sendNetworkBroadcastEvent(DirectorCueEvent, {
        segment: "COMMERCIAL",
        topicID: "break",
        headline: "Commercial Break",
        context: "The Director is available for pitches. Hosts take a break.",
        hostInstructions: "Sign off briefly.",
        coHostInstructions: "Mention grabbing coffee.",
        duration: this.props.pitchWindowDuration,
        pacingStyle: "Relaxed"
    });

    this.async.setTimeout(() => this.endPostShow(), this.props.pitchWindowDuration * 1000);
  }

  private handlePitch(data: { userId: string; text: string }) {
    if (!this.isPostShow) return;

    // SCORING ALGORITHM
    let score = 10; // Base
    
    // 1. Length Bonus (Effort)
    score += Math.min(data.text.length, 20);
    
    // 2. Reputation Bonus (Loyalty)
    if (this.memory) {
        const rep = this.memory.getPlayerReputation(data.userId as any); // Cast for name lookup
        score += rep;
    }

    // 3. Engagement Bonus (Room Hype)
    if (this.memory) {
        const hype = this.memory.getEngagementStats(); // 0.0 to 1.0
        score += (hype * 20);
    }

    this.pendingPitches.push({ user: data.userId, text: data.text, score });
    if (this.isDebug) console.log(`[Director] Pitch: "${data.text}" Score: ${score.toFixed(1)}`);
  }

  private endPostShow() {
    this.isPostShow = false;
    this.setOfficeState(false); // Close Office

    let winningTopic: any = null;

    if (this.pendingPitches.length > 0) {
        // Pick Winner
        this.pendingPitches.sort((a, b) => b.score - a.score);
        const winner = this.pendingPitches[0];
        
        // Threshold Check
        if (winner.score >= this.props.minScoreThreshold) {
            winningTopic = {
                id: "pitch_" + Date.now(),
                headline: "Viewer Request",
                category: "Audience",
                body: `Viewer ${winner.user} proposed: "${winner.text}"`,
                hostAngle: "Introduce viewer topic.", 
                coHostAngle: "React strongly.",
                validDayParts: ["Any"], intensity: 8
            };
            if (this.memory) this.memory.updatePlayerReputation(winner.user as any, 5);
            
            // Notify Player
            this.sendNetworkBroadcastEvent(DirectorPitchResultEvent, { 
                user: winner.user, 
                result: "ACCEPTED! Airing Next." 
            });
        }
    }

    this.generateFutureSegment(true, winningTopic);
  }

  private setOfficeState(isOpen: boolean) {
      if (this.props.availabilityLight) {
          const light = this.props.availabilityLight as Entity;
          // Example: Green if Open, Red/Off if Closed
          if (light.visible) light.visible.set(isOpen);
      }
      // Note: Trigger logic is handled by ChatInputTerminal checking Director state
      // or we could enable/disable the trigger entity here if needed.
  }

  // --- Hybrid Pipeline (Same as before) ---

  private createLogicPlan(): any {
    const { dayPart, segment, duration, roomVibe, audienceStr } = this.getEnvironmentData();
    const story = this.pickBestStory(dayPart);
    let spinIndex = Math.floor(Math.random() * this.SPINS.length);
    if (roomVibe === "Chaotic") spinIndex = 1; 
    const spin = this.SPINS[spinIndex];
    const anchorInstr = `${spin.p1} Context: ${story.hostAngle}`;
    const coHostInstr = `${spin.p2} Context: ${story.coHostAngle}`;
    let contextData = `Topic: ${story.headline}. ${story.body}. Angle: ${spin.label}. ${audienceStr}`;
    let pacing = "Casual";
    if (segment === "AUDIENCE_Q_A") {
        const q = this.memory ? this.memory.getLatestChatQuestion() : "";
        contextData = `Q&A. ${audienceStr}. Question: "${q}"`;
        pacing = "Relaxed";
    }
    return {
      segment, topicID: story.id, headline: story.headline, context: contextData,
      hostInstructions: anchorInstr, coHostInstructions: coHostInstr, duration, pacingStyle: pacing
    };
  }

  private async generateFutureSegment(sendImmediately: boolean = false, forcedTopic: any = null) {
    if (this.isGenerating && !sendImmediately) return;
    this.isGenerating = true;

    if (!this.directorNPC) {
        this.directorNPC = this.entity.as(Npc);
        if (!this.directorNPC) { this.isGenerating = false; return; }
    }

    const { dayPart, segment, duration, roomVibe, audienceStr } = this.getEnvironmentData();
    const story = forcedTopic || this.pickBestStory(dayPart);

    const systemPrompt = 
      `ACT AS: TV Producer. TIME: ${dayPart}. VIBE: ${roomVibe}. ${audienceStr}.\n` +
      `SEGMENT: ${segment}.\n` +
      `TOPIC: "${story.headline}"\n` +
      `TASK: Directions for hosts.\n` +
      `OUTPUT FORMAT:\n` +
      `PACING: [Rapid/Relaxed/Debate]\n` +
      `ANCHOR_DIR: [Instruction]\n` +
      `COHOST_DIR: [Instruction]`;

    try {
      const aiReady = await NpcConversation.isAiAvailable();
      if (!aiReady) {
        this.finalizePlan(this.createLogicPlan(), sendImmediately);
        return;
      }
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

  private finalizePlan(cueData: any, sendNow: boolean) {
    this.isGenerating = false;
    if (sendNow) this.sendNetworkBroadcastEvent(DirectorCueEvent, cueData);
    else this.cachedCue = cueData;
  }

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