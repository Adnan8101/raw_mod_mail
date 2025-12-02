import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageComponentInteraction } from 'discord.js';
import { inspect } from 'util';

export const OWNER_ID = '929297205796417597';

export interface EvalResult {
    input: string;
    output: string;
    type: string;
    time: number;
    isError: boolean;
}

export const evaluateCode = async (code: string, context: any): Promise<EvalResult> => {
    const start = process.hrtime();
    let output;
    let isError = false;
    let type;

    try {
        // Expose context variables to eval
        const { client, message, interaction } = context;

        // Evaluate
        if (code.includes('await')) {
            output = await eval(`(async () => { ${code} })()`);
        } else {
            output = await eval(code);
        }
        type = typeof output;

        // Inspect output
        if (typeof output !== 'string') {
            output = inspect(output, { depth: 0 });
        }
    } catch (error: any) {
        isError = true;
        output = error.toString();
        type = 'error';
    }

    const stop = process.hrtime(start);
    const time = (stop[0] * 1e9 + stop[1]) / 1e6; // in ms

    return {
        input: code,
        output: output,
        type: type,
        time: time,
        isError: isError
    };
};

export const createEvalEmbed = (result: EvalResult) => {
    const embed = new EmbedBuilder()
        .setColor(result.isError ? '#ff0000' : '#00ff00')
        .addFields(
            { name: '📥 Input', value: `\`\`\`js\n${result.input.substring(0, 1000)}\n\`\`\`` },
            { name: '📤 Output', value: `\`\`\`js\n${result.output.substring(0, 1000)}\n\`\`\`` },
            { name: 'Time', value: `${result.time.toFixed(4)}ms`, inline: true },
        );

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('delete_eval')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

    return { embed, row };
};
