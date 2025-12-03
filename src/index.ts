import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from 'discord.js';
import { CONFIG } from './config';
import { onReady } from './events/ready';
import { onMessageCreate } from './events/messageCreate';
import { onGuildMemberUpdate } from './events/guildMemberUpdate';
import { onMessageReactionAdd } from './events/messageReactionAdd';
import { onInteractionCreate } from './events/interactionCreate';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Services
import { ConfigService } from './services/ConfigService';
import { WhitelistService } from './services/WhitelistService';
import { LoggingService } from './services/LoggingService';
import { CaseService } from './services/CaseService';
import { AutoResponderService } from './services/AutoResponderService';
import { ModerationService } from './services/ModerationService';
import { GuildConfigService } from './services/GuildConfigService';
import { AutoModService } from './services/AutoModService';
import { InviteService } from './services/InviteService';
import { StatsService } from './services/StatsService';

// Modules
import { ActionLimiter } from './modules/ActionLimiter';
import { Executor } from './modules/Executor';
import { AuditLogMonitor } from './modules/AuditLogMonitor';
import { RecoveryManager } from './modules/RecoveryManager';
import { AutoResponder } from './modules/AutoResponder';
import { LoggingMonitor } from './modules/LoggingMonitor';
import { QuarantineMonitor } from './modules/QuarantineMonitor';

// Utils
import { createUsageEmbed } from './utils/embedHelpers';
import { DatabaseManager } from './utils/DatabaseManager';

// Commands
import * as antinukeCommand from './commands/antinuke/antinuke';
import * as setlimitCommand from './commands/antinuke/setlimit';
import * as setpunishmentCommand from './commands/antinuke/setpunishment';
import * as logsCommand from './commands/logging/logs';
import * as whitelistCommand from './commands/antinuke/whitelist';
import * as automodWhitelistCommand from './commands/automod/automod-whitelist';
import * as serverCommand from './commands/server';
import * as autoresponderCommand from './commands/autoresponder/autoresponder';
// Moderation Commands
import * as banCommand from './commands/moderations/ban';
import * as unbanCommand from './commands/moderations/unban';
import * as kickCommand from './commands/moderations/kick';
import * as muteCommand from './commands/moderations/mute';
import * as unmuteCommand from './commands/moderations/unmute';
import * as warnCommand from './commands/moderations/warn';
import * as checkwarnCommand from './commands/moderations/checkwarn';
import * as quarantineCommand from './commands/moderations/quarantine';
import * as channelCommand from './commands/moderations/channel';
import * as softbanCommand from './commands/moderations/softban';
import * as nickCommand from './commands/moderations/nick';
import * as roleCommand from './commands/moderations/role';
import * as setprefixCommand from './commands/Utility/setprefix';
import * as purgeCommand from './commands/moderations/purge';
import * as nukeCommand from './commands/moderations/nuke';
import * as automodCommand from './commands/automod/automod';
import * as loggingCommand from './commands/logging/logging';
import * as helpCommand from './commands/help';
import * as modlogsCommand from './commands/logging/modlogs';
// Invite/Welcome Commands
import * as invitesCommand from './commands/invites_welcome/invites';
import * as welcomeCommand from './commands/invites_welcome/welcome';
import * as inviterCommand from './commands/invites_welcome/inviter';
import * as addInvitesCommand from './commands/invites_welcome/add-invites';
import * as deleteInvitesCommand from './commands/invites_welcome/delete-invites';
import * as resetInvitesCommand from './commands/invites_welcome/reset-invites';
import * as inviteLinksCommand from './commands/invites_welcome/invite-links';
import * as leaveCommand from './commands/invites_welcome/leave';

// Server Stats Commands
import * as serverStatsCommand from './commands/serverstats/serverstats';

// Giveaway Commands
import * as gcreateCommand from './commands/Giveaways/gcreate';
import * as gcancelCommand from './commands/Giveaways/gcancel';
import * as gendCommand from './commands/Giveaways/gend';
import * as grerollCommand from './commands/Giveaways/greroll';
import * as glistCommand from './commands/Giveaways/glist';
import * as gstartCommand from './commands/Giveaways/gstart';

// Voice Commands
import * as autodragCommand from './commands/Voice/autodrag';
import * as vcclearCommand from './commands/Voice/vcclear';
import * as autoafkCommand from './commands/Voice/autoafk';
import * as deafenallCommand from './commands/Voice/deafenall';
import * as dragCommand from './commands/Voice/drag';
import * as muteallCommand from './commands/Voice/muteall';
import * as toCommand from './commands/Voice/to';
import * as undeafenallCommand from './commands/Voice/undeafenall';
import * as unmuteallCommand from './commands/Voice/unmuteall';
import * as wvCommand from './commands/Voice/wv';

import { GiveawayManager } from './services/GiveawayManager';
import { onVoiceStateUpdate } from './events/voiceStateUpdate';
import { createPrefixInteraction } from './utils/prefixCommand';
import { createErrorEmbed } from './utils/embedHelpers';

// Load environment variables
dotenv.config();

// Initialize Prisma
const prisma = new PrismaClient({
    log: ['error', 'warn'],
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// Command collection
const commands = new Collection<string, any>();

// Initialize services
const configService = new ConfigService(prisma);
const whitelistService = new WhitelistService(prisma);
const loggingService = new LoggingService(prisma, client);
const caseService = new CaseService(prisma);
const autoResponderService = new AutoResponderService(prisma);
const moderationService = new ModerationService(prisma);
const guildConfigService = new GuildConfigService(prisma);
const autoModService = new AutoModService(prisma);
const inviteService = new InviteService();
const statsService = StatsService.getInstance(client);

// Ticket System Integration
import PostgresDB from './core/db/postgresDB';
import { router } from './core/interactionRouter';
import { SetupWizardHandler } from './modules/ticket/setupWizard';
import { TicketHandler } from './modules/ticket/ticketHandler';
import { PanelHandler } from './modules/panel/panelHandler';
import { ErrorHandler } from './core/errorHandler';
import { EmbedController } from './core/embedController';

// Initialize PostgresDB for Tickets
const ticketDB = new PostgresDB(process.env.DATABASE_URL);
(client as any).db = ticketDB; // Attach to client

// Register Ticket Handlers
router.register('wizard', new SetupWizardHandler());
router.register('ticket', new TicketHandler());
router.register('panel', new PanelHandler());

// Initialize modules
const actionLimiter = new ActionLimiter(prisma, configService);
const executor = new Executor(prisma, client, configService, caseService, loggingService, actionLimiter);
const recoveryManager = new RecoveryManager(prisma, client, caseService, loggingService);
const auditLogMonitor = new AuditLogMonitor(
    client,
    configService,
    whitelistService,
    actionLimiter,
    executor
);
const autoResponder = new AutoResponder(client, autoResponderService);
const loggingMonitor = new LoggingMonitor(client, prisma);
const quarantineMonitor = new QuarantineMonitor(client, moderationService);

// Initialize AutoModMonitor
let autoModMonitor: any = null;

// Services bundle for commands
const services = {
    configService,
    whitelistService,
    loggingService,
    caseService,
    actionLimiter,
    executor,
    recoveryManager,
    autoResponderService,
    moderationService,
    guildConfigService,
    autoModService,
    prisma,
    commands,
    ticketDB // Add to services if needed
};

// Register commands
function registerCommands() {
    // Main commands
    commands.set(antinukeCommand.data.name, antinukeCommand);
    commands.set(setlimitCommand.data.name, setlimitCommand);
    commands.set(setpunishmentCommand.data.name, setpunishmentCommand);
    commands.set(logsCommand.data.name, logsCommand);
    commands.set(whitelistCommand.data.name, whitelistCommand);
    commands.set(automodWhitelistCommand.data.name, automodWhitelistCommand);
    commands.set(serverCommand.data.name, serverCommand);
    commands.set(autoresponderCommand.data.name, autoresponderCommand);
    commands.set(channelCommand.data.name, channelCommand);
    commands.set(setprefixCommand.data.name, setprefixCommand);
    commands.set(purgeCommand.data.name, purgeCommand);
    commands.set(nukeCommand.data.name, nukeCommand);
    commands.set(automodCommand.data.name, automodCommand);
    commands.set(loggingCommand.data.name, loggingCommand);
    commands.set(helpCommand.data.name, helpCommand);
    commands.set(modlogsCommand.data.name, modlogsCommand);

    // Moderation commands
    commands.set(banCommand.data.name, banCommand);
    commands.set(unbanCommand.data.name, unbanCommand);
    commands.set(kickCommand.data.name, kickCommand);
    commands.set(muteCommand.data.name, muteCommand);
    commands.set(unmuteCommand.data.name, unmuteCommand);
    commands.set(warnCommand.data.name, warnCommand);
    commands.set(checkwarnCommand.data.name, checkwarnCommand);
    commands.set(quarantineCommand.data.name, quarantineCommand);
    commands.set(softbanCommand.data.name, softbanCommand);
    commands.set(nickCommand.data.name, nickCommand);
    commands.set(roleCommand.data.name, roleCommand);

    // Invite/Welcome commands
    commands.set(invitesCommand.data.name, invitesCommand);
    commands.set(welcomeCommand.data.name, welcomeCommand);
    commands.set(inviterCommand.data.name, inviterCommand);
    commands.set(addInvitesCommand.data.name, addInvitesCommand);
    commands.set(deleteInvitesCommand.data.name, deleteInvitesCommand);
    commands.set(resetInvitesCommand.data.name, resetInvitesCommand);
    commands.set(inviteLinksCommand.data.name, inviteLinksCommand);
    commands.set(leaveCommand.data.name, leaveCommand);


    // Server Stats commands
    commands.set(serverStatsCommand.data.name, serverStatsCommand);

    // Giveaway Commands
    commands.set(gcreateCommand.data.name, gcreateCommand);
    commands.set(gcancelCommand.data.name, gcancelCommand);
    commands.set(gendCommand.data.name, gendCommand);
    commands.set(grerollCommand.data.name, grerollCommand);
    commands.set(glistCommand.data.name, glistCommand);
    commands.set(gstartCommand.name, gstartCommand);

    // Voice Commands
    commands.set(autodragCommand.data.name, autodragCommand);
    commands.set(vcclearCommand.data.name, vcclearCommand);
    commands.set(autoafkCommand.data.name, autoafkCommand);
    commands.set(deafenallCommand.data.name, deafenallCommand);
    commands.set(dragCommand.data.name, dragCommand);
    commands.set(muteallCommand.data.name, muteallCommand);
    commands.set(toCommand.data.name, toCommand);
    commands.set(undeafenallCommand.data.name, undeafenallCommand);
    commands.set(unmuteallCommand.data.name, unmuteallCommand);
    commands.set(wvCommand.data.name, wvCommand);

    // Ticket Commands
    const ticketCommand = require('./commands/Tickets/ticket');
    const panelCommand = require('./commands/Tickets/panel');
    // const statusCommand = require('./commands/Tickets/status'); // Optional
    // const aboutCommand = require('./commands/Tickets/about'); // Optional

    commands.set(ticketCommand.data.name, ticketCommand);
    commands.set(panelCommand.data.name, panelCommand);

    // Game Commands
    const gtnCommand = require('./commands/Games/Guess the Number/gtn');
    const equationCommand = require('./commands/Games/Emoji Equation/equation');
    const hiddenCommand = require('./commands/Games/Hidden Number/hidden');
    const mathCommand = require('./commands/Games/Math Game/math');
    const memoryCommand = require('./commands/Games/Memory Game/memory');
    const reverseCommand = require('./commands/Games/reverse/reverse');
    const sequenceCommand = require('./commands/Games/sequence/sequence');
    const vowelsCommand = require('./commands/Games/vowels/vowels');

    commands.set(gtnCommand.data.name, gtnCommand);
    commands.set(equationCommand.data.name, equationCommand);
    commands.set(hiddenCommand.data.name, hiddenCommand);
    commands.set(mathCommand.data.name, mathCommand);
    commands.set(memoryCommand.data.name, memoryCommand);
    commands.set(reverseCommand.data.name, reverseCommand);
    commands.set(sequenceCommand.data.name, sequenceCommand);
    commands.set(vowelsCommand.data.name, vowelsCommand);

    // Owner Commands
    const evalCommand = require('./commands/owner/eval');
    commands.set(evalCommand.data.name, evalCommand);

    console.log('✔ Commands registered:', Array.from(commands.keys()).join(', '));
}

// Deploy commands to Discord
async function deployCommands() {
    const commandsData = Array.from(commands.values())
        .filter(cmd => cmd.data)
        .map(cmd => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    try {
        console.log('🔄 Deploying slash commands...');
        console.log(`DEBUG: CLIENT_ID=${CONFIG.CLIENT_ID}`);
        console.log(`DEBUG: Commands count=${commandsData.length}`);
        // console.log(`DEBUG: Commands data=${JSON.stringify(commandsData, null, 2)}`); // Uncomment if needed

        if (!CONFIG.CLIENT_ID) {
            console.error('✖ CLIENT_ID is missing in config/env');
            return;
        }

        if (CONFIG.GUILD_ID) {
            console.log(`🔄 Deploying to guild: ${CONFIG.GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
                { body: commandsData }
            );
            console.log('✔ Successfully deployed slash commands to guild');
        } else {
            console.log('🔄 Deploying globally...');
            await rest.put(
                Routes.applicationCommands(CONFIG.CLIENT_ID),
                { body: commandsData }
            );
            console.log('✔ Successfully deployed slash commands globally');
        }

        console.log('✔ Successfully deployed slash commands globally');
    } catch (error) {
        console.error('✖ Failed to deploy commands:', error);
    }
}

// Periodic tasks
function startPeriodicTasks() {
    // Cleanup old action records every 6 hours
    setInterval(async () => {
        try {
            const deleted = await actionLimiter.cleanupOldActions(30);
            console.log(`🧹 Cleaned up ${deleted} old action records`);
        } catch (error) {
            console.error('Failed to cleanup old actions:', error);
        }
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Cleanup old backups every day
    setInterval(async () => {
        try {
            await recoveryManager.cleanupOldBackups(7);
            console.log('🧹 Cleaned up old backups');
        } catch (error) {
            console.error('Failed to cleanup old backups:', error);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Create snapshots every 12 hours
    setInterval(async () => {
        try {
            const promises = Array.from(client.guilds.cache.keys()).map(guildId =>
                recoveryManager.createSnapshot(guildId).catch(e => console.error(`Failed to create snapshot for ${guildId}:`, e))
            );
            await Promise.allSettled(promises);
            console.log('📸 Created guild snapshots');
        } catch (error) {
            console.error('Failed to create snapshots:', error);
        }
    }, 12 * 60 * 60 * 1000); // 12 hours

    // Update server stats every 30 minutes
    setInterval(async () => {
        try {
            console.log('🔄 Updating server stats...');
            const promises = Array.from(client.guilds.cache.values()).map(async guild => {
                try {
                    const { updated } = await serverStatsCommand.updateServerStats(guild);
                    return updated;
                } catch (error) {
                    console.error(`Failed to update stats for guild ${guild.id}:`, error);
                    return 0;
                }
            });

            const results = await Promise.allSettled(promises);
            const totalUpdated = results.reduce((acc, res) =>
                acc + (res.status === 'fulfilled' ? res.value : 0), 0);

            if (totalUpdated > 0) {
                console.log(`📊 Updated ${totalUpdated} stats panels`);
            }
        } catch (error) {
            console.error('Failed to update server stats:', error);
        }
    }, 30 * 60 * 1000); // 30 minutes

    console.log('✔ Periodic tasks started');
}

// Event Handlers
client.once('clientReady', async () => {
    // Raw ModMail ready
    await onReady(client);

    // Beru ready logic
    console.log(`✔ Bot logged in as ${client.user?.tag}`);
    console.log(` Serving ${client.guilds.cache.size} guilds`);

    // Cache invites for all guilds using InviteService
    console.log('🔄 Caching invites for all guilds...');
    const invitePromises = Array.from(client.guilds.cache.values()).map(async guild => {
        try {
            await inviteService.cacheGuildInvites(guild);
            return true;
        } catch (error: any) {
            console.error(`Failed to cache invites for guild ${guild.id}:`, error);
            return false;
        }
    });

    const inviteResults = await Promise.allSettled(invitePromises);
    const cachedGuilds = inviteResults.filter(r => r.status === 'fulfilled' && r.value).length;

    console.log(`✔ Cached invites for ${cachedGuilds}/${client.guilds.cache.size} guilds`);

    // Initialize AutoModMonitor for 24/7 message monitoring
    const { AutoModMonitor } = await import('./modules/AutoModMonitor');
    autoModMonitor = new AutoModMonitor(client, autoModService, moderationService, loggingService);
    console.log('✔ AutoMod Monitor started - watching all channels 24/7');

    // Register and Deploy commands
    registerCommands();
    await deployCommands();

    // Start periodic tasks
    startPeriodicTasks();

    // Start Giveaway Ticker
    GiveawayManager.getInstance(client).startTicker();
    console.log('✔ Giveaway Ticker started');
});

client.on('messageCreate', async (message) => {
    // Raw ModMail logic
    await onMessageCreate(client, message);

    // Beru logic (prefix commands)
    if (message.author.bot || !message.guild) return;

    const prefix = await guildConfigService.getPrefix(message.guild.id);
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    let command = commands.get(commandName);
    if (!command) {
        command = commands.find((cmd: any) => cmd.prefixCommand?.aliases?.includes(commandName));
    }
    if (!command) return;

    // Check permissions
    if (command.data?.default_member_permissions) {
        const member = message.member!;
        const requiredPerms = BigInt(command.data.default_member_permissions);

        if (!member.permissions.has(requiredPerms)) {
            return;
        }
    }

    try {
        const interaction = await createPrefixInteraction(message, prefix);
        await command.execute(interaction as any, services);
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            const errorEmbed = createErrorEmbed(error.message);
            await message.reply({ embeds: [errorEmbed] });
        } else {
            console.error(`Error executing prefix command ${commandName}:`, error);
            const errorEmbed = createErrorEmbed('An error occurred while executing this command.');
            await message.reply({ embeds: [errorEmbed] });
        }
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => onGuildMemberUpdate(client, oldMember, newMember));
client.on('messageReactionAdd', (reaction, user) => onMessageReactionAdd(client, reaction as any, user as any));
client.on('voiceStateUpdate', (oldState, newState) => onVoiceStateUpdate(client, oldState, newState));

client.on('interactionCreate', async (interaction) => {
    // 1. Handle Chat Input Commands (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);

        if (command) {
            // Check permissions
            if (interaction.inGuild() && command.data.default_member_permissions) {
                const member = interaction.member as any;
                const requiredPerms = BigInt(command.data.default_member_permissions);

                if (!member.permissions.has(requiredPerms)) {
                    return;
                }
            }

            try {
                await command.execute(interaction, services);
            } catch (error: any) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
            }
        } else {
            // If not in 'commands' collection, try Raw ModMail handler
            await onInteractionCreate(client, interaction);
        }
        return;
    }

    // 2. Handle Other Interactions (Buttons, Modals, etc.)

    // Run Raw ModMail handler first (handles specific customIds)
    await onInteractionCreate(client, interaction);

    // Run Beru logic (Ticket System Router)
    if (interaction.isButton() || interaction.isStringSelectMenu() ||
        interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {

        try {
            // Ignore interactions handled locally by commands (collectors)
            // Also ignore if onInteractionCreate might have handled it (hard to know without return value, but they check specific IDs)
            if ('customId' in interaction &&
                (interaction.customId.startsWith('help_category_') ||
                    interaction.customId.startsWith('steal_'))) {
                return;
            }

            await router.route(interaction, client as any);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Interaction handler');
        }
    }
});

// Beru specific events
client.on('guildCreate', async guild => {
    try {
        await inviteService.cacheGuildInvites(guild);
        console.log(`✔ Cached invites for new guild: ${guild.name}`);
    } catch (error) {
        console.error(`Failed to cache invites for guild ${guild.id}:`, error);
    }
});

client.on('inviteCreate', async invite => {
    try {
        if (invite.guild && 'invites' in invite.guild) {
            await inviteService.updateInviteCache(invite.guild);
        }
    } catch (error) {
        console.error('Failed to update invite cache on create:', error);
    }
});

client.on('inviteDelete', async invite => {
    try {
        if (invite.guild && 'invites' in invite.guild) {
            await inviteService.updateInviteCache(invite.guild);
        }
    } catch (error) {
        console.error('Failed to update invite cache on delete:', error);
    }
});

client.on('guildBanAdd', async ban => {
    await serverStatsCommand.updateServerStats(ban.guild).catch(console.error);
});

client.on('guildBanRemove', async ban => {
    await serverStatsCommand.updateServerStats(ban.guild).catch(console.error);
});

client.on('guildMemberAdd', async member => {
    try {
        const db = DatabaseManager.getInstance();
        const config = await db.getWelcomeConfig(member.guild.id);

        // Track invite info using InviteService
        let inviterInfo = '';
        let inviteData = {
            inviterId: null as string | null,
            inviterTag: null as string | null,
            inviteCode: null as string | null,
            joinType: 'unknown' as 'invite' | 'vanity' | 'unknown' | 'oauth'
        };

        try {
            const newInvites = await member.guild.invites.fetch();
            inviteData = await inviteService.findUsedInvite(member.guild.id, newInvites);
            await inviteService.updateInviteCache(member.guild);

            if (member.user.bot) {
                inviterInfo = `${member} has been added as an **Integration** 🤖.`;
            } else if (inviteData.joinType === 'invite' && inviteData.inviterId && inviteData.inviterTag) {
                const totalInvites = await inviteService.incrementInvites(member.guild.id, inviteData.inviterId);
                inviterInfo = `${member} has been invited by **${inviteData.inviterTag}** who now has **${totalInvites}** invite${totalInvites !== 1 ? 's' : ''}.`;
            } else if (inviteData.joinType === 'vanity') {
                inviterInfo = `${member} has joined **${member.guild.name}** via **vanity URL**.`;
            } else {
                inviterInfo = `${member} has been invited via **unknown link**.`;
            }

            await inviteService.storeMemberJoin(
                member.guild.id,
                member.id,
                inviteData.inviterId,
                inviteData.inviterTag,
                inviteData.inviteCode,
                inviteData.joinType
            );
        } catch (inviteError: any) {
            if (inviteError.code === 50013) {
                console.warn(`⚠️ Missing permissions to track invites in guild ${member.guild.name} (${member.guild.id})`);
            } else {
                console.error('Error tracking invite:', inviteError);
            }
            inviterInfo = `${member} has been invited via **unknown link**.`;
        }

        if (config.welcomeChannelId && config.welcomeEnabled) {
            const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (welcomeChannel && welcomeChannel.isTextBased()) {
                const message = config.message || inviterInfo;
                await welcomeChannel.send(message.replace(/{user}/g, member.toString()).replace(/{server}/g, member.guild.name));
            }
        }

        await serverStatsCommand.updateServerStats(member.guild).catch(console.error);
    } catch (error) {
        console.error('Error handling member join:', error);
    }
});

client.on('guildMemberRemove', async member => {
    try {
        const db = DatabaseManager.getInstance();
        const config = await db.getWelcomeConfig(member.guild.id);

        if (config.leaveChannelId && config.leaveEnabled) {
            const leaveChannel = member.guild.channels.cache.get(config.leaveChannelId);
            if (leaveChannel && leaveChannel.isTextBased()) {
                const joinInfo = await inviteService.getMemberJoinData(member.guild.id, member.id);
                let leaveMessage = '';

                if (member.user.bot) {
                    let action = 'left';
                    try {
                        const auditLogs = await member.guild.fetchAuditLogs({ limit: 5 });
                        const entry = auditLogs.entries.find(e => e.targetId === member.id && (e.action === 20 || e.action === 22));
                        if (entry) {
                            if (entry.action === 20) action = 'was kicked';
                            if (entry.action === 22) action = 'was banned';
                            if (Date.now() - entry.createdTimestamp > 30000) action = 'left';
                        }
                    } catch (e) {
                        console.error('Failed to fetch audit logs for bot leave:', e);
                    }
                    leaveMessage = `${member.user.tag} ${action} the server.`;
                } else if (joinInfo) {
                    if (joinInfo.joinType === 'invite' && joinInfo.inviterId && joinInfo.inviterTag) {
                        try {
                            const totalInvites = await inviteService.decrementInvites(member.guild.id, joinInfo.inviterId);
                            leaveMessage = `${member.user.tag} left the server. They were invited by **${joinInfo.inviterTag}** who now has **${totalInvites}** invite${totalInvites !== 1 ? 's' : ''}.`;
                        } catch (error) {
                            leaveMessage = `${member.user.tag} left the server. They were invited by **${joinInfo.inviterTag}**.`;
                        }
                    } else if (joinInfo.joinType === 'vanity') {
                        leaveMessage = `${member.user.tag} left the server. They joined using **vanity URL**.`;
                    } else {
                        leaveMessage = `${member.user.tag} left the server. They joined using **unknown link**.`;
                    }
                    await inviteService.deleteMemberJoinData(member.guild.id, member.id);
                } else {
                    leaveMessage = `${member.user.tag} left the server. They joined using **unknown link**.`;
                }

                const finalMessage = config.leaveMessage || leaveMessage;
                await leaveChannel.send(finalMessage.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name));
            }
        }

        await serverStatsCommand.updateServerStats(member.guild).catch(console.error);
    } catch (error) {
        console.error('Error handling member leave:', error);
    }
});

client.login(CONFIG.BOT_TOKEN);
