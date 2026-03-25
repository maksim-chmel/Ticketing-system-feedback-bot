import dotenv from 'dotenv';
import { BotService } from './bot/BotService';
dotenv.config();

async function main() {
    try {
        const botService = new BotService();
        await botService.init();
        console.log('BotService started');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1); 
    }
}
main();