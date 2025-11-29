import { REST, Routes, SlashCommandBuilder, Client } from 'discord.js';
import { CONFIG } from '../config';

export const registerCommands = async (client: Client) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('clear-my-dm')
            .setDescription('Clears all messages sent by the bot in your DM.')
    ];

    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
};
