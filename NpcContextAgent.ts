import { Component, PropTypes, Player, CodeBlockEvents, Entity } from 'horizon/core';
import { SmartNpcMemory } from './SmartNpcMemory';

export class NpcContextAgent extends Component<typeof NpcContextAgent> {
    static propsDefinition = {
        smartNpcMemory: {
            type: PropTypes.Entity,
            label: "Smart NPC Memory",
            description: "Entity with SmartNpcMemory attached"
        },
        trigger: {
            type: PropTypes.Entity,
            label: "Trigger Zone",
            description: "The trigger entity (Gizmo)"
        },
        reactionDelay: {
            type: PropTypes.Number,
            default: 0.6,
            label: "Reaction Delay (s)"
        },
        enableDebug: {
            type: PropTypes.Boolean,
            default: true,
            label: "Debug Logs"
        }
    };

    private memoryScript: SmartNpcMemory | undefined;
    private playerTimers: Map<number, number> = new Map();
    private npcSelfId: string | undefined;

    override start() {
        if (!this.props.smartNpcMemory || !this.props.trigger) {
            console.error('[NpcContextAgent] SmartNpcMemory and Trigger slots are required.');
            return;
        }

        // 1. Find Memory Script Safely
        const memEntity = this.props.smartNpcMemory as Entity;
        // Use a safe check for getComponents availability
        if (memEntity.getComponents) {
            const comps = memEntity.getComponents();
            for (const c of comps) {
                if (c instanceof SmartNpcMemory) {
                    this.memoryScript = c;
                    break;
                }
            }
        }

        if (!this.memoryScript) {
            console.error('[NpcContextAgent] SmartNpcMemory component not found on target entity.');
            return;
        }

        // 2. Fetch NPC ID (Safety Loop)
        // Check periodically to ensure we don't trigger on ourselves
        this.async.setInterval(() => {
            if (!this.npcSelfId && this.memoryScript) {
                try {
                    const id = this.memoryScript.getNpcId();
                    if (id) this.npcSelfId = id;
                } catch(e) {}
            }
        }, 2000);

        // 3. Bind Trigger Events
        this.connectCodeBlockEvent(
            this.props.trigger,
            CodeBlockEvents.OnPlayerEnterTrigger,
            this.onPlayerEnter.bind(this)
        );
        this.connectCodeBlockEvent(
            this.props.trigger,
            CodeBlockEvents.OnPlayerExitTrigger,
            this.onPlayerExit.bind(this)
        );

        this.log("Context Agent Active.");
    }

    private onPlayerEnter(player: Player): void {
        if (!this.memoryScript) return;

        // --- SAFETY CHECK ---
        // If the object entering is the NPC itself, ignore it.
        try {
            if (this.npcSelfId && player.id.toString() === this.npcSelfId) return;
        } catch { return; }

        const pid = player.id;
        const pname = player.name.get();

        // 1. Reset Timer (The "Good" Logic)
        // Cancel any pending actions for this player so we can start fresh
        this.clearPlayerTimer(pid);

        // 2. Log Context (Advanced Feature)
        let contextNote = "";
        try {
            if (this.memoryScript) {
                const vState = this.memoryScript.getVortexState();
                contextNote = `(Vortex: ${vState})`;
            }
        } catch(e) {}

        this.log(`${pname} entered ${contextNote}. Reacting in ${this.props.reactionDelay}s...`);

        // 3. Set Reaction Timer
        const tId = this.async.setTimeout(() => {
            if (this.memoryScript) {
                this.memoryScript.enableHearingForPlayer(player);
            }
            this.playerTimers.delete(pid);
        }, (this.props.reactionDelay || 0.6) * 1000);

        this.playerTimers.set(pid, tId);
    }

    private onPlayerExit(player: Player): void {
        if (!this.memoryScript) return;

        // Safety Check
        try {
            if (this.npcSelfId && player.id.toString() === this.npcSelfId) return;
        } catch { return; }

        const pid = player.id;

        // 1. Clear the reaction timer
        // If they leave before the delay finishes, the NPC ignores them (Conversational filtering)
        this.clearPlayerTimer(pid);

        // 2. Notify Memory immediately
        this.memoryScript.disableHearingForPlayer(player);
        this.log(`${player.name.get()} exited.`);
    }

    private clearPlayerTimer(playerId: number): void {
        const t = this.playerTimers.get(playerId);
        if (t !== undefined) {
            this.async.clearTimeout(t);
            this.playerTimers.delete(playerId);
        }
    }

    // --- EXTERNAL HOOKS (Advanced Logic) ---
    public notifyObservedEvent(description: string) {
        if (this.memoryScript) this.memoryScript.addEventPerception(description);
    }

    private log(msg: string) {
        if (this.props.enableDebug) console.log(`[NpcContextAgent] ${msg}`);
    }
}

Component.register(NpcContextAgent);