// StreamChatManager.ts
/**
 * StreamChatManager.ts
 * Manages the visible chat log (TextGizmo) and forwards valid messages to the Brain.
 */

import { Component, PropTypes, NetworkEvent, TextGizmo, Entity } from 'horizon/core';

// Event received from the ChatInputTerminal
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

// Event sent to the StreamerAutopilot (Brain)
const ChatToBrainEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatToBrainEvent');

class StreamChatManager extends Component<typeof StreamChatManager> {
  static propsDefinition = {
    displayGizmo: { type: PropTypes.Entity, default: null },   // The text screen
    sendToBrainEntity: { type: PropTypes.Entity, default: null }, // The object holding the StreamerAutopilot script
    maxLines: { type: PropTypes.Number, default: 6 },          // How many lines fit on screen
    spamCooldown: { type: PropTypes.Number, default: 2.0 },    // Seconds between messages per user
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private chatLines: string[] = [];
  private lastMessageTimes: Record<string, number> = {};

  start() {
    if (!this.props.displayGizmo) {
      console.error('[StreamChatManager] ERROR: No "displayGizmo" assigned. Chat will not appear.');
    }
    
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.handleIncomingMessage.bind(this));
  }

  private handleIncomingMessage(data: { user: string; text: string; timestamp: number }) {
    const { user, text } = data;
    const now = Date.now() / 1000;

    const lastTime = this.lastMessageTimes[user] || 0;
    if (now - lastTime < this.props.spamCooldown) {
      if (this.props.debugMode) console.log(`[StreamChatManager] Spam blocked from ${user}`);
      return;
    }
    this.lastMessageTimes[user] = now;

    this.updateDisplay(user, text);

    if (this.props.sendToBrainEntity) {
      this.sendNetworkBroadcastEvent(ChatToBrainEvent, {
        user,
        text,
        timestamp: Date.now()
      });
    }
  }

  private updateDisplay(user: string, text: string) {
    const line = `${user}: ${text}`;
    this.chatLines.push(line);

    if (this.chatLines.length > this.props.maxLines) {
      this.chatLines.shift();
    }

    if (this.props.displayGizmo) {
      // FIX: Explicitly cast to 'Entity' so TypeScript knows it has the .as() method
      const gizmoEntity = this.props.displayGizmo as Entity;
      
      // Use 'as any' on the result to avoid strict generic matching issues if they arise
      const textGizmo = gizmoEntity.as(TextGizmo);
      
      if (textGizmo) {
        textGizmo.text.set(this.chatLines.join('\n'));
      }
    }
  }
}

Component.register(StreamChatManager);