export interface GameState {
    channelId: string;
    targetNumber: number;
    min: number;
    max: number;
    originalMin: number;
    originalMax: number;
    startTime: number;
    guesses: number;
    players: Set<string>;
    winner?: {
        userId: string;
        username: string;
        guess: number;
    };
    closestGuess?: {
        userId: string;
        username: string;
        guess: number;
        diff: number;
        timestamp: number;
    };
    isActive: boolean;
    threadId?: string;
}

export interface GameConfig {
    slowmode?: number;
}
