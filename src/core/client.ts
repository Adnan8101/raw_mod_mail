import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import PostgresDB from './db/postgresDB';

export interface BotClient extends Client {
  db: PostgresDB;
  commands: Collection<string, any>;
}

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.User,
      Partials.GuildMember,
    ],
  }) as BotClient;

  // Initialize PostgreSQL cloud database
  client.db = new PostgresDB();
  
  // Initialize commands collection
  client.commands = new Collection();

  return client;
}
