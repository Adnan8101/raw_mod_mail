import { EmbedBuilder, ColorResolvable } from 'discord.js';

/**
 * Custom icons for consistent branding across all embeds
 */
export const ICONS = {
    TICK: '<:tcet_tick:1437995479567962184>',
    CROSS: '<:tcet_cross:1437995480754946178>',
    STAFF: '<:xieron_staffs:1437995300164730931>',
    ADMIN: '<:Admin:1437996801964900526>',
    FILES: '<:module:1437997093753983038>',
    USER: '<:Usero:1437841583918682246>',
    LOGGING: '<:k9logging:1437996243803705354>',
    SETTINGS: '<:pb_utils:1437999137919340546>',
    CHANNEL: '<:zicons_newschannel:1437846918318526536>',
    CAUTION: '<:caution:1437997212008185866>',
} as const;

/**
 * Standard colors for different message types
 */
export const COLORS = {
    SUCCESS: '#00ff00' as ColorResolvable,
    ERROR: '#ff0000' as ColorResolvable,
    WARNING: '#ffff00' as ColorResolvable,
    INFO: '#0099ff' as ColorResolvable,
    PENDING: '#ffaa00' as ColorResolvable,
} as const;

/**
 * Creates a success embed with tick icon
 */
export function createSuccessEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(`${ICONS.TICK} ${description}`)
        .setColor(COLORS.SUCCESS);
}

/**
 * Creates an error embed with cross icon
 */
export function createErrorEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(`${ICONS.CROSS} ${description}`)
        .setColor(COLORS.ERROR);
}

/**
 * Creates a warning embed with caution icon
 */
export function createWarningEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(`${ICONS.CAUTION} ${description}`)
        .setColor(COLORS.WARNING);
}

/**
 * Creates an info embed
 */
export function createInfoEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(description)
        .setColor(COLORS.INFO);
}

/**
 * Creates a pending/processing embed
 */
export function createPendingEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(description)
        .setColor(COLORS.PENDING);
}

/**
 * Creates a custom embed with specified icon and color
 */
export function createCustomEmbed(icon: string, description: string, color: ColorResolvable): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(`${icon} ${description}`)
        .setColor(color);
}
