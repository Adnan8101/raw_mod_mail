import { REST, Routes, SlashCommandBuilder, Client } from 'discord.js';
import { CONFIG } from '../config';
import { data as gtnData } from '../commands/Games/Guess the Number/gtn';
import { data as memoryData } from '../commands/Games/Memory Game/memory';
import { data as mathData } from '../commands/Games/Math Game/math';
import { data as hiddenData } from '../commands/Games/Hidden Number/hidden';
import { stealCommand } from '../commands/Utility/steal';
import { restrictCommand } from '../commands/Name Prevention/restrict';
import { data as equationData } from '../commands/Games/Emoji Equation/equation';
import { recorderCommand } from '../commands/recording/recorder';
import { data as vowelsData } from '../commands/Games/vowels/vowels';
import { data as sequenceData } from '../commands/Games/sequence/sequence';
import { data as reverseData } from '../commands/Games/reverse/reverse';
import { data as evalData } from '../commands/owner/eval';
import { data as dcData } from '../commands/Voice/dc';

export const registerCommands = async (client: Client) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('clear-my-dm')
            .setDescription('Clears all messages sent by the bot in your DM.'),
        gtnData,
        memoryData,
        mathData,
        hiddenData,
        stealCommand,
        restrictCommand,
        equationData,
        recorderCommand,
        vowelsData,
        sequenceData,
        reverseData,
        evalData,
        dcData
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
