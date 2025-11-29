import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { CONFIG } from './config';
import { onReady } from './events/ready';
import { onMessageCreate } from './events/messageCreate';
import { onGuildMemberUpdate } from './events/guildMemberUpdate';
import { onMessageReactionAdd } from './events/messageReactionAdd';
import { onInteractionCreate } from './events/interactionCreate';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.once('clientReady', () => onReady(client));
client.on('messageCreate', (message) => onMessageCreate(client, message));
client.on('guildMemberUpdate', (oldMember, newMember) => onGuildMemberUpdate(client, oldMember, newMember));
client.on('messageReactionAdd', (reaction, user) => onMessageReactionAdd(client, reaction as any, user as any));
client.on('interactionCreate', (interaction) => onInteractionCreate(client, interaction));

client.login(CONFIG.BOT_TOKEN);
