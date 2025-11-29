import { Client } from 'discord.js';
import { connectDB } from '../database/connect';
import { registerCommands } from '../utils/commands';

export const onReady = async (client: Client) => {
    console.log(`✅ Logged in as ${client.user?.tag}!`);

    // Connect to Database
    await connectDB();

    // Register Commands
    await registerCommands(client);

    // Set Activity
    client.user?.setActivity('DMs for Verification', { type: 4 }); // Custom status or similar
};
