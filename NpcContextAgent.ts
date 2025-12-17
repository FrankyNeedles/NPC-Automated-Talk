// NpcContextAgent.ts
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
    if (this.props.memoryEntity) {
      const ent = this.props.memoryEntity as Entity;
      this.memory = ent.as(SmartNpcMemory as any) as any;
    } else {
      this.memory = this.entity.as(SmartNpcMemory as any) as any;
    }

    this.async.setInterval(this.analyzeVibe.bind(this), this.props.checkInterval * 1000);

    if (this.props.triggerZone) {
        this.connectCodeBlockEvent(this.props.triggerZone, CodeBlockEvents.OnPlayerEnterTrigger, this.onAudienceEnter.bind(this));
        this.connectCodeBlockEvent(this.props.triggerZone, CodeBlockEvents.OnPlayerExitTrigger, this.onAudienceExit.bind(this));
    }
  }

  private onAudienceEnter(player: Player) {
    if (!this.memory) return;
    if (this.playerTimers.has(player.id)) {
        this.async.clearTimeout(this.playerTimers.get(player.id)!);
        this.playerTimers.delete(player.id);
    }
    
    // FIX: Cast to 'any' to bypass strict TS check
    (this.memory as any).handlePlayerEntry(player);
  }

  private onAudienceExit(player: Player) {
    if (!this.memory) return;
    const tId = this.async.setTimeout(() => {
        if (this.memory) {
            // FIX: Cast to 'any'
            (this.memory as any).handlePlayerExit(player.name.get());
        }
        this.playerTimers.delete(player.id);
    }, 1000);
    this.playerTimers.set(player.id, tId);
  }

  private analyzeVibe() {
    if (!this.memory) return;
    const w = this.world as any;
    const currentPlayers = (w.getPlayers ? w.getPlayers() : w.players) as Player[];
    this.activePlayers = currentPlayers || [];
    
    let energyLabel = this.activePlayers.length > 4 ? "Chaotic" : (this.activePlayers.length > 1 ? "Active" : "Chill");
    
    // FIX: Cast to 'any'
    (this.memory as any).updateRoomStats(this.activePlayers.length, energyLabel);
  }
}

Component.register(NpcContextAgent);