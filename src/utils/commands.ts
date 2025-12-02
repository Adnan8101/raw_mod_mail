import { REST, Routes, SlashCommandBuilder, Client } from 'discord.js';
import { CONFIG } from '../config';
import { guessTheNumberCommands } from '../commands/Guess the Number/gtn';
import { memoryCommands } from '../commands/Memory Game/memory';
import { mathCommands } from '../commands/Math Game/math';
import { hiddenNumberCommands } from '../commands/Hidden Number/hidden';
import { setPrefixCommand } from '../commands/Moderation/setprefix';
import { stealCommand } from '../commands/Moderation/steal';
import { restrictCommand } from '../commands/Name Prevention/restrict';
import { equationCommand } from '../commands/Emoji Equation/equation';
import { recorderCommand } from '../commands/recording/recorder';
import { vowelsCommands } from '../commands/vowels/vowels';
import { sequenceCommands } from '../commands/sequence/sequence';
import { reverseCommands } from '../commands/reverse/reverse';
import { evalCommand } from '../commands/owner/eval';

export const registerCommands = async (client: Client) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('clear-my-dm')
            .setDescription('Clears all messages sent by the bot in your DM.'),
        ...guessTheNumberCommands,
        ...memoryCommands,
        ...mathCommands,
        ...hiddenNumberCommands,
        setPrefixCommand,
        stealCommand,
        restrictCommand,
        equationCommand,
        recorderCommand,
        ...vowelsCommands,
        ...sequenceCommands,
        ...reverseCommands,
        evalCommand
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
