import { Client, TextChannel, EmbedBuilder, Message, PermissionFlagsBits, ThreadChannel, ChannelType } from 'discord.js';
import { GameState } from './types';

export class GuessTheNumberManager {
    private activeGames: Map<string, GameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async startGame(channelId: string, min: number, max: number, options: { slowmode?: number, targetNumber?: number, useThread?: boolean } = {}): Promise<boolean> {
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const targetNumber = options.targetNumber !== undefined ? options.targetNumber : Math.floor(Math.random() * (max - min + 1)) + min;

        let gameChannelId = channelId;
        let threadId: string | undefined;

        const channel = await this.client.channels.fetch(channelId) as TextChannel;
        if (!channel) return false;

        if (options.useThread) {
            const thread = await channel.threads.create({
                name: 'Guess the Number',
                autoArchiveDuration: 60,
                reason: 'Guess the Number game'
            });
            gameChannelId = thread.id;
            threadId = thread.id;
        }

        const gameState: GameState = {
            channelId: gameChannelId,
            targetNumber,
            min,
            max,
            originalMin: min,
            originalMax: max,
            startTime: Date.now(),
            guesses: 0,
            players: new Set(),
            isActive: true,
            threadId
        };

        this.activeGames.set(gameChannelId, gameState);

        const targetChannel = options.useThread && threadId ? await this.client.channels.fetch(threadId) : channel;

        if (targetChannel) {
            // Unlock channel (or thread)
            if (targetChannel.isThread()) {
                await (targetChannel as ThreadChannel).setLocked(false);
            } else if (targetChannel.isTextBased() && !targetChannel.isDMBased()) {
                const textChannel = targetChannel as TextChannel;
                await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
                    SendMessages: true
                });
            }

            if (options.slowmode !== undefined && targetChannel.isTextBased()) {
                await (targetChannel as TextChannel | ThreadChannel).setRateLimitPerUser(options.slowmode);
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Game Started 🔢')
                .setDescription(`**How To Play:**\n- I have thought of a number between **${min}** and **${max}**.\n- First person to guess the number wins!\n- You have unlimited guesses.\n- Good Luck!`)
                .setTimestamp();

            if (targetChannel.isTextBased()) {
                const msg = await (targetChannel as any).send({ embeds: [embed] });
                await msg.pin().catch(() => { });
            }
        }

        return true;
    }

    public async stopGame(channelId: string): Promise<boolean> {
        if (!this.activeGames.has(channelId)) {
            return false;
        }

        this.activeGames.delete(channelId);
        return true;
    }

    public getGame(channelId: string): GameState | undefined {
        return this.activeGames.get(channelId);
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const guess = parseInt(message.content.trim());
        if (isNaN(guess)) return;

        if (guess < game.min || guess > game.max) return;

        game.guesses++;
        game.players.add(message.author.id);

        const diff = Math.abs(guess - game.targetNumber);
        if (!game.closestGuess || diff < game.closestGuess.diff) {
            game.closestGuess = {
                userId: message.author.id,
                username: message.author.username,
                guess: guess,
                diff: diff,
                timestamp: Date.now()
            };
        }

        if (guess === game.targetNumber) {
            game.isActive = false;
            game.winner = {
                userId: message.author.id,
                username: message.author.username,
                guess: guess
            };

            await message.react('✅');

            const channel = message.channel;

            // Lock channel or thread
            if (channel.isThread()) {
                await channel.setLocked(true);
            } else if (channel.isTextBased() && !channel.isDMBased()) {
                const textChannel = channel as TextChannel;
                await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
                    SendMessages: false
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Game Ended')
                .setDescription(`The number was **${game.targetNumber}** which was first guessed by ${message.author}.\n\n**Minimum:**\n${game.originalMin}\n**Maximum:**\n${game.originalMax}\n**Number:**\n${game.targetNumber}\n**Players:**\n${game.players.size}\n**Guesses:**\n${game.guesses}\n**Winner:**\n${message.author}`)
                .setTimestamp();

            await (channel as any).send({ embeds: [embed] });

            this.activeGames.delete(message.channelId);
        }
    }

    public getClosestGuess(channelId: string, targetNumber: number): number | null {
        // This would require tracking all guesses, which we aren't doing yet for memory efficiency.
        // For now, we can't implement this accurately without storing all guesses.
        // I will leave this as a placeholder or implement a simple version if needed.
        return null;
    }

    public async provideHint(channelId: string, percentage: number = 30): Promise<boolean> {
        const game = this.activeGames.get(channelId);
        if (!game || !game.isActive) return false;

        const currentRange = game.max - game.min;
        // Reduce BY percentage (e.g. 30% reduction means keeping 70%)
        const keepPercentage = 100 - percentage;
        const newRangeSize = Math.max(1, Math.floor(currentRange * (keepPercentage / 100)));

        // Center the new range around the target number, but keep it within bounds
        let newMin = Math.max(game.min, game.targetNumber - Math.floor(newRangeSize / 2));
        let newMax = Math.min(game.max, newMin + newRangeSize);

        // Adjust if the range is smaller than calculated (hit boundaries)
        if (newMax - newMin < newRangeSize) {
            if (newMin === game.min) {
                newMax = Math.min(game.max, newMin + newRangeSize);
            } else {
                newMin = Math.max(game.min, newMax - newRangeSize);
            }
        }

        game.min = newMin;
        game.max = newMax;

        const embed = new EmbedBuilder()
            .setTitle('🔍 Hint Provided')
            .setDescription(`The range has been narrowed down!\n\n**New Range:** ${game.min} - ${game.max}`)
            .setTimestamp();

        const channel = await this.client.channels.fetch(game.channelId);
        if (channel && (channel.isTextBased() || channel.isThread())) {
            await (channel as any).send({ embeds: [embed] });
        }

        return true;
    }
}
