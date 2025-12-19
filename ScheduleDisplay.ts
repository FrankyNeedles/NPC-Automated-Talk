// ScheduleDisplay.ts
/**
 * ScheduleDisplay.ts
 * The "Big Board" UI.
 * 
 * RESPONSIBILITIES:
 * 1. Listens for schedule updates from the Executive Producer.
 * 2. Formats the text into a TV-Guide style display.
 * 3. Shows players when their pitch is "Up Next".
 */

import { Component, PropTypes, NetworkEvent, TextGizmo, Entity } from 'horizon/core';

// INPUT: From Executive Producer
const ScheduleUpdateEvent = new NetworkEvent<{ 
  now: string; 
  next: string; 
  later: string; 
}>('ScheduleUpdateEvent');

export class ScheduleDisplay extends Component<typeof ScheduleDisplay> {
  static propsDefinition = {
    displayGizmo: { type: PropTypes.Entity, label: "TV Screen (Text)" },
    headerText: { type: PropTypes.String, default: "=== BROADCAST SCHEDULE ===" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  start() {
    this.connectNetworkBroadcastEvent(ScheduleUpdateEvent, this.updateScreen.bind(this));
    
    // Set initial "Offline" state
    this.renderText({
        now: "Starting Up...",
        next: "Loading...",
        later: "Loading..."
    });
  }

  private updateScreen(data: { now: string; next: string; later: string }) {
    if (this.props.debugMode) console.log(`[Display] Updating Schedule: NOW=${data.now}`);
    this.renderText(data);
  }

  private renderText(data: { now: string; next: string; later: string }) {
    if (!this.props.displayGizmo) return;

    const ent = this.props.displayGizmo as Entity;
    // Cast to any to access TextGizmo methods safely in this environment
    const textGizmo = ent.as(TextGizmo as any) as any;

    if (textGizmo) {
        const formatted = 
            `${this.props.headerText}\n\n` +
            `🔴 ON AIR:\n ${data.now}\n\n` +
            `⏱️ UP NEXT:\n ${data.next}\n\n` +
            `📅 LATER:\n ${data.later}`;

        textGizmo.text.set(formatted);
    }
  }
}

Component.register(ScheduleDisplay);