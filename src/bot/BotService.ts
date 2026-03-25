import fs from 'fs/promises';
import TelegramBot from 'node-telegram-bot-api';
import { Database } from '../db/Database';
import { FeedbackHandler } from './FeedbackHandler';

const WAITING_CONTACT = 0;
const FEEDBACK = 1;

export class BotService {
    private bot: TelegramBot;
    private db: Database;
    private feedbackHandler: FeedbackHandler;

    constructor(db: Database) {
        const token = process.env.BOT_TOKEN!;
        this.bot = new TelegramBot(token, { polling: true });
        this.db = db;
        this.feedbackHandler = new FeedbackHandler(this.bot, this.db);
    }

    
    async broadcastLoop() {
        const messages = await this.db.getAllActiveBroadcastMessages(); 

        if (messages.length === 0) return;

        const userIds = await this.db.getAllUserIds();

        for (const message of messages) {
            for (const userId of userIds) {
                try {
                    await this.bot.sendMessage(userId, `📢 ${message.Message}`);
                } catch (err) {
                    console.error(`Error sending message to user ${userId}:`, err);
                }
            }
            await this.db.deleteBroadcastMessageById(message.Id);
        }
    }

    async init() {

        this.bot.onText(/\/start/, async (msg) => {
            try {
                await this.feedbackHandler.handleStart(msg);
            } catch (e) {
                console.error('Error in handleStart:', e);
            }
        });

        this.bot.on('contact', async (msg) => {
            try {
                await this.feedbackHandler.handleContact(msg);
            } catch (e) {
                console.error('Error in handleContact:', e);
            }
        });

        this.bot.on('message', async (msg) => {
            try {
                if (!msg.text) return;

                if (msg.text.startsWith('/')) return;

                await this.feedbackHandler.handleMessage(msg);
            } catch (e) {
                console.error('Error in handleMessage:', e);
            }
        });

        let updatesText = '';
        try {
            updatesText = await fs.readFile('./updates.txt', 'utf-8');
        } catch (err) {
            console.error('Error reading updates.txt file:', err);
            updatesText = 'No updates available.';
        }

        const startMessage = `🤖 The bot has been updated!\n\n📢 Update list:\n${updatesText}\n\nPlease press the /start button below to continue.`;

        const startKeyboard = {
            reply_markup: {
                keyboard: [[{ text: '/start' }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        };

        const allUserIds = await this.db.getAllUserIds();

        for (const userId of allUserIds) {
            try {
                await this.bot.sendMessage(userId, startMessage, startKeyboard);
            } catch (err) {
                console.error(`Error sending update to user ${userId}:`, err);
            }
        }

       
        setInterval(() => {
            this.broadcastLoop().catch(console.error);
        }, 60_000);
    }
}