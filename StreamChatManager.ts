// StreamChatManager.ts
/**
 * StreamChatManager.ts
 * The Studio Monitor / Teleprompter.
 * 
 * UPGRADE:
 * - Displays User Chat.
 * - Displays "DIRECTOR ALERTS" (e.g. "Pitch Accepted").
 */

import { Component, PropTypes, NetworkEvent, TextGizmo, Entity } from 'horizon/core';

const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const DirectorPitchResultEvent = new NetworkEvent<{ user: string; result: string }>('DirectorPitchResultEvent');

class StreamChatManager extends Component<typeof StreamChatManager> {
  static propsDefinition = {
    displayGizmo: { type: PropTypes.Entity, label: "Text Gizmo" },
    maxLines: { type: PropTypes.Number, default: 8 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private chatLines: string[] = [];

  start() {
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.onChatMessage.bind(this));
    this.connectNetworkBroadcastEvent(DirectorPitchResultEvent, this.onDirectorMessage.bind(this));
  }

  private onChatMessage(payload: { user: string; text: string }) {
    this.addLine(`${payload.user}: ${payload.text}`);
  }

  private onDirectorMessage(payload: { user: string; result: string }) {
    // Highlight Director messages
    this.addLine(`[DIRECTOR]: ${payload.result} (@${payload.user})`);
  }

  private addLine(line: string) {
    this.chatLines.push(line);
    if (this.chatLines.length > this.props.maxLines) {
        this.chatLines.shift();
    }
    this.updateDisplay();
  }

  private updateDisplay() {
    if (this.props.displayGizmo) {
        const ent = this.props.displayGizmo as Entity;
        // Cast to any to avoid strict type issues with .as()
        const gizmo = ent.as(TextGizmo as any) as any;
        if (gizmo) {
            gizmo.text.set(this.chatLines.join('\n'));
        }
    }
  }
}

Component.register(StreamChatManager);