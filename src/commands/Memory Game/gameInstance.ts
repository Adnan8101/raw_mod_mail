import { Client, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';

interface MemoryGameState {
    channelId: string;
    sequence: string;
    isActive: boolean;
    startTime: number;
    emojiCount: number;
    displayTime: number;
}

export class MemoryGameManager {
    private activeGames: Map<string, MemoryGameState> = new Map();
    private client: Client;
    private emojis = ['🐱', '⭐', '🎯', '🍕', '👽', '🚀', '🌈', '🎈', '🎨', '🎩', '🐶', '🍎', '⚽', '🎸', '🚗'];

    constructor(client: Client) {
        this.client = client;
    }

    private getTwemojiUrl(emoji: string): string {
        const codePoint = emoji.codePointAt(0)?.toString(16);
        return `https://twemoji.maxcdn.com/v/latest/72x72/${codePoint}.png`;
    }

    public async startGame(interaction: ChatInputCommandInteraction, emojiCount: number, time: number): Promise<boolean> {
        const channelId = interaction.channelId;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        // Generate sequence
        const sequence: string[] = [];
        for (let i = 0; i < emojiCount; i++) {
            sequence.push(this.emojis[Math.floor(Math.random() * this.emojis.length)]);
        }
        const sequenceString = sequence.join('');

        // Create Canvas
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2b2d31'; // Discord dark theme background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Emojis using Twemoji images
        const spacing = 100;
        const totalWidth = emojiCount * spacing;
        const startX = (canvas.width - totalWidth) / 2 + (spacing / 2); // Center it

        const loadPromises = sequence.map(async (emoji, index) => {
            try {
                const url = this.getTwemojiUrl(emoji);
                const image = await loadImage(url);
                const x = startX + (index * spacing) - (image.width / 2);
                const y = (canvas.height / 2) - (image.height / 2);
                ctx.drawImage(image, x, y);
            } catch (error) {
                console.error(`Failed to load emoji ${emoji}:`, error);
            }
        });

        await Promise.all(loadPromises);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'memory_sequence.png' });

        const embed = new EmbedBuilder()
            .setDescription(`**Memorize these emojis! You have ${time} seconds.**`)
            .setImage('attachment://memory_sequence.png');
        // No color set for "colorless" look (defaults to role color or dark grey)

        await interaction.reply({
            embeds: [embed],
            files: [attachment]
        });

        const gameState: MemoryGameState = {
            channelId,
            sequence: sequenceString,
            isActive: true, // Active immediately
            startTime: Date.now(),
            emojiCount,
            displayTime: time
        };

        this.activeGames.set(channelId, gameState);

        // Set timeout to delete image and start listening
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
                const channel = interaction.channel as TextChannel;
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setDescription('**Type the emojis in the exact order. No spaces, no extra characters.**');

                    if (channel.isTextBased() && !(channel as any).isDMBased()) {
                        await (channel as TextChannel).send({ embeds: [embed] });
                    } else if ((channel as any).isDMBased()) {
                        await (channel as any).send({ embeds: [embed] });
                    }

                    // Activate game for listening
                    const game = this.activeGames.get(channelId);
                    if (game) {
                        game.isActive = true;
                        // Game now runs indefinitely until winner or manual stop
                    }
                }
            } catch (error) {
                console.error('Error in Memory Game timeout:', error);
                this.activeGames.delete(channelId);
            }
        }, time * 1000);

        return true;
    }

    public async stopGame(interaction: ChatInputCommandInteraction): Promise<boolean> {
        const channelId = interaction.channelId;
        const game = this.activeGames.get(channelId);

        if (!game) {
            return false;
        }

        const sequenceString = game.sequence;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setDescription(`Game ended manually. No correct answer was given.\nThe correct sequence was: ${sequenceString}`);

        const channel = interaction.channel;
        if (channel) {
            if (channel.isTextBased() && !(channel as any).isDMBased()) {
                await (channel as TextChannel).send({ embeds: [embed] });
            } else if ((channel as any).isDMBased()) {
                await (channel as any).send({ embeds: [embed] });
            }
        }

        return true;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const content = message.content.trim();

        // Normalize strings for comparison (remove variation selectors and whitespace)
        const normalize = (str: string) => str.replace(/[\uFE0F\s]/g, '');

        const normalizedContent = normalize(content);
        const normalizedSequence = normalize(game.sequence);

        console.log(`[Memory Game] Expected: ${normalizedSequence} (${game.sequence}), Received: ${normalizedContent} (${content})`);

        // Exact match check
        if (normalizedContent === normalizedSequence) {
            // WINNER
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            await message.react('✅');

            const timeTaken = ((Date.now() - game.startTime) / 1000) - game.displayTime; // Approximate time taken to type

            const embed = new EmbedBuilder()
                .setTitle('Winner')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Correct Sequence', value: game.sequence, inline: true },
                    { name: 'Time Taken', value: `${timeTaken.toFixed(2)} seconds`, inline: false }
                )
            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: MemoryGameManager;

export const getMemoryGameManager = (client: Client) => {
    if (!instance) {
        instance = new MemoryGameManager(client);
    }
    return instance;
};
