import { GuessTheNumberManager } from './manager';
import { Client } from 'discord.js';

let instance: GuessTheNumberManager | null = null;

export const getGameManager = (client: Client): GuessTheNumberManager => {
    if (!instance) {
        instance = new GuessTheNumberManager(client);
    }
    return instance;
};
