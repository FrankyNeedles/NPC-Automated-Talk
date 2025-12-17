// NarrativeEmitter.ts
/**
 * NarrativeEmitter.ts
 * Attaches to an interactive object.
 * Listens for interactions (Grab, Drop) and broadcasts NarrativeTokens to the Brain.
 */

import { Component, PropTypes, CodeBlockEvents, Player, NetworkEvent, Quaternion, Vec3 } from 'horizon/core';
import { makeObjectInteraction, makeObjectState, NarrativeToken } from './NarrativeToken';
import { getMetadata, ObjectMetadata } from './ObjectMetadata';

// Use <any> to avoid strict "SerializableState" errors
const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');

class NarrativeEmitter extends Component<typeof NarrativeEmitter> {
  static propsDefinition = {
    objectId: { type: PropTypes.String, default: "" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private metadata: ObjectMetadata | undefined;
  private lastRotation: Quaternion | null = null;
  private checkInterval: any = null;

  start() {
    // 1. Load Metadata
    const idToUse = this.props.objectId || this.entity.name.get();
    this.metadata = getMetadata(idToUse);

    if (!this.metadata) {
      if (this.props.debugMode) console.warn(`[NarrativeEmitter] No metadata found for ID: "${idToUse}". Using defaults.`);
    }

    // 2. Connect Events
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, this.onGrabStart.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabEnd, this.onGrabEnd.bind(this));

    // 3. Start Monitoring
    if (this.metadata && (this.metadata.trackRotation || this.metadata.trackScale)) {
        this.checkInterval = this.async.setInterval(this.checkStateChange.bind(this), 1000); 
        this.lastRotation = this.entity.rotation.get();
    }
  }

  private onGrabStart(isRightHand: boolean, player: Player) {
    this.emitInteraction("picked_up", player);
  }

  private onGrabEnd(player: Player) {
    this.emitInteraction("put_down", player);
  }

  private emitInteraction(action: string, player: Player) {
    const id = this.metadata ? this.metadata.id : (this.props.objectId || this.entity.name.get());
    const label = this.metadata ? this.metadata.displayName : id;
    const importance = this.metadata ? this.metadata.importance : 0.5;

    const token = makeObjectInteraction(
      id,
      label,
      action,
      player.name.get(),
      importance,
      this.entity.position.get()
    );

    this.sendNetworkBroadcastEvent(NarrativeTokenEvent, token);

    if (this.props.debugMode) {
      console.log(`[NarrativeEmitter] Emitted: ${player.name.get()} ${action} ${label}`);
    }
  }

  private checkStateChange() {
    if (!this.metadata || !this.metadata.trackRotation || !this.lastRotation) return;

    const currentRot = this.entity.rotation.get();
    
    // FIX: Calculate angle by rotating a Forward vector and comparing the difference
    // This avoids needing access to internal .x .y .z .w or .dot() on the Quaternion itself.
    
    // 1. Get where "Forward" was pointing before
    const oldFwd = Quaternion.mulVec3(this.lastRotation, Vec3.forward);
    // 2. Get where "Forward" is pointing now
    const newFwd = Quaternion.mulVec3(currentRot, Vec3.forward);
    
    // 3. Dot product of two normalized vectors gives cos(angle)
    const dot = oldFwd.dot(newFwd);
    
    // 4. Calculate degrees (clamp dot to -1..1 to prevent math errors)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

    if (angle > 45) {
      this.lastRotation = currentRot;
      
      const token = makeObjectState(
        this.metadata.id,
        this.metadata.displayName,
        "rotated",
        this.metadata.importance * 0.8
      );
      
      this.sendNetworkBroadcastEvent(NarrativeTokenEvent, token);
      
      if (this.props.debugMode) console.log(`[NarrativeEmitter] Emitted state change: rotated (${Math.floor(angle)} deg)`);
    }
  }

  onDestroy() {
    if (this.checkInterval) this.async.clearInterval(this.checkInterval);
  }
}

Component.register(NarrativeEmitter);