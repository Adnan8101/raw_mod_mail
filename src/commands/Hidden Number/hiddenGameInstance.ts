import { Client, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { createCanvas } from 'canvas';

interface HiddenNumberGameState {
    channelId: string;
    missingNumber: number;
    isActive: boolean;
    startTime: number;
}

export class HiddenNumberGameManager {
    private activeGames: Map<string, HiddenNumberGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number, targetChannel: any): Promise<boolean> {
        const channelId = targetChannel.id;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let minRange = 10;
        let maxRange = 99;
        let chunkSize = 45;

        if (difficulty === 'Medium') {
            minRange = 100;
            maxRange = 999;
            chunkSize = 80;
        } else if (difficulty === 'Hard') {
            minRange = 1000;
            maxRange = 9999;
            chunkSize = 110;
        }

        // 1. Bot picks a random starting number
        // Ensure startNumber + chunkSize <= maxRange
        // So startNumber <= maxRange - chunkSize
        const maxStart = maxRange - chunkSize;
        // Also ensure startNumber >= minRange
        let startNumber = Math.floor(Math.random() * (maxStart - minRange + 1)) + minRange;

        // Force start number to be Odd (as requested for difficulty)
        if (startNumber % 2 === 0) {
            startNumber++;
        }

        // 2. Bot generates consecutive numbers
        const numbers: number[] = [];
        for (let i = 0; i < chunkSize; i++) {
            numbers.push(startNumber + i);
        }

        // 3. Bot randomly removes 1 number
        // User requested "the odd number is difficult to find", so we prioritize removing an odd number.
        const oddIndices = numbers
            .map((num, index) => (num % 2 !== 0 ? index : -1))
            .filter(index => index !== -1);

        const missingIndex = oddIndices[Math.floor(Math.random() * oddIndices.length)];
        const missingNumber = numbers[missingIndex];
        numbers.splice(missingIndex, 1); // Remove the number

        // Send DM to command author
        try {
            await interaction.user.send(`Hidden Number (${difficulty}):\n|| ${missingNumber} ||`);
        } catch (error) {
            await interaction.editReply({ content: '❌ I could not DM you the hidden number. Please enable DMs and try again.' });
            return true;
        }

        // 4. Create Canvas Grid
        // Calculate grid size based on chunkSize (which is now chunkSize - 1 visible numbers)
        // Easy: 45-1=44. Sqrt(44) ~ 6.6 -> 7x7=49 (5 empty spots? User said "Grid always contains 49 visible numbers" for old version.
        // New request: "chunk will be 45". 
        // If chunk is 45, and we remove 1, we have 44 numbers.
        // If we want a perfect grid, we need a square number or close to it.
        // 45 is close to 7x7=49.
        // 80 is close to 9x9=81.
        // 120 is close to 11x11=121.

        // Let's determine cols/rows to fit all numbers.
        const count = numbers.length; // chunkSize - 1
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        // Adjust canvas size based on rows/cols
        // Add padding
        const padding = 40;

        // Adjust cell size based on difficulty/content
        // Hard mode has 4 digits, so we need more width.
        let cellWidth = 100;
        if (difficulty === 'Hard') {
            cellWidth = 140;
        } else if (difficulty === 'Medium') {
            cellWidth = 120;
        }

        const cellHeight = 80;

        const width = (cols * cellWidth) + (padding * 2);
        const height = (rows * cellHeight) + (padding * 2);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2b2d31'; // Discord dark theme backgroundish
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw numbers
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < numbers.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);

            // Calculate x and y with padding
            const x = padding + (col * cellWidth) + (cellWidth / 2);
            const y = padding + (row * cellHeight) + (cellHeight / 2);

            ctx.fillText(numbers[i].toString(), x, y);
        }

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'hidden_grid.png' });

        const embed = new EmbedBuilder()
            .setDescription(`**One number is missing from this sequence. First correct answer wins.**\nDifficulty: **${difficulty}**${time > 0 ? `\nImage will be deleted in ${time} seconds.` : ''}\n\n**Type the missing number. First correct answer wins.**`)
            .setImage('attachment://hidden_grid.png')
            .setColor(null); // No color bars

        await interaction.editReply({
            content: `✅ **Game Created in <#${channelId}>!** Check your DMs for the hidden number.`
        });

        let sentMessage: Message | undefined;

        if (targetChannel && targetChannel.isTextBased && targetChannel.isTextBased()) {
            // Check if it's a DM or Guild channel to be safe, though usually Guild.
            if (!targetChannel.isDMBased()) {
                sentMessage = await (targetChannel as TextChannel).send({
                    embeds: [embed],
                    files: [attachment]
                });
            } else {
                // Fallback for DM if user selected DM channel somehow
                const dm = targetChannel as any;
                if (dm.send) {
                    sentMessage = await dm.send({
                        embeds: [embed],
                        files: [attachment]
                    });
                }
            }
        }

        const gameState: HiddenNumberGameState = {
            channelId,
            missingNumber,
            isActive: true,
            startTime: Date.now()
        };

        this.activeGames.set(channelId, gameState);

        // Handle time logic
        if (time > 0 && sentMessage) {
            setTimeout(async () => {
                try {
                    // Check if game is still active
                    if (!this.activeGames.has(channelId)) return;

                    if (sentMessage && sentMessage.deletable) {
                        await sentMessage.delete();
                    }

                } catch (error) {
                    console.error('Error in Hidden Number Game timeout:', error);
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

        const missingNumber = game.missingNumber;
        this.activeGames.delete(channelId);

        const embed = new EmbedBuilder()
            .setTitle('Game Ended')
            .setDescription(`Missing number was: **${missingNumber}**`)
            .setColor(null);

        await interaction.reply({ embeds: [embed] });
        return true;
    }

    public async handleMessage(message: Message) {
        const game = this.activeGames.get(message.channelId);
        if (!game || !game.isActive || message.author.bot) return;

        const content = message.content.trim();

        // Exact match check
        if (content === game.missingNumber.toString()) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            try {
                await message.react('✔️');
            } catch (e) {
                console.error('Failed to react:', e);
            }

            const embed = new EmbedBuilder()
                .setTitle('Hidden Number — Winner')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: false },
                    { name: 'Missing Number', value: game.missingNumber.toString(), inline: false }
                )
                .setFooter({ text: 'Game Completed' })
                .setColor(null);

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: HiddenNumberGameManager;

export const getHiddenNumberGameManager = (client: Client) => {
    if (!instance) {
        instance = new HiddenNumberGameManager(client);
    }
    return instance;
};
