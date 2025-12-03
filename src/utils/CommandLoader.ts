import { Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';

export interface Command {
    data: any;
    execute: (interaction: any, services: any) => Promise<void>;
    prefixCommand?: {
        name: string;
        description: string;
        aliases: string[];
        usage: string;
        category: string;
    };
    [key: string]: any;
}

export class CommandLoader {
    public commands: Collection<string, Command>;
    public aliases: Collection<string, string>;

    constructor() {
        this.commands = new Collection();
        this.aliases = new Collection();
    }

    public async loadCommands(commandsPath: string): Promise<void> {
        this.commands.clear();
        this.aliases.clear();

        const absolutePath = path.resolve(commandsPath);
        if (!fs.existsSync(absolutePath)) {
            console.warn(`[CommandLoader] Commands directory not found: ${absolutePath}`);
            return;
        }

        await this.readCommands(absolutePath);
        console.log(`[CommandLoader] Loaded ${this.commands.size} commands.`);
    }

    private async readCommands(dir: string): Promise<void> {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                await this.readCommands(filePath);
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    // Delete from cache to ensure fresh reload if needed
                    delete require.cache[require.resolve(filePath)];

                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const commandModule = require(filePath);

                    // Handle both default export and named exports
                    const command = commandModule.default || commandModule;

                    // Check if it's a valid command
                    if (command?.data?.name) {
                        this.commands.set(command.data.name, command);

                        // Handle aliases for prefix commands
                        if (command.prefixCommand?.aliases) {
                            for (const alias of command.prefixCommand.aliases) {
                                this.aliases.set(alias, command.data.name);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`[CommandLoader] Error loading command from ${filePath}:`, error);
                }
            }
        }
    }

    public getCommand(name: string): Command | undefined {
        return this.commands.get(name);
    }

    public getCommandByAlias(alias: string): Command | undefined {
        const commandName = this.aliases.get(alias);
        if (commandName) {
            return this.commands.get(commandName);
        }
        return undefined;
    }

    public getAllCommands(): Command[] {
        return Array.from(this.commands.values());
    }
}
