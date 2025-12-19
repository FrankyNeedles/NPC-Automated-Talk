// StudioTechManager.ts
/**
 * StudioTechManager.ts
 * Manages the Physical Studio environment.
 * 
 * RESPONSIBILITIES:
 * 1. Controls "On Air" Lights.
 * 2. Controls "Director Office" access (Enables/Disables trigger).
 * 3. Ensures the Director only "listens" during breaks.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';

const DirectorCueEvent = new NetworkEvent<{ segment: string }>('DirectorCueEvent');

export class StudioTechManager extends Component<typeof StudioTechManager> {
  static propsDefinition = {
    onAirLight: { type: PropTypes.Entity, label: "On Air Light" },
    directorTrigger: { type: PropTypes.Entity, label: "Director Trigger" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  start() {
    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleCue.bind(this));
    
    // Default: Show is Live (Trigger Off)
    this.setStudioState(true);
  }

  private handleCue(data: { segment: string }) {
    // "COMMERCIAL" = Off Air = Director Available
    if (data.segment === "COMMERCIAL") {
        this.setStudioState(false);
    } else {
        this.setStudioState(true);
    }
  }

  private setStudioState(isLive: boolean) {
    if (this.props.debugMode) console.log(`[Tech] Studio Live: ${isLive}`);

    // 1. Light Control
    if (this.props.onAirLight) {
        const light = this.props.onAirLight as Entity;
        if (light.visible) light.visible.set(isLive);
    }

    // 2. Director Trigger Control
    // If Live, disable trigger (Director ignores players).
    // If Off Air, enable trigger (Director accepts pitches).
    if (this.props.directorTrigger) {
        const trigger = this.props.directorTrigger as Entity;
        // Note: Horizon doesn't always allow disabling script triggers directly via API
        // So we toggle visibility/collision or use a logic gate.
        // For visual clarity, we toggle the object itself if possible.
        if (trigger.visible) trigger.visible.set(!isLive); 
    }
  }
}

Component.register(StudioTechManager);