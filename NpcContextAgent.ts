// NpcContextAgent.ts
/**
 * NpcContextAgent.ts
 * The "Eyes and Ears".
 * 1. Global: Monitors movement for "Vibe" (Chill/Chaotic).
 * 2. Local: Monitors a Trigger Zone for "Live Audience".
 */

import { Component, PropTypes, CodeBlockEvents, Player, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';

export class NpcContextAgent extends Component<typeof NpcContextAgent> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, default: null }, 
    triggerZone: { type: PropTypes.Entity, label: "Studio Trigger (Gizmo)" }, // New Slot
    checkInterval: { type: PropTypes.Number, default: 2.0 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private memory: SmartNpcMemory | undefined;
  private activePlayers: Player[] = []; // Global list
  
  // Timer map for debouncing (from your snippet)
  private playerTimers: Map<number, number> = new Map();

  start() {
    // 1. Find Memory
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    // 2. Setup Global Vibe Check
    this.async.setInterval(this.analyzeVibe.bind(this), this.props.checkInterval * 1000);

    // 3. Setup Trigger Zone (The "Listening" System)
    if (this.props.triggerZone) {
        this.connectCodeBlockEvent(
            this.props.triggerZone,
            CodeBlockEvents.OnPlayerEnterTrigger,
            this.onAudienceEnter.bind(this)
        );
        this.connectCodeBlockEvent(
            this.props.triggerZone,
            CodeBlockEvents.OnPlayerExitTrigger,
            this.onAudienceExit.bind(this)
        );
    } else {
        if (this.props.debugMode) console.warn("[NpcContextAgent] No Studio Trigger assigned.");
    }
  }

  // --- STUDIO AUDIENCE LOGIC ---

  private onAudienceEnter(player: Player) {
    if (!this.memory) return;
    
    // Clear any exit timer if they re-entered quickly
    if (this.playerTimers.has(player.id)) {
        this.async.clearTimeout(this.playerTimers.get(player.id)!);
        this.playerTimers.delete(player.id);
    }

    // Tell Memory: This person is IN THE STUDIO
    if (this.props.debugMode) console.log(`[NpcContextAgent] Audience Joined: ${player.name.get()}`);
    this.memory.addStudioAudience(player.name.get());
  }

  private onAudienceExit(player: Player) {
    if (!this.memory) return;

    // Small delay before removing them (prevents flickering if they step on the line)
    const tId = this.async.setTimeout(() => {
        if (this.memory) {
            if (this.props.debugMode) console.log(`[NpcContextAgent] Audience Left: ${player.name.get()}`);
            this.memory.removeStudioAudience(player.name.get());
        }
        this.playerTimers.delete(player.id);
    }, 1000); // 1 second buffer

    this.playerTimers.set(player.id, tId);
  }

  // --- GLOBAL VIBE LOGIC ---

  private analyzeVibe() {
    if (!this.memory) return;

    const w = this.world as any;
    const currentPlayers = (w.getPlayers ? w.getPlayers() : w.players) as Player[];
    this.activePlayers = currentPlayers || [];

    const playerCount = this.activePlayers.length;
    let energyLabel = "Chill";

    if (playerCount > 4) {
      energyLabel = "Chaotic";
    } else if (playerCount > 1) {
      energyLabel = "Active";
    }

    // Update Memory with general stats
    this.memory.updateRoomStats(playerCount, energyLabel);
  }
}

Component.register(NpcContextAgent);