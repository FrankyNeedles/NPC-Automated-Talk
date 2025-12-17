// NarrativeEmitter.ts
/**
 * NarrativeEmitter.ts
 * Component attached to interactive objects.
 * Detects interactions (Grab, Drop, Rotation) and broadcasts Narrative Tokens.
 */

import { Component, PropTypes, CodeBlockEvents, Player, NetworkEvent, Quaternion, Vec3 } from 'horizon/core';
import { makeObjectInteraction, makeObjectState, NarrativeToken } from './NarrativeToken';
import { getMetadata, ObjectMetadata } from './ObjectMetadata';

// Use <any> to bypass strict SerializableState checks
const NarrativeTokenEvent = new NetworkEvent<any>('NarrativeTokenEvent');

class NarrativeEmitter extends Component<typeof NarrativeEmitter> {
  static propsDefinition = {
    objectId: { type: PropTypes.String, default: "" }, // Leave blank to use Entity Name
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private metadata: ObjectMetadata | undefined;
  private lastRotation: Quaternion | null = null;
  private checkInterval: any = null;

  start() {
    // 1. Resolve ID and Load Metadata
    const idToUse = this.props.objectId || this.entity.name.get();
    this.metadata = getMetadata(idToUse);

    if (!this.metadata && this.props.debugMode) {
      console.warn(`[NarrativeEmitter] No metadata found for ID: "${idToUse}". Using defaults.`);
    }

    // 2. Bind Interaction Events
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, this.onGrabStart.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabEnd, this.onGrabEnd.bind(this));

    // 3. Start State Monitoring (Rotation/Scale) if enabled in metadata
    if (this.metadata && (this.metadata.trackRotation || this.metadata.trackScale)) {
      this.lastRotation = this.entity.rotation.get();
      this.checkInterval = this.async.setInterval(this.checkStateChange.bind(this), 1000); // Check every 1s
    }
  }

  /**
   * Player Grabs Object
   */
  private onGrabStart(isRightHand: boolean, player: Player) {
    this.emitInteraction("picked_up", player);
  }

  /**
   * Player Drops Object
   */
  private onGrabEnd(player: Player) {
    this.emitInteraction("put_down", player);
  }

  /**
   * Periodic check for physical changes (Rotation)
   */
  private checkStateChange() {
    if (!this.metadata || !this.metadata.trackRotation || !this.lastRotation) return;

    const currentRot = this.entity.rotation.get();

    // Calculate angle difference using Forward vector comparison
    // (Workaround for missing Quaternion.angle API)
    const oldFwd = Quaternion.mulVec3(this.lastRotation, Vec3.forward);
    const newFwd = Quaternion.mulVec3(currentRot, Vec3.forward);
    
    const dot = oldFwd.dot(newFwd);
    // Clamp to -1..1 to prevent NaN
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

    // Threshold: 45 degrees change
    if (angle > 45) {
      this.lastRotation = currentRot;
      
      const token = makeObjectState(
        this.metadata.id,
        this.metadata.displayName,
        "rotated",
        this.metadata.importance ? this.metadata.importance * 0.8 : 0.4
      );
      
      this.sendNetworkBroadcastEvent(NarrativeTokenEvent, token);
      
      if (this.props.debugMode) {
        console.log(`[NarrativeEmitter] State Change: ${this.metadata.displayName} rotated (~${Math.floor(angle)}°)`);
      }
    }
  }

  /**
   * Helper to build and broadcast the token
   */
  private emitInteraction(action: string, player: Player) {
    // Fallbacks if metadata is missing
    const id = this.metadata ? this.metadata.id : (this.props.objectId || this.entity.name.get());
    const label = this.metadata ? this.metadata.displayName : id;
    const importance = this.metadata ? this.metadata.importance : 0.5;

    const token = makeObjectInteraction(
      id,
      label,
      action,
      player.name.get(),
      importance,
      this.entity.position.get(),
      this.entity.rotation.get()
    );

    this.sendNetworkBroadcastEvent(NarrativeTokenEvent, token);

    if (this.props.debugMode) {
      console.log(`[NarrativeEmitter] Emitted: ${player.name.get()} ${action} ${label}`);
    }
  }

  onDestroy() {
    if (this.checkInterval) this.async.clearInterval(this.checkInterval);
  }
}

Component.register(NarrativeEmitter);