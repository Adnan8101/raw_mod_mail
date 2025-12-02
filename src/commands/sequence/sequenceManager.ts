import { Client, ChatInputCommandInteraction, EmbedBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { SequenceCanvas } from './sequenceCanvas';

interface SequenceGameState {
    channelId: string;
    sequenceDisplay: string;
    missingTerm: number;
    isActive: boolean;
    startTime: number;
    difficulty: string;
    type: string;
    displayTime: number;
    starterId: string;
    explanation: string;
}

export class SequenceGameManager {
    private activeGames: Map<string, SequenceGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    private generateSequence(difficulty: string, type: string): { display: string, missing: number, type: string, explanation: string } {
        let cap = 50;
        if (difficulty === 'Medium') cap = 100;
        if (difficulty === 'Hard') cap = 150;

        // If type is auto, pick a random one
        const types = ['arithmetic', 'geometric', 'fibonacci', 'squares', 'primes', 'alternating'];
        let selectedType = type;
        if (type === 'auto') {
            // Filter types based on difficulty if needed, but most work for all if we adjust params.
            // Alternating is harder, maybe only for Hard?
            // Primes are good for any.
            // Let's just pick random.
            selectedType = types[Math.floor(Math.random() * types.length)];
        }

        let sequence: number[] = [];
        let missing = 0;
        let explanation = '';

        // Generate 4-6 terms
        const length = Math.floor(Math.random() * 3) + 4;

        switch (selectedType) {
            case 'arithmetic': {
                let startMin = 1, startMax = 20, diffMin = 1, diffMax = 10;
                if (difficulty === 'Medium') { startMin = 20; startMax = 50; diffMin = 5; diffMax = 15; }
                if (difficulty === 'Hard') { startMin = 50; startMax = 100; diffMin = 10; diffMax = 30; }

                const start = Math.floor(Math.random() * (startMax - startMin + 1)) + startMin;
                const diff = Math.floor(Math.random() * (diffMax - diffMin + 1)) + diffMin;

                for (let i = 0; i < length + 1; i++) {
                    sequence.push(start + i * diff);
                }
                explanation = `Arithmetic sequence: Start at ${start}, add ${diff} each time.`;
                break;
            }
            case 'geometric': {
                let startMin = 1, startMax = 5, ratioMin = 2, ratioMax = 3;
                if (difficulty === 'Medium') { startMin = 2; startMax = 10; ratioMin = 2; ratioMax = 4; }
                if (difficulty === 'Hard') { startMin = 5; startMax = 15; ratioMin = 2; ratioMax = 5; }

                const start = Math.floor(Math.random() * (startMax - startMin + 1)) + startMin;
                const ratio = Math.floor(Math.random() * (ratioMax - ratioMin + 1)) + ratioMin;

                for (let i = 0; i < length + 1; i++) {
                    const val = start * Math.pow(ratio, i);
                    if (val > 10000) break; // Safety cap
                    sequence.push(val);
                }
                explanation = `Geometric sequence: Start at ${start}, multiply by ${ratio} each time.`;
                break;
            }
            case 'fibonacci': {
                let startMin = 1, startMax = 5;
                if (difficulty === 'Medium') { startMin = 5; startMax = 15; }
                if (difficulty === 'Hard') { startMin = 10; startMax = 30; }

                const a = Math.floor(Math.random() * (startMax - startMin + 1)) + startMin;
                const b = Math.floor(Math.random() * (startMax - startMin + 1)) + a;
                sequence.push(a, b);
                for (let i = 2; i < length + 1; i++) {
                    const val = sequence[i - 1] + sequence[i - 2];
                    if (val > 10000) break;
                    sequence.push(val);
                }
                explanation = `Fibonacci-like sequence: Start with ${a}, ${b}. Each number is the sum of the two preceding ones.`;
                break;
            }
            case 'squares': {
                let startMin = 1, startMax = 5;
                if (difficulty === 'Medium') { startMin = 5; startMax = 10; }
                if (difficulty === 'Hard') { startMin = 21; startMax = 31; }

                const start = Math.floor(Math.random() * (startMax - startMin + 1)) + startMin;
                for (let i = 0; i < length + 1; i++) {
                    const n = start + i;
                    const val = n * n;
                    sequence.push(val);
                }
                explanation = `Squares sequence: Squares of numbers starting from ${start} (${start}², ${start + 1}², ...).`;
                break;
            }
            case 'primes': {
                const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199];

                let minIdx = 0;
                if (difficulty === 'Medium') minIdx = 5;
                if (difficulty === 'Hard') minIdx = 15;

                const maxIdx = primes.length - length - 1;
                const startIdx = Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx;

                for (let i = 0; i < length + 1; i++) {
                    if (startIdx + i < primes.length) {
                        sequence.push(primes[startIdx + i]);
                    }
                }
                explanation = `Prime numbers sequence.`;
                break;
            }
            case 'alternating': {
                let startMin = 5, startMax = 15;
                if (difficulty === 'Medium') { startMin = 15; startMax = 30; }
                if (difficulty === 'Hard') { startMin = 30; startMax = 50; }

                const start = Math.floor(Math.random() * (startMax - startMin + 1)) + startMin;
                sequence.push(start);

                const op1 = Math.random() > 0.5 ? '+' : (difficulty === 'Easy' ? '-' : '*');
                const val1 = Math.floor(Math.random() * 3) + 2;
                const op2 = Math.random() > 0.5 ? '-' : '+';
                const val2 = Math.floor(Math.random() * 3) + 1;

                for (let i = 1; i < length + 1; i++) {
                    let prev = sequence[i - 1];
                    let next = prev;
                    if (i % 2 !== 0) { // Odd step: op1
                        if (op1 === '+') next += val1;
                        else if (op1 === '-') next -= val1;
                        else next *= val1;
                    } else { // Even step: op2
                        if (op2 === '+') next += val2;
                        else next -= val2;
                    }
                    if (next > 10000) break;
                    sequence.push(next);
                }
                explanation = `Alternating sequence: ${op1}${val1}, then ${op2}${val2}.`;
                break;
            }
            default: {
                // Fallback to arithmetic
                const start = 1;
                const diff = 2;
                for (let i = 0; i < length + 1; i++) {
                    sequence.push(start + i * diff);
                }
                explanation = `Arithmetic sequence: Start at ${start}, add ${diff} each time.`;
            }
        }

        // Ensure we have enough terms
        if (sequence.length < 4) {
            // Retry with arithmetic if generation failed to produce enough terms
            return this.generateSequence(difficulty, 'arithmetic');
        }

        missing = sequence.pop()!;
        const display = sequence.join(', ') + ', ?';

        return { display, missing, type: selectedType, explanation };
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number, type: string): Promise<boolean> {
        const channelId = interaction.channelId;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const { display, missing, type: actualType, explanation } = this.generateSequence(difficulty, type);

        const attachment = await SequenceCanvas.generateImage(display);

        const embed = new EmbedBuilder()
            .setTitle('Complete the Sequence')
            .setDescription(`**Complete the sequence. You have ${time > 0 ? time + 's' : 'unlimited time'} to view.**\n\n**Type the missing term (number only). First correct answer wins.**`)
            .setImage('attachment://sequence_challenge.png')
            .setColor('#0099ff');

        await interaction.reply({
            embeds: [embed],
            files: [attachment]
        });
        try {
            await interaction.user.send(`Your answer: || ${missing} ||`);
        } catch (e) {
            await interaction.followUp({ content: 'Couldn’t DM answer — enable DMs.', flags: MessageFlags.Ephemeral });
        }

        const gameState: SequenceGameState = {
            channelId,
            sequenceDisplay: display,
            missingTerm: missing,
            isActive: true,
            startTime: Date.now(),
            difficulty,
            type: actualType,
            displayTime: time,
            starterId: interaction.user.id,
            explanation
        };

        this.activeGames.set(channelId, gameState);

        if (time > 0) {
            setTimeout(async () => {
                try {
                    if (!this.activeGames.has(channelId)) return;

                    await interaction.deleteReply();
                } catch (error) {
                    console.error('Error in Sequence Game timeout:', error)
                }
            }, time * 1000);
        }

        return true;
    }

    public async stopGame(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const channelId = interaction.channelId;
        const game = this.activeGames.get(channelId);

        if (!game) {
            return false;
        }

        if (!interaction.memberPermissions?.has('ManageGuild') && interaction.user.id !== game.starterId) {
            return false;
        }

        const answer = game.missingTerm;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setTitle('Game Ended')
            .setDescription(`Game ended. Correct answer: ${answer}`)
            .setColor('#ff0000');

        const channel = interaction.channel;
        if (channel) {
            if (channel.isTextBased() && !(channel as any).isDMBased()) {
                await (channel as TextChannel).send({ embeds: [embed] });
            }
        }

        return true;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const content = message.content.trim();
        if (!/^-?\d+$/.test(content)) {
            return;
        }

        const guess = parseInt(content);

        if (guess === game.missingTerm) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            await message.react('✅');

            const timeTaken = ((Date.now() - game.startTime) / 1000);

            const embed = new EmbedBuilder()
                .setTitle('Sequence Complete — Winner!')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Correct Term', value: game.missingTerm.toString(), inline: true },
                    { name: 'Time taken', value: `${timeTaken.toFixed(2)}s`, inline: false },
                    { name: 'Explanation', value: game.explanation, inline: false }
                )
                .setFooter({ text: 'Quick Sequence Challenge' })
                .setColor('#00ff00');

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: SequenceGameManager;

export const getSequenceGameManager = (client: Client) => {
    if (!instance) {
        instance = new SequenceGameManager(client);
    }
    return instance;
};
