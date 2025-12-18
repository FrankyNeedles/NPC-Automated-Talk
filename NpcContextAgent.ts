// NpcContextAgent.ts
/**
 * NpcContextAgent.ts
 * The "Eyes and Ears".
 * 
 * FINAL VERSION:
 * 1. Monitors Global Player Count to set 'Room Vibe'.
 * 2. Monitors Studio Trigger to identify 'Live Audience' members.
 * 3. Feeds data cleanly into SmartNpcMemory.
 */

import { Component, PropTypes, CodeBlockEvents, Player, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';

export class NpcContextAgent extends Component<typeof NpcContextAgent> {
  static propsDefinition = {
    memoryEntity: { type: PropTypes.Entity, default: null }, 
    triggerZone: { type: PropTypes.Entity, label: "Studio Trigger (Gizmo)" },
    checkInterval: { type: PropTypes.Number, default: 2.0 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private memory: SmartNpcMemory | undefined;
  private activePlayers: Player[] = []; 
  private playerTimers: Map<number, number> = new Map();

  start() {
    // 1. Link Memory
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    if (!this.memory && this.props.debugMode) {
      console.warn("[Context] SmartNpcMemory not found!");
    }

    // 2. Start Vibe Check Loop
    this.async.setInterval(this.analyzeVibe.bind(this), this.props.checkInterval * 1000);

    // 3. Bind Trigger Events
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
    }
  }

  // --- STUDIO AUDIENCE LOGIC ---

  private onAudienceEnter(player: Player) {
    if (!this.memory) return;
    
    // Debounce: Cancel exit timer if they return quickly
    if (this.playerTimers.has(player.id)) {
        this.async.clearTimeout(this.playerTimers.get(player.id)!);
        this.playerTimers.delete(player.id);
    }

    if (this.props.debugMode) console.log(`[Context] Audience Joined: ${player.name.get()}`);
    
    // Pass to Memory (which checks persistent data)
    this.memory.handlePlayerEntry(player);
  }

  private onAudienceExit(player: Player) {
    if (!this.memory) return;

    // Delay removal by 1s to prevent flickering
    const tId = this.async.setTimeout(() => {
        if (this.memory) {
            if (this.props.debugMode) console.log(`[Context] Audience Left: ${player.name.get()}`);
            this.memory.handlePlayerExit(player.name.get());
        }
        this.playerTimers.delete(player.id);
    }, 1000);

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

    // Logic: More people = Higher Energy
    if (playerCount > 5) {
      energyLabel = "Chaotic";
    } else if (playerCount > 1) {
      energyLabel = "Active";
    }

    // Update Memory
    this.memory.updateRoomStats(playerCount, energyLabel);
  }
}

Component.register(NpcContextAgent);