import { Client } from 'discord.js';
import { connectDB } from '../database/connect';

export const onReady = async (client: Client) => {
    console.log(`✅ Logged in as ${client.user?.tag}!`);

    // Connect to Database
    await connectDB();

    // Set Activity
    client.user?.setActivity('DMs for Verification', { type: 4 }); // Custom status or similar
};
