import { Client, ChatInputCommandInteraction, EmbedBuilder, Message, TextChannel, MessageFlags } from 'discord.js';
import { ReverseCanvas } from './reverseCanvas';

interface ReverseGameState {
    channelId: string;
    originalText: string;
    reversedText: string;
    isActive: boolean;
    startTime: number;
    difficulty: string;
    charset: string;
    displayTime: number;
    starterId: string;
}

export class ReverseGameManager {
    private activeGames: Map<string, ReverseGameState> = new Map();
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    private generateText(difficulty: string, charset: string): string {
        const wordsList = ['sun', 'moon', 'star', 'sky', 'cloud', 'rain', 'snow', 'wind', 'fire', 'ice', 'tree', 'flower', 'leaf', 'root', 'seed', 'bird', 'fish', 'cat', 'dog', 'wolf', 'lion', 'tiger', 'bear', 'code', 'data', 'byte', 'bit', 'web', 'net', 'app', 'bot', 'chat', 'game', 'play', 'win', 'lose', 'run', 'jump', 'walk', 'talk', 'sing', 'dance', 'read', 'write', 'draw', 'paint', 'cook', 'eat', 'drink', 'sleep', 'dream', 'wake', 'live', 'love', 'hope', 'wish', 'want', 'need', 'have', 'give', 'take', 'make', 'do', 'go', 'come', 'stay', 'leave', 'stop', 'start', 'end', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'dry', 'wet', 'hard', 'soft', 'big', 'small', 'tall', 'short', 'long', 'wide', 'narrow', 'high', 'low', 'deep', 'shallow', 'light', 'dark', 'bright', 'dim', 'loud', 'quiet', 'good', 'bad', 'happy', 'sad', 'angry', 'calm', 'brave', 'fear', 'joy', 'pain', 'rich', 'poor', 'free', 'busy', 'idle', 'lazy', 'smart', 'dumb', 'wise', 'fool', 'kind', 'mean', 'nice', 'rude', 'polite', 'honest', 'false', 'true', 'real', 'fake', 'new', 'old', 'young', 'fresh', 'stale', 'clean', 'dirty', 'neat', 'messy', 'safe', 'danger', 'peace', 'war', 'fight', 'peace', 'friend', 'enemy', 'hero', 'villain', 'king', 'queen', 'prince', 'lord', 'lady', 'god', 'devil', 'angel', 'demon', 'ghost', 'spirit', 'soul', 'mind', 'body', 'heart', 'blood', 'bone', 'skin', 'hair', 'eye', 'ear', 'nose', 'mouth', 'hand', 'foot', 'arm', 'leg', 'head', 'face', 'back', 'chest', 'belly', 'waist', 'hip', 'knee', 'ankle', 'toe', 'finger', 'thumb', 'nail', 'tooth', 'tongue', 'lip', 'chin', 'cheek', 'brow', 'lash', 'lid', 'pupil', 'iris', 'lens', 'retina', 'nerve', 'brain', 'skull', 'spine', 'rib', 'lung', 'liver', 'kidney', 'stomach', 'gut', 'bowel', 'bladder', 'womb', 'egg', 'sperm', 'cell', 'gene', 'dna', 'rna', 'atom', 'ion', 'bond', 'acid', 'base', 'salt', 'sugar', 'fat', 'oil', 'wax', 'soap', 'dye', 'ink', 'glue', 'clay', 'sand', 'dust', 'dirt', 'mud', 'rock', 'stone', 'gem', 'jewel', 'gold', 'silver', 'copper', 'iron', 'steel', 'metal', 'wood', 'glass', 'paper', 'cloth', 'silk', 'wool', 'cotton', 'linen', 'hemp', 'jute', 'nylon', 'rayon', 'plastic', 'rubber', 'leather', 'fur', 'hide', 'skin', 'shell', 'bone', 'horn', 'tusk', 'claw', 'beak', 'wing', 'fin', 'tail', 'scale', 'feather', 'hair', 'wool', 'fur', 'down', 'fleece', 'pelt', 'hide', 'skin', 'leather', 'suede', 'velvet', 'satin', 'silk', 'lace', 'mesh', 'net', 'web', 'gauze', 'felt', 'flannel', 'tweed', 'denim', 'canvas', 'linen', 'cotton', 'wool', 'silk', 'rayon', 'nylon', 'polyester', 'acrylic', 'spandex', 'lycra', 'latex', 'rubber', 'plastic', 'vinyl', 'leather', 'fur', 'feather', 'down', 'hair', 'bristle', 'fiber', 'thread', 'yarn', 'string', 'rope', 'cord', 'cable', 'wire', 'chain', 'band', 'strap', 'belt', 'tape', 'ribbon', 'lace', 'braid', 'knot', 'loop', 'coil', 'spiral', 'circle', 'ring', 'disk', 'ball', 'sphere', 'globe', 'orb', 'cube', 'block', 'brick', 'tile', 'slab', 'sheet', 'plate', 'panel', 'board', 'plank', 'beam', 'post', 'pole', 'rod', 'stick', 'staff', 'cane', 'wand', 'bat', 'club', 'mace', 'axe', 'sword', 'knife', 'spear', 'arrow', 'bow', 'gun', 'bomb', 'mine', 'trap', 'net', 'cage', 'jail', 'cell', 'room', 'hall', 'wall', 'floor', 'roof', 'door', 'gate', 'window', 'glass', 'pane', 'frame', 'sash', 'sill', 'step', 'stair', 'ramp', 'lift', 'hoist', 'crane', 'jack', 'pump', 'fan', 'blower', 'vent', 'pipe', 'tube', 'hose', 'duct', 'drain', 'sewer', 'sink', 'basin', 'tub', 'bath', 'shower', 'toilet', 'seat', 'bench', 'chair', 'stool', 'sofa', 'couch', 'bed', 'cot', 'crib', 'cradle', 'mat', 'rug', 'carpet', 'floor', 'ground', 'earth', 'soil', 'dirt', 'dust', 'sand', 'mud', 'clay', 'rock', 'stone', 'pebble', 'gravel', 'boulder', 'cliff', 'hill', 'mount', 'peak', 'ridge', 'slope', 'valley', 'plain', 'field', 'meadow', 'pasture', 'grass', 'weed', 'herb', 'shrub', 'bush', 'tree', 'wood', 'forest', 'jungle', 'swamp', 'marsh', 'bog', 'fen', 'moor', 'heath', 'desert', 'dune', 'oasis', 'beach', 'coast', 'shore', 'bank', 'edge', 'side', 'rim', 'lip', 'border', 'bound', 'limit', 'end', 'start', 'begin', 'finish', 'stop', 'halt', 'pause', 'wait', 'stay', 'go', 'come', 'move', 'run', 'walk', 'fly', 'swim', 'dive', 'jump', 'leap', 'hop', 'skip', 'dance', 'spin', 'turn', 'roll', 'slide', 'glide', 'drift', 'float', 'sink', 'fall', 'drop', 'rise', 'lift', 'climb', 'crawl', 'creep', 'sneak', 'hide', 'seek', 'find', 'lose', 'keep', 'hold', 'carry', 'bear', 'bring', 'take', 'give', 'send', 'get', 'buy', 'sell', 'pay', 'cost', 'price', 'value', 'worth', 'cheap', 'dear', 'rich', 'poor', 'money', 'cash', 'coin', 'note', 'check', 'card', 'bank', 'fund', 'stock', 'share', 'bond', 'loan', 'debt', 'tax', 'fee', 'fine', 'bill', 'rate', 'rent', 'wage', 'pay', 'earn', 'gain', 'loss', 'profit', 'trade', 'deal', 'sale', 'shop', 'store', 'mart', 'mall', 'market', 'fair', 'show', 'expo', 'fete', 'gala', 'party', 'ball', 'prom', 'disco', 'club', 'pub', 'bar', 'cafe', 'diner', 'hotel', 'motel', 'inn', 'lodge', 'camp', 'tent', 'hut', 'shed', 'barn', 'farm', 'ranch', 'house', 'home', 'flat', 'room', 'hall', 'loft', 'attic', 'cellar', 'base', 'roof', 'wall', 'floor', 'door', 'gate', 'fence', 'hedge', 'yard', 'lawn', 'garden', 'park', 'plaza', 'square', 'street', 'road', 'lane', 'path', 'track', 'trail', 'route', 'way', 'map', 'chart', 'plan', 'plot', 'grid', 'zone', 'area', 'region', 'land', 'state', 'town', 'city', 'urban', 'rural', 'local', 'global', 'world', 'earth', 'planet', 'star', 'sun', 'moon', 'sky', 'space', 'void', 'null', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

        // Difficulty now determines word length
        let minLen = 3;
        let maxLen = 5;
        if (difficulty === 'Medium') { minLen = 6; maxLen = 8; }
        if (difficulty === 'Hard') { minLen = 9; maxLen = 15; }

        let filteredWords = wordsList.filter(w => w.length >= minLen && w.length <= maxLen);
        if (filteredWords.length === 0) {
            // Fallback if no words match (unlikely given the list)
            filteredWords = wordsList;
        }

        const word = filteredWords[Math.floor(Math.random() * filteredWords.length)];
        return word;
    }

    public async startGame(interaction: ChatInputCommandInteraction, difficulty: string, time: number, charset: string): Promise<boolean> {
        const channelId = interaction.channelId;
        if (this.activeGames.has(channelId)) {
            return false;
        }

        const text = this.generateText(difficulty, charset);
        const reversed = text.split('').reverse().join('');

        // Generate Image
        const attachment = await ReverseCanvas.generateImage(text);

        const embed = new EmbedBuilder()
            .setTitle('Reverse the Word')
            .setDescription(`**Reverse the word. You have ${time > 0 ? time + 's' : 'unlimited time'} to view.**\n\n**Type the word reversed. First exact match wins.**`)
            .setImage('attachment://reverse_challenge.png')
            .setColor('#0099ff');

        await interaction.reply({
            embeds: [embed],
            files: [attachment]
        });

        // DM the starter
        try {
            await interaction.user.send(`Your answer: || ${reversed} ||`);
        } catch (e) {
            await interaction.followUp({ content: 'Couldn’t DM answer — enable DMs.', flags: MessageFlags.Ephemeral });
        }

        const gameState: ReverseGameState = {
            channelId,
            originalText: text,
            reversedText: reversed,
            isActive: true,
            startTime: Date.now(),
            difficulty,
            charset,
            displayTime: time,
            starterId: interaction.user.id
        };

        this.activeGames.set(channelId, gameState);

        if (time > 0) {
            setTimeout(async () => {
                try {
                    // Check if game is still active
                    if (!this.activeGames.has(channelId)) return;

                    await interaction.deleteReply();
                } catch (error) {
                    console.error('Error in Reverse Game timeout:', error);
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

        if (!interaction.memberPermissions?.has('ManageGuild') && interaction.user.id !== game.starterId) {
            return false;
        }

        const answer = game.reversedText;
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

        const content = message.content.trim(); // Keep case for now, but user said case-insensitive default.

        // "Case sensitivity: recommend case-insensitive matching to avoid failing due to capitalization; but you can make it exact-case if desired. (Default: case-insensitive.)"
        if (content.toLowerCase() === game.reversedText.toLowerCase()) {
            game.isActive = false;
            this.activeGames.delete(message.channelId);

            await message.react('✅');

            const timeTaken = ((Date.now() - game.startTime) / 1000);

            const embed = new EmbedBuilder()
                .setTitle('Sentence Reverse — Winner!')
                .addFields(
                    { name: 'Winner', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Original', value: game.originalText, inline: true },
                    { name: 'Reversed', value: game.reversedText, inline: true },
                    { name: 'Difficulty', value: game.difficulty, inline: true },
                    { name: 'Time taken', value: `${timeTaken.toFixed(2)}s`, inline: false }
                )
                .setFooter({ text: 'Quick Reverse Challenge' })
                .setColor('#00ff00');

            if (message.channel.isTextBased() && !(message.channel as any).isDMBased()) {
                await (message.channel as TextChannel).send({ embeds: [embed] });
            } else if ((message.channel as any).isDMBased()) {
                await (message.channel as any).send({ embeds: [embed] });
            }
        }
    }
}

let instance: ReverseGameManager;

export const getReverseGameManager = (client: Client) => {
    if (!instance) {
        instance = new ReverseGameManager(client);
    }
    return instance;
};
