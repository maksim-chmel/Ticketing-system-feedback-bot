import dotenv from 'dotenv';
import { BotService } from './bot/BotService';
import { log } from "./bot/logger";

dotenv.config();

async function main() {
    try {
        const botService = new BotService();

       
        await botService.init();

        
        log('Information', 'Telegram Bot Service started', {
            Status: 'Running'
        });

    } catch (error: any) {
       
        log('Fatal', 'Startup failed: {Error}', {
            Error: error.message,
            Stack: error.stack
        });

        
        setTimeout(() => process.exit(1), 1000);
    }
}

main();