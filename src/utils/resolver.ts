import { Guild, Role, VoiceBasedChannel, ChannelType } from 'discord.js';
import { prisma } from '../database/connect';

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function getBestMatch<T extends { name: string }>(input: string, items: T[]): T | null {
    const normalizedInput = input.toLowerCase().replace(/[^a-z0-9]/g, '');

    let bestMatch: T | null = null;
    let bestScore = Infinity;

    for (const item of items) {
        const normalizedItemName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedItemName === normalizedInput) {
            return item;
        }
        if (normalizedItemName.includes(normalizedInput)) {

            let score = normalizedItemName.length - normalizedInput.length;
            if (!normalizedItemName.startsWith(normalizedInput)) {
                score += 2; 
            }

            if (score < bestScore) {
                bestScore = score;
                bestMatch = item;
            }
            continue;
        }
        const distance = levenshteinDistance(normalizedInput, normalizedItemName);
        const maxLen = Math.max(normalizedInput.length, normalizedItemName.length);
        const similarity = 1 - distance / maxLen;

        // Threshold for fuzzy match (e.g., 70% similarity)
        if (similarity > 0.4 && distance < bestScore) {
        }
    }

    // If we found a "contains" match, return it.
    if (bestMatch) return bestMatch;

    // If not, try pure Levenshtein on all items
    bestScore = Infinity;
    for (const item of items) {
        const normalizedItemName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const distance = levenshteinDistance(normalizedInput, normalizedItemName);

        if (distance < bestScore) {
            bestScore = distance;
            bestMatch = item;
        }
    }

    // Only return if the match is reasonable (e.g. distance is less than half the length of the input)
    if (bestMatch && bestScore <= Math.max(3, input.length * 0.6)) {
        return bestMatch;
    }

    return null;
}

export async function resolveRole(input: string, guild: Guild): Promise<Role | null> {
    if (!input) return null;

    // 1. Check by ID or Mention
    const idMatch = input.match(/^<@&(\d+)>$/) || input.match(/^(\d+)$/);
    if (idMatch) {
        const role = guild.roles.cache.get(idMatch[1]);
        if (role) return role;
    }

    // 3. Check aliases (using Prisma)
    try {
        const lowerInput = input.toLowerCase();
        const aliasMatch = await prisma.roleAlias.findUnique({
            where: {
                guildId_alias: {
                    guildId: guild.id,
                    alias: lowerInput
                }
            }
        });
        if (aliasMatch) {
            const role = guild.roles.cache.get(aliasMatch.roleId);
            if (role) return role;
        }
    } catch (e) {
        console.error('Error resolving role alias:', e);
    }

    // 3. Fuzzy Match
    const roles = Array.from(guild.roles.cache.values());
    return getBestMatch(input, roles);
}

export async function resolveChannel(input: string, guild: Guild): Promise<VoiceBasedChannel | null> {
    if (!input) return null;

    // 1. Check by ID or Mention
    const idMatch = input.match(/^<#(\d+)>$/) || input.match(/^(\d+)$/);
    if (idMatch) {
        const channel = guild.channels.cache.get(idMatch[1]);
        if (channel && channel.isVoiceBased()) return channel;
    }

    // 2. Fuzzy Match
    const channels = Array.from(guild.channels.cache.values()).filter(c => c.isVoiceBased()) as VoiceBasedChannel[];
    return getBestMatch(input, channels);
}
