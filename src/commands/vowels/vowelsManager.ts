import { Client, ChatInputCommandInteraction, EmbedBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { VowelsCanvas } from './vowelsCanvas';

interface VowelsGameState {
    channelId: string;
    text: string;
    vowelCount: number;
    isActive: boolean;
    startTime: number;
    difficulty: string;
    category: string;
    displayTime: number;
    starterId: string;
    breakdown: string;
}

export class VowelsGameManager {
    private activeGames: Map<string, VowelsGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    private countVowels(text: string): { count: number, breakdown: string } {
        const matches = text.match(/[aeiou]/gi);
        if (!matches) return { count: 0, breakdown: 'None' };

        const counts: { [key: string]: number } = { 'A': 0, 'E': 0, 'I': 0, 'O': 0, 'U': 0 };
        for (const char of matches) {
            counts[char.toUpperCase()]++;
        }

        const breakdown = Object.entries(counts)
            .filter(([_, val]) => val > 0)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');

        return { count: matches.length, breakdown };
    }

    private generateText(difficulty: string, category: string): string {
        const vowels = 'aeiouAEIOU';
        const consonants = 'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ';
        const allChars = vowels + consonants;
        const words = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry', 'strawberry', 'tangerine', 'ugli', 'vanilla', 'watermelon', 'xigua', 'yam', 'zucchini', 'river', 'mountain', 'ocean', 'forest', 'desert', 'cloud', 'rain', 'storm', 'snow', 'wind', 'fire', 'earth', 'water', 'air', 'spirit', 'light', 'dark', 'shadow', 'sun', 'moon', 'star', 'planet', 'galaxy', 'universe', 'cosmos', 'space', 'time', 'dimension', 'reality', 'dream', 'nightmare', 'fantasy', 'magic', 'sorcery', 'wizardry', 'witchcraft', 'alchemy', 'science', 'physics', 'chemistry', 'biology', 'math', 'geometry', 'algebra', 'calculus', 'history', 'geography', 'literature', 'art', 'music', 'dance', 'theater', 'cinema', 'movie', 'film', 'video', 'game', 'play', 'sport', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'cricket', 'rugby', 'hockey', 'volleyball', 'badminton', 'swimming', 'running', 'cycling', 'walking', 'jumping', 'climbing', 'flying', 'driving', 'riding', 'sailing', 'rowing', 'skiing', 'skating', 'surfing', 'diving', 'fishing', 'hunting', 'camping', 'hiking', 'traveling', 'exploring', 'discovering', 'learning', 'teaching', 'reading', 'writing', 'listening', 'speaking', 'thinking', 'feeling', 'sensing', 'perceiving', 'understanding', 'knowing', 'believing', 'hoping', 'loving', 'hating', 'fearing', 'dreading', 'worrying', 'regretting', 'forgiving', 'forgetting', 'remembering', 'imagining', 'creating', 'destroying', 'building', 'breaking', 'fixing', 'mending', 'healing', 'hurting', 'helping', 'harming', 'saving', 'killing', 'living', 'dying', 'being', 'becoming', 'existing', 'surviving', 'thriving', 'flourishing', 'prospering', 'succeeding', 'failing', 'winning', 'losing', 'giving', 'taking', 'sharing', 'stealing', 'borrowing', 'lending', 'buying', 'selling', 'trading', 'exchanging', 'paying', 'owing', 'earning', 'spending', 'saving', 'investing', 'wasting', 'losing', 'finding', 'seeking', 'searching', 'looking', 'watching', 'seeing', 'hearing', 'smelling', 'tasting', 'touching', 'feeling'];

        let length = 0;
        let useWords = false;
        let useMixed = false;

        if (difficulty === 'Easy') {
            length = Math.floor(Math.random() * 7) + 9; // 9-15
        } else if (difficulty === 'Medium') {
            length = Math.floor(Math.random() * 6) + 15; // 15-20
        } else { // Hard
            length = Math.floor(Math.random() * 6) + 20; // 20-25
        }

        if (category === 'words') useWords = true;
        else if (category === 'mixed') useMixed = true;

        let result = '';

        if (useWords) {
            while (result.length < length) {
                const word = words[Math.floor(Math.random() * words.length)];
                if (result.length + word.length <= length) {
                    result += word;
                } else {
                    // Fill remaining with random chars if no word fits (unlikely with short words, but safety)
                    break;
                }
            }
            // If we broke early or need filler
            while (result.length < length) {
                result += allChars[Math.floor(Math.random() * allChars.length)];
            }
        } else {
            // Letters or Mixed
            for (let i = 0; i < length; i++) {
                if (useMixed && Math.random() < 0.1) {
                    // Occasional punctuation
                    const punct = '.,!?;:';
                    result += punct[Math.floor(Math.random() * punct.length)];
                } else {
                    if (difficulty === 'Easy') {
                        // Easy: letters only, limited vowels? User said "Vowel set limited to a, e, i, o, u" which is standard.
                        // "Lowercase & uppercase mix"
                        result += allChars[Math.floor(Math.random() * allChars.length)];
                    } else if (difficulty === 'Hard') {
                        // Hard: visually similar letters like l/1
                        if (Math.random() < 0.2) {
                            const tricky = ['l', '1', 'I', '0', 'O'];
                            result += tricky[Math.floor(Math.random() * tricky.length)];
                        } else {
                            result += allChars[Math.floor(Math.random() * allChars.length)];
                        }
                    } else {
                        result += allChars[Math.floor(Math.random() * allChars.length)];
                    }
                }
            }
        }

        // Truncate to exact length if needed
        return result.substring(0, length);
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number, category: string): Promise<boolean> {
        const channelId = interaction.channelId;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const text = this.generateText(difficulty, category);
        const { count: vowelCount, breakdown } = this.countVowels(text);

        // Generate Image
        const attachment = await VowelsCanvas.generateImage(text);

        const embed = new EmbedBuilder()
            .setTitle('Count the Vowels')
            .setDescription(`**Count all the vowels (A, E, I, O, U) in the text below. You have ${time > 0 ? time + 's' : 'unlimited time'} to view.**\n\n**Type only the number of vowels. First correct answer wins.**`)
            .setImage('attachment://vowels_challenge.png')
            .setColor('#0099ff');

        await interaction.reply({
            embeds: [embed],
            files: [attachment]
        });

        // DM the starter
        try {
            await interaction.user.send(`Your answer: || ${vowelCount} ||`);
        } catch (e) {
            await interaction.followUp({ content: 'Couldn’t DM answer — enable DMs.', flags: MessageFlags.Ephemeral });
        }

        const gameState: VowelsGameState = {
            channelId,
            text,
            vowelCount,
            isActive: true,
            startTime: Date.now(),
            difficulty,
            category,
            displayTime: time,
            starterId: interaction.user.id,
            breakdown
        };

        this.activeGames.set(channelId, gameState);

        if (time > 0) {
            setTimeout(async () => {
                try {
                    // Check if game is still active
                    if (!this.activeGames.has(channelId)) return;

                    await interaction.deleteReply();
                } catch (error) {
                    console.error('Error in Vowels Game timeout:', error);
                    // Don't delete game here, just failed to delete message
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

        // Check permissions: Admin or Starter
        if (!interaction.memberPermissions?.has('ManageGuild') && interaction.user.id !== game.starterId) {
            return false;
        }

        const answer = game.vowelCount;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setTitle('Game Ended')
            .setDescription(`Game ended. Correct answer: ${answer}`)
            .setColor('#ff0000');

        const channel = interaction.channel;
        if (channel) {
            // Send to channel
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

        // "Allowed answer: only digits (e.g., 7) — no trailing spaces or text."
        // "007 is considered wrong unless you want to accept leading zeros (recommend: reject)."
        if (!/^[1-9]\d*|0$/.test(content)) {
            // If it's not a strict number (no leading zeros unless it's just 0), ignore
            return;
        }

        const guess = parseInt(content);

        if (guess === game.vowelCount) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            await message.react('✅');

            const timeTaken = ((Date.now() - game.startTime) / 1000);

            const embed = new EmbedBuilder()
                .setTitle('Vowel Count — Winner!')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Correct Count', value: game.vowelCount.toString(), inline: true },
                    { name: 'Difficulty', value: game.difficulty, inline: true },
                    { name: 'Category', value: game.category, inline: true },
                    { name: 'Time taken', value: `${timeTaken.toFixed(2)}s`, inline: false },
                    { name: 'Breakdown', value: game.breakdown, inline: false }
                )
                .setFooter({ text: 'Quick Vowel Challenge' })
                .setColor('#00ff00');

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: VowelsGameManager;

export const getVowelsGameManager = (client: Client) => {
    if (!instance) {
        instance = new VowelsGameManager(client);
    }
    return instance;
};
