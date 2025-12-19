// ChatInputTerminal.ts
/**
 * ChatInputTerminal.ts
 * Diegetic Keyboard.
 * 
 * UPGRADE:
 * - Sends 'PitchSubmittedEvent' so the Director can score the idea.
 * - Still sends 'ChatMessageEvent' for the studio teleprompter.
 */

import { Component, PropTypes, CodeBlockEvents, Player, NetworkEvent } from 'horizon/core';

const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

class ChatInputTerminal extends Component<typeof ChatInputTerminal> {
  static propsDefinition = {
    label: { type: PropTypes.String, default: "Submit Show Idea" },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private isBusy: boolean = false;

  start() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, this.onGrabStart.bind(this));
  }

  private onGrabStart(isRightHand: boolean, player: Player) {
    const local = this.world.getLocalPlayer();
    if (!local || player.id !== local.id) return;
    if (this.isBusy) return;

    this.isBusy = true;

    (this.world.ui as any).showStringInput({
      label: this.props.label,
      placeholder: "Pitch a topic (e.g. 'Aliens in the basement')",
      maxLength: 140,
      onSubmit: (text: string) => {
        this.handleInputSubmit(player, text);
        this.isBusy = false;
      },
      onCancel: () => {
        this.isBusy = false;
      }
    });
  }

  private handleInputSubmit(player: Player, rawText: string) {
    const text = rawText.trim();
    if (!text) return;

    const user = player.name.get();
    const timestamp = Date.now();

    // 1. Send to Director (Pitch)
    this.sendNetworkBroadcastEvent(PitchSubmittedEvent, {
        pitchId: Math.floor(Math.random() * 10000).toString(),
        userId: user,
        text: text,
        timestamp: timestamp
    });

    // 2. Send to Screen (Chat)
    this.sendNetworkBroadcastEvent(ChatMessageEvent, {
        user: user,
        text: text,
        timestamp: timestamp
    });

    if (this.props.debugMode) console.log(`[Input] Sent pitch: ${text}`);
  }
}

Component.register(ChatInputTerminal);