import { Client, Message, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { createCanvas, registerFont, loadImage, Image } from 'canvas';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface GameState {
    channelId: string;
    difficulty: Difficulty;
    targetAnswer: number;
    startTime: number;
    isActive: boolean;
    hostId: string;
}

export class EmojiEquationGameManager {
    private activeGames: Map<string, GameState> = new Map();
    private client: Client;

    // Pool of emojis to use
    private emojiPool = [
        // Fruits & Vegetables
        '🍎', '🍌', '🍇', '🍉', '🍒', '🍓', '🍍', '🥝', '🥑', '🍆', '🥕', '🌽', '🥦', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥞', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯',
        '🍋', '🍊', '🍐', '🍑', '🥭', '🥥', '🥔', '🧄', '🧅', '🥗', '🍿', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡',
        // Animals
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
        // Objects
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘'
    ];

    constructor(client: Client) {
        this.client = client;
    }

    public async startGame(channelId: string, difficulty: Difficulty, hostId: string, time?: number): Promise<boolean> {
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const { equations, answer, emojis, values } = this.generateEquations(difficulty);

        const gameState: GameState = {
            channelId,
            difficulty,
            targetAnswer: answer,
            startTime: Date.now(),
            isActive: true,
            hostId
        };

        this.activeGames.set(channelId, gameState);

        const buffer = await this.renderGame(equations);
        const attachment = new AttachmentBuilder(buffer, { name: 'equation.png' });

        const channel = await this.client.channels.fetch(channelId) as TextChannel;
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('Emoji Equation')
                .setDescription(`**Difficulty:** ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}\n\nSolve the final equation! First correct answer wins.\n\n**Type the missing term (number only). First correct answer wins.**`)
                .setImage('attachment://equation.png')
                .setColor('#0099ff')
                .setFooter({ text: 'Type the number to answer!' });

            const msg = await channel.send({ embeds: [embed], files: [attachment] });

            // DM the host the answer
            try {
                const host = await this.client.users.fetch(hostId);
                await host.send(`**Emoji Equation Answer:** ||${answer}||`);
            } catch (e) {
                console.error('Failed to DM host:', e);
            }

            if (time && time > 0) {
                setTimeout(async () => {
                    if (this.activeGames.has(channelId) && this.activeGames.get(channelId)?.isActive) {
                        try {
                            await msg.delete();
                            await channel.send('Time is up! The image has been deleted. You can still answer.');
                        } catch (e) { }
                    }
                }, time * 1000);
            }
        }

        return true;
    }

    public async stopGame(channelId: string): Promise<number | null> {
        const game = this.activeGames.get(channelId);
        if (!game) return null;

        const answer = game.targetAnswer;
        this.activeGames.delete(channelId);
        return answer;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const guess = parseInt(message.content.trim());
        if (isNaN(guess)) return;

        if (guess === game.targetAnswer) {
            game.isActive = false;
            await message.react('✅');

            const embed = new EmbedBuilder()
                .setTitle('🎉 Correct Answer!')
                .setDescription(`**Winner:** ${message.author}\n**Correct Answer:** ${game.targetAnswer}\n**Difficulty:** ${game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}`)
                .setColor('#00ff00');

            await (message.channel as TextChannel).send({ embeds: [embed] });
            this.activeGames.delete(message.channelId);
        }
    }

    private generateEquations(difficulty: Difficulty) {
        let numEmojis = 3;
        let maxVal = 10;
        let numEquations = 3;
        let allowedOps = ['+'];

        if (difficulty === 'medium') {
            numEmojis = 4;
            maxVal = 15;
            numEquations = 4;
            allowedOps = ['+', '-'];
        } else if (difficulty === 'hard') {
            numEmojis = 5;
            maxVal = 20;
            numEquations = 5;
            allowedOps = ['+', '-', '*'];
        }

        // Select unique emojis
        const shuffledEmojis = [...this.emojiPool].sort(() => 0.5 - Math.random());
        const selectedEmojis = shuffledEmojis.slice(0, numEmojis);

        // Assign values
        const values: Record<string, number> = {};
        selectedEmojis.forEach(e => values[e] = Math.floor(Math.random() * maxVal) + 1);

        const equations: string[] = [];

        // Helper to evaluate expression
        const evaluate = (val1: number, op: string, val2: number): number | null => {
            if (op === '+') return val1 + val2;
            if (op === '-') return val1 - val2;
            if (op === '*') return val1 * val2;
            if (op === '/') {
                if (val2 === 0) return null;
                if (val1 % val2 === 0) return val1 / val2;
                return null;
            }
            return null;
        };

        for (let i = 0; i < numEquations - 1; i++) {
            // Pick 2-3 emojis
            const termsCount = Math.floor(Math.random() * 2) + 2; // 2 or 3
            const terms: string[] = [];
            const ops: string[] = [];

            // First term
            let emoji = selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)];
            terms.push(emoji);
            let currentVal = values[emoji];

            // Shuffle ops for uniqueness in this equation
            let availableOps = [...allowedOps].sort(() => 0.5 - Math.random());

            for (let j = 1; j < termsCount; j++) {
                let op = availableOps.length > 0 ? availableOps.pop()! : allowedOps[Math.floor(Math.random() * allowedOps.length)];
                emoji = selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)];
                const val = values[emoji];

                const result = evaluate(currentVal, op, val);

                if (result !== null) {
                    currentVal = result;
                    ops.push(op);
                    terms.push(emoji);
                } else {
                    // Fallback to addition if operation fails (e.g. non-integer division)
                    op = '+';
                    currentVal += val;
                    ops.push(op);
                    terms.push(emoji);
                }
            }

            // Construct equation string
            let eqStr = terms[0];
            for (let k = 0; k < ops.length; k++) {
                eqStr += ` ${ops[k]} ${terms[k + 1]}`;
            }
            eqStr += ` = ${currentVal}`;
            equations.push(eqStr);
        }

        // Final Equation
        const finalTermsCount = difficulty === 'hard' ? 3 : (difficulty === 'medium' ? 3 : 2);
        const finalTerms: string[] = [];
        const finalOps: string[] = [];

        let finalEmoji = selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)];
        finalTerms.push(finalEmoji);
        let finalAnswer = values[finalEmoji];

        // Shuffle ops for final equation
        let availableOps = [...allowedOps].sort(() => 0.5 - Math.random());

        for (let j = 1; j < finalTermsCount; j++) {
            let op = availableOps.length > 0 ? availableOps.pop()! : allowedOps[Math.floor(Math.random() * allowedOps.length)];
            const emoji = selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)];
            const val = values[emoji];

            const result = evaluate(finalAnswer, op, val);

            if (result !== null) {
                finalAnswer = result;
                finalOps.push(op);
                finalTerms.push(emoji);
            } else {
                op = '+';
                finalAnswer += val;
                finalOps.push(op);
                finalTerms.push(emoji);
            }
        }

        let finalEqStr = finalTerms[0];
        for (let k = 0; k < finalOps.length; k++) {
            finalEqStr += ` ${finalOps[k]} ${finalTerms[k + 1]}`;
        }
        finalEqStr += ` = ?`;

        equations.push(finalEqStr);

        return { equations, answer: finalAnswer, emojis: selectedEmojis, values };
    }

    private getEmojiUrl(emoji: string): string {
        const codePoint = emoji.codePointAt(0)?.toString(16);
        return `https://twemoji.maxcdn.com/v/latest/72x72/${codePoint}.png`;
    }

    private async renderGame(equations: string[]): Promise<Buffer> {
        const width = 800;
        const lineHeight = 100;
        const height = 100 + (equations.length * lineHeight);
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2f3136'; // Discord dark mode bg
        ctx.fillRect(0, 0, width, height);

        // Text settings
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let y = 100;

        for (const eq of equations) {
            // Parse equation: "🍎 + 🍌 = 10" -> ["🍎", "+", "🍌", "=", "10"]
            const parts = eq.split(' ');

            // Calculate total width to center
            let totalWidth = 0;
            const elementWidths: number[] = [];
            const elementImages: (Image | null)[] = [];
            const spacing = 25;

            for (const part of parts) {
                if (this.emojiPool.includes(part)) {
                    // It's an emoji
                    try {
                        const img = await loadImage(this.getEmojiUrl(part));
                        elementImages.push(img);
                        elementWidths.push(72); // Twemoji size
                    } catch (e) {
                        console.error(`Failed to load emoji: ${part}`, e);
                        // Fallback to text if image fails
                        elementImages.push(null);
                        const textWidth = ctx.measureText(part).width;
                        elementWidths.push(textWidth);
                    }
                } else {
                    // Text (numbers, operators)
                    elementImages.push(null);
                    const textWidth = ctx.measureText(part).width;
                    elementWidths.push(textWidth);
                }
                totalWidth += elementWidths[elementWidths.length - 1];
            }

            // Add spacing width
            totalWidth += (parts.length - 1) * spacing;

            // Draw elements centered
            let currentX = (width - totalWidth) / 2;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const img = elementImages[i];
                const w = elementWidths[i];

                if (img) {
                    // Draw emoji image
                    ctx.drawImage(img, currentX, y - 36, 72, 72);
                } else {
                    // Draw text
                    ctx.fillText(part, currentX + (w / 2), y + 5);
                }

                currentX += w + spacing;
            }

            y += lineHeight;
        }

        return canvas.toBuffer();
    }
}

let gameManager: EmojiEquationGameManager | null = null;

export const getEmojiEquationManager = (client: Client) => {
    if (!gameManager) {
        gameManager = new EmojiEquationGameManager(client);
    }
    return gameManager;
};
