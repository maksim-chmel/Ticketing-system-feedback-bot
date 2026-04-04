import dotenv from 'dotenv';
import { BotService } from './bot/BotService';
import { log } from "./bot/logger";
import { loadConfig } from './config';
import { BotFeedbackApi } from './api/BotFeedbackApi';
import { AppError, getErrorLogProps } from './errors/AppError';

dotenv.config({ quiet: true });

async function main() {
    try {
        const config = loadConfig();
        const api = new BotFeedbackApi(config.apiBaseUrl);
        const botService = new BotService(config, api);

       
        await botService.init();

        
        log('Information', 'Telegram Bot Service started', {
            Status: 'Running'
        });

    } catch (error: unknown) {
        const details = error instanceof AppError
            ? getErrorLogProps(error)
            : {
                Error: error instanceof Error ? error.message : String(error),
                Stack: error instanceof Error ? error.stack : undefined
            };

        log('Fatal', 'Startup failed', details);

        
        setTimeout(() => process.exit(1), 1000);
    }
}

main();
