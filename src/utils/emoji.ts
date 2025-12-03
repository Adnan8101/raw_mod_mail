/**
 * Custom Emoji Definitions
 */

export const CustomEmojis = {
  TICK: '<:tcet_tick:1437995479567962184>',
  CROSS: '<:tcet_cross:1437995480754946178>',
  STAFF: '<:xieron_staffs:1437995300164730931>',
  ADMIN: '<:Admin:1437996801964900526>',
  FILES: '<:module:1437997093753983038>',
  USER: '<:Usero:1437841583918682246>',
  LOGGING: '<:k9logging:1437996243803705354>',
  SETTING: '<:pb_utils:1437999137919340546>',
  CHANNEL: '<:zicons_newschannel:1437846918318526536>',
  CAUTION: '<:caution:1437997212008185866>',
} as const;

/**
 * Replace static emojis with custom ones in text
 */
export function replaceEmojis(text: string): string {
  return text
    .replace(/<:tcet_tick:1437995479567962184>|:white_check_mark:/g, CustomEmojis.TICK)
    .replace(/❌|:x:/g, CustomEmojis.CROSS);
}
