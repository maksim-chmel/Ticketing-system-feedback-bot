import dotenv from 'dotenv';
dotenv.config();

import { BotService } from './bot/BotService';
import { Database } from './db/Database';

async function main() {
    const db = new Database();
    await db.connect();

    const botService = new BotService(db);
    await botService.init();
}

main();