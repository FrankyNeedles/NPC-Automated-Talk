// StudioTechManager.ts
/**
 * StudioTechManager.ts
 * Manages the physical studio environment (Lights, SFX).
 * 
 * Logic:
 * - When Director cues 'COMMERCIAL', turn OFF 'On Air' light.
 * - When Director cues anything else, turn ON 'On Air' light.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';

const DirectorCueEvent = new NetworkEvent<{ segment: string }>('DirectorCueEvent');

export class StudioTechManager extends Component<typeof StudioTechManager> {
  static propsDefinition = {
    onAirLight: { type: PropTypes.Entity, label: "On Air Light" },
    pitchLight: { type: PropTypes.Entity, label: "Pitch/Office Light" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  start() {
    this.connectNetworkBroadcastEvent(DirectorCueEvent, this.handleCue.bind(this));
  }

  private handleCue(data: { segment: string }) {
    if (!this.props.onAirLight || !this.props.pitchLight) return;

    const onAir = this.props.onAirLight as Entity;
    const pitch = this.props.pitchLight as Entity;

    // "COMMERCIAL" means the show is paused -> Pitch Window is OPEN
    if (data.segment === "COMMERCIAL") {
        if (this.props.debugMode) console.log("[Tech] State: BREAK (Pitching Open)");
        
        // Turn OFF On-Air, Turn ON Pitch Light
        // (Assuming visible property controls the light, or use material colors)
        this.setVis(onAir, false);
        this.setVis(pitch, true);
    } else {
        if (this.props.debugMode) console.log("[Tech] State: LIVE");
        
        // Turn ON On-Air, Turn OFF Pitch Light
        this.setVis(onAir, true);
        this.setVis(pitch, false);
    }
  }

  private setVis(ent: Entity, visible: boolean) {
      // Horizon API varies for visibility/lights. 
      // If it's a light object, we might enable/disable the component.
      // For now, we assume standard visibility toggling or color swapping.
      if (ent && ent.visible) {
          ent.visible.set(visible);
      }
  }
}

Component.register(StudioTechManager);