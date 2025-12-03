
import { Client, TextChannel, EmbedBuilder, User, GuildMember } from 'discord.js';
import { DatabaseManager } from '../utils/DatabaseManager';
import { CONFIG } from '../config';

export class GiveawayManager {
    private static instance: GiveawayManager;
    private client: Client;
    private db: DatabaseManager;

    private constructor(client: Client) {
        this.client = client;
        this.db = DatabaseManager.getInstance();
    }

    public static getInstance(client: Client): GiveawayManager {
        if (!GiveawayManager.instance) {
            GiveawayManager.instance = new GiveawayManager(client);
        }
        return GiveawayManager.instance;
    }

    private isChecking = false;

    async startTicker() {
        setInterval(async () => {
            await this.checkGiveaways();
        }, 500); // Check every 0.5 seconds
    }

    async checkGiveaways() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            const giveaways = await this.db.getActiveGiveaways();
            const now = new Date();

            for (const giveaway of giveaways) {
                if (giveaway.endTime <= now) {
                    await this.endGiveaway(giveaway.messageId);
                }
            }
        } catch (error) {
            console.error('Error checking giveaways:', error);
        } finally {
            this.isChecking = false;
        }
    }

    async endGiveaway(messageId: string, reroll = false): Promise<string[]> {
        const giveaway = await this.db.getGiveaway(messageId);
        if (!giveaway) return [];

        if (!reroll && giveaway.ended) return []; // Already ended

        const channel = await this.client.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel;
        if (!channel) {
            // Channel deleted, just mark as ended
            await this.db.endGiveaway(messageId);
            return [];
        }

        let message;
        try {
            message = await channel.messages.fetch(messageId);
        } catch (e) {
            // Message deleted
            await this.db.endGiveaway(messageId);
            return [];
        }

        // Get reaction users
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) {
            await this.db.endGiveaway(messageId);
            await channel.send(`Giveaway for **${giveaway.prize}** ended, but no one entered!`);
            return [];
        }

        let users = await reaction.users.fetch();
        users = users.filter(u => !u.bot);

        // Filter valid participants
        const validUsers: User[] = [];
        const guild = channel.guild;

        for (const user of users.values()) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) continue;

            if (await this.checkRequirements(giveaway, member)) {
                validUsers.push(user);
                // Add to participants if not already
                await this.db.addGiveawayParticipant(giveaway.id, user.id);
            }
        }

        if (validUsers.length === 0) {
            await this.db.endGiveaway(messageId);
            await channel.send(`Giveaway for **${giveaway.prize}** ended, but no valid entries found!`);
            return [];
        }

        // Pick winners
        const winnersCount = reroll ? 1 : giveaway.winnersCount;
        const winners: User[] = [];

        // Simple random pick
        const shuffled = validUsers.sort(() => 0.5 - Math.random());
        for (let i = 0; i < Math.min(winnersCount, shuffled.length); i++) {
            winners.push(shuffled[i]);
        }

        // Update DB
        if (!reroll) {
            await this.db.endGiveaway(messageId);
        }

        for (const winner of winners) {
            await this.db.addGiveawayWinner(giveaway.id, winner.id);
        }

        // Announce
        const winnersString = winners.map(w => w.toString()).join(', ');

        const endEmbed = EmbedBuilder.from(message.embeds[0]);
        endEmbed.setColor('#2f3136');
        endEmbed.setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnersString}\n**Hosted By:** <@${giveaway.hostId}>`);
        endEmbed.setFooter({ text: `Giveaway Ended • Total Participants: ${validUsers.length}` });
        endEmbed.setTimestamp(new Date());

        await message.edit({ embeds: [endEmbed] });

        // Winner Message with Button
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Giveaway Link')
                    .setStyle(ButtonStyle.Link)
                    .setURL(message.url)
            );

        await message.reply({
            content: `Congratulations ${winnersString}! You won **${giveaway.prize}**!\nHosted By: <@${giveaway.hostId}>`,
            components: [row]
        });

        // Assign Role
        if (giveaway.assignRole) {
            for (const winner of winners) {
                const member = await guild.members.fetch(winner.id).catch(() => null);
                if (member) {
                    await member.roles.add(giveaway.assignRole).catch(e => console.error(`Failed to assign role to winner ${winner.id}:`, e));
                }
            }
        }

        return winners.map(w => w.id);
    }

    async checkRequirements(giveaway: any, member: GuildMember): Promise<boolean> {
        // Role Requirement
        if (giveaway.roleRequirement && !member.roles.cache.has(giveaway.roleRequirement)) {
            return false;
        }

        // Account Age
        if (giveaway.accountAgeRequirement) {
            const created = member.user.createdTimestamp;
            const diff = Date.now() - created;
            const days = diff / (1000 * 60 * 60 * 24);
            if (days < giveaway.accountAgeRequirement) return false;
        }

        // Server Age
        if (giveaway.serverAgeRequirement && member.joinedTimestamp) {
            const joined = member.joinedTimestamp;
            const diff = Date.now() - joined;
            const days = diff / (1000 * 60 * 60 * 24);
            if (days < giveaway.serverAgeRequirement) return false;
        }

        // Invite Requirement
        if (giveaway.inviteRequirement) {
            const invites = await this.db.getUserInviteCount(member.guild.id, member.id);
            if (invites < giveaway.inviteRequirement) return false;
        }

        // Message Requirement
        if (giveaway.messageRequirement) {
            const stats = await this.db.getUserStats(member.guild.id, member.id);
            if (!stats || stats.messageCount < giveaway.messageRequirement) return false;
        }

        // Voice Requirement
        if (giveaway.voiceRequirement) {
            const stats = await this.db.getUserStats(member.guild.id, member.id);
            if (!stats || stats.voiceMinutes < giveaway.voiceRequirement) return false;
        }

        return true;
    }

    async reroll(messageId: string): Promise<string[]> {
        return this.endGiveaway(messageId, true);
    }
}
