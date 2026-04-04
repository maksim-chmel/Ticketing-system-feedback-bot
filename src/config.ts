export interface AppConfig {
    botToken: string;
    apiBaseUrl: string;
    seqUrl?: string;
    updatesFilePath: string;
    broadcastIntervalMs: number;
}

const DEFAULT_API_BASE_URL = 'http://adminpanel-back:8080/api/BotFeedback';
const DEFAULT_UPDATES_FILE_PATH = './updates.txt';
const DEFAULT_BROADCAST_INTERVAL_MS = 60_000;

function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value?.trim()) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): AppConfig {
    return {
        botToken: requireEnv('BOT_TOKEN'),
        apiBaseUrl: process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
        seqUrl: process.env.SEQ_URL?.trim() || undefined,
        updatesFilePath: process.env.UPDATES_FILE_PATH?.trim() || DEFAULT_UPDATES_FILE_PATH,
        broadcastIntervalMs: parsePositiveInt(
            process.env.BROADCAST_INTERVAL_MS,
            DEFAULT_BROADCAST_INTERVAL_MS
        )
    };
}
