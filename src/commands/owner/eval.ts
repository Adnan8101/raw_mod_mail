import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, ComponentType } from 'discord.js';
import { evaluateCode, createEvalEmbed, OWNER_ID } from './evalHelper';

export const category = 'owner';

export const evalCommand = new SlashCommandBuilder()
    .setName('eval')
    .setDescription('Evaluate code (Owner Only)')
    .addStringOption(option =>
        option.setName('code')
            .setDescription('The code to evaluate')
            .setRequired(true));

export const data = evalCommand;

export const execute = async (interaction: ChatInputCommandInteraction, services: any) => {
    await handleEvalCommand(interaction);
}

export const handleEvalCommand = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.commandName !== 'eval') return;

    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: 'No permission.', flags: MessageFlags.Ephemeral });
        return;
    }

    const code = interaction.options.getString('code', true);

    // Evaluate
    const result = await evaluateCode(code, {
        client: interaction.client,
        interaction: interaction
    });

    const { embed, row } = createEvalEmbed(result);

    const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
        fetchReply: true
    });

    // Handle delete button
    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 600000 // 10 minutes
    });

    collector.on('collect', async i => {
        if (i.customId === 'delete_eval') {
            await i.deferUpdate(); // Acknowledge
            await interaction.deleteReply();
            collector.stop();
        }
    });
};
