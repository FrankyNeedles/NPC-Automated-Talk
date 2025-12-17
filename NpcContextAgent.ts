// NpcContextAgent.ts
/**
 * NpcContextAgent.ts
 * The "Eyes" of the system.
 * 1. Global: Monitors total player count for "Vibe".
 * 2. Local: Monitors a Trigger Zone to track the "Studio Audience".
 */

import { Component, PropTypes, CodeBlockEvents, Player, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';

export class NpcContextAgent extends Component<typeof NpcContextAgent> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, default: null }, 
    triggerZone: { type: PropTypes.Entity, label: "Studio Trigger (Gizmo)" }, // Drag your Trigger Gizmo here
    checkInterval: { type: PropTypes.Number, default: 2.0 }, // How often to check global vibe
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private memory: SmartNpcMemory | undefined;
  private activePlayers: Player[] = []; 
  private playerTimers: Map<number, number> = new Map(); // For debouncing exit events

  start() {
    // 1. Find Memory
    // (We cast to any to avoid strict type issues with custom components)
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    if (!this.memory && this.props.debugMode) {
      console.warn("[NpcContextAgent] SmartNpcMemory not found!");
    }

    // 2. Setup Global Vibe Check
    this.async.setInterval(this.analyzeVibe.bind(this), this.props.checkInterval * 1000);

    // 3. Setup Trigger Zone (The Studio Area)
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
    
    // If they just left and came right back, cancel the "exit" timer
    if (this.playerTimers.has(player.id)) {
        this.async.clearTimeout(this.playerTimers.get(player.id)!);
        this.playerTimers.delete(player.id);
    }

    // Tell Memory: This person is IN THE STUDIO
    if (this.props.debugMode) console.log(`[Context] Audience Joined: ${player.name.get()}`);
    this.memory.addStudioAudience(player.name.get());
  }

  private onAudienceExit(player: Player) {
    if (!this.memory) return;

    // Wait 1 second before actually removing them. 
    // This prevents flickering if they accidentally step off the edge and back on.
    const tId = this.async.setTimeout(() => {
        if (this.memory) {
            if (this.props.debugMode) console.log(`[Context] Audience Left: ${player.name.get()}`);
            this.memory.removeStudioAudience(player.name.get());
        }
        this.playerTimers.delete(player.id);
    }, 1000);

    this.playerTimers.set(player.id, tId);
  }

  // --- GLOBAL VIBE LOGIC ---

  private analyzeVibe() {
    if (!this.memory) return;

    const w = this.world as any;
    // Robust player fetching
    const currentPlayers = (w.getPlayers ? w.getPlayers() : w.players) as Player[];
    this.activePlayers = currentPlayers || [];

    const playerCount = this.activePlayers.length;
    let energyLabel = "Chill";

    // Simple Heuristic: More people = More Energy
    if (playerCount > 4) {
      energyLabel = "Chaotic";
    } else if (playerCount > 1) {
      energyLabel = "Active";
    }

    // Send update to Memory
    this.memory.updateRoomStats(playerCount, energyLabel);
  }
}

Component.register(NpcContextAgent);