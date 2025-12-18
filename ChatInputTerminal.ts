// ChatInputTerminal.ts
import { Component, PropTypes, CodeBlockEvents, Player, NetworkEvent } from 'horizon/core';

const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');
const PitchSubmittedEvent = new NetworkEvent<{ pitchId: string; userId: string; text: string; timestamp: number }>('PitchSubmittedEvent');

class ChatInputTerminal extends Component<typeof ChatInputTerminal> {
  static propsDefinition = {
    debugMode: { type: PropTypes.Boolean, default: false },
    label: { type: PropTypes.String, default: "Send Message / Pitch" }
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
      placeholder: 'Type a message or show idea...',
      maxLength: 140,
      onSubmit: (text: string) => {
        this.handleInputSubmit(player, text);
        this.isBusy = false;
      },
      onCancel: () => { this.isBusy = false; }
    });
  }

  private handleInputSubmit(player: Player, rawText: string) {
    const cleanText = rawText.replace(/[^\w\s!?.,'":;()-]/g, '').trim();
    if (!cleanText) return;

    let userName = 'Viewer';
    if (player.name && typeof player.name.get === 'function') userName = player.name.get();

    // Send as Chat (Q&A)
    this.sendNetworkBroadcastEvent(ChatMessageEvent, { user: userName, text: cleanText, timestamp: Date.now() });

    // Send as Pitch (Post-Show)
    this.sendNetworkBroadcastEvent(PitchSubmittedEvent, { pitchId: Date.now().toString(), userId: userName, text: cleanText, timestamp: Date.now() });
  }
}

Component.register(ChatInputTerminal);