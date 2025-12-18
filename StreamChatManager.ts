// StreamChatManager.ts
import { Component, PropTypes, NetworkEvent, TextGizmo, Entity } from 'horizon/core';

const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

class StreamChatManager extends Component<typeof StreamChatManager> {
  static propsDefinition = {
    displayGizmo: { type: PropTypes.Entity, default: null },
    maxLines: { type: PropTypes.Number, default: 6 }
  };

  private chatLines: string[] = [];

  start() {
    this.connectNetworkBroadcastEvent(ChatMessageEvent, this.onChatMessage.bind(this));
  }

  private onChatMessage(payload: { user: string; text: string }) {
    this.chatLines.push(`${payload.user}: ${payload.text}`);
    if (this.chatLines.length > this.props.maxLines) this.chatLines.shift();

    if (this.props.displayGizmo) {
      const ent = this.props.displayGizmo as Entity;
      const gizmo = ent.as(TextGizmo);
      if (gizmo) gizmo.text.set(this.chatLines.join('\n'));
    }
  }
}

Component.register(StreamChatManager);