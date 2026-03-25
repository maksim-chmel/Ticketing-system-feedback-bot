import fs from 'fs/promises';
import TelegramBot from 'node-telegram-bot-api';
import { FeedbackHandler } from './FeedbackHandler';
import axios from 'axios';

export class BotService {
    private bot: TelegramBot;
    private feedbackHandler: FeedbackHandler;
    private readonly API_BASE = 'http://adminpanel-back:8080/api/BotFeedback';

    constructor() {
        const token = process.env.BOT_TOKEN!;
        this.bot = new TelegramBot(token, { polling: true });
        this.feedbackHandler = new FeedbackHandler(this.bot);
    }

    private async getAllUserIds(): Promise<number[]> {
        try {
            const response = await axios.get(`${this.API_BASE}/all-users`);
            return response.data;
        } catch (error: any) {
            console.error('Error fetching user IDs:', error.message);
            return [];
        }
    }

    async broadcastLoop() {
        try {
            const response = await axios.get(`${this.API_BASE}/broadcast-messages`);
            const messages = response.data;

            if (!messages || messages.length === 0) return;

            const userIds = await this.getAllUserIds();

            for (const message of messages) {
                for (const userId of userIds) {
                    try {
                        await this.bot.sendMessage(userId, `📢 ${message.message}`);
                    } catch (err) {
                        console.error(`Failed to send broadcast to user ${userId}`);
                    }
                }
            }
        } catch (error: any) {
            console.error('Broadcast loop error:', error.message);
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
                if (!msg.text || msg.text.startsWith('/')) return;
                await this.feedbackHandler.handleMessage(msg);
            } catch (e) {
                console.error('Error in handleMessage:', e);
            }
        });

        try {
            const updatesText = await fs.readFile('./updates.txt', 'utf-8').catch(() => 'No updates available.');
            const startMessage = `🤖 The bot has been updated!\n\n📢 Update list:\n${updatesText}\n\nPlease press the /start button below to continue.`;

            const allUserIds = await this.getAllUserIds();

            for (const userId of allUserIds) {
                try {
                    await this.bot.sendMessage(userId, startMessage, {
                        reply_markup: {
                            keyboard: [[{ text: '/start' }]],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                } catch (err) {
                    console.error(`Error sending update to user ${userId}:`, err);
                }
            }
        } catch (err) {
            console.error('Initial notification error:', err);
        }

        setInterval(() => {
            this.broadcastLoop().catch(console.error);
        }, 60000);
    }
}