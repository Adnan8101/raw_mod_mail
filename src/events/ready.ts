import { Client } from 'discord.js';
import { connectDB } from '../database/connect';
import { registerCommands } from '../utils/commands';
export const onReady = async (client: Client) => {
    console.log(`✅ Logged in as ${client.user?.tag}!`);
    await connectDB();
    await registerCommands(client);
    client.user?.setActivity('Watching you Rawshikaaa', { type: 4 }); 
};
