// src/bot/BotService.ts
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

    async init() {
        // Обработчики команд и сообщений
        this.bot.onText(/\/start/, async (msg) => {
            try {
                await this.feedbackHandler.handleStart(msg);
            } catch (e) {
                console.error('Ошибка в handleStart:', e);
            }
        });

        this.bot.on('contact', async (msg) => {
            try {
                await this.feedbackHandler.handleContact(msg);
            } catch (e) {
                console.error('Ошибка в handleContact:', e);
            }
        });

        this.bot.on('message', async (msg) => {
            try {
                if (!msg.text) return;

                if (msg.text.startsWith('/')) return;

                await this.feedbackHandler.handleMessage(msg);
            } catch (e) {
                console.error('Ошибка в handleMessage:', e);
            }
        });

        // Читаем файл с обновлениями
        let updatesText = '';
        try {
            updatesText = await fs.readFile('./updates.txt', 'utf-8');
        } catch (err) {
            console.error('Ошибка чтения файла updates.txt:', err);
            updatesText = 'Обновления отсутствуют.';
        }

        // Формируем сообщение для пользователей
        const startMessage = `🤖 Бот был обновлен!\n\n📢 Список обновлений:\n${updatesText}\n\nПожалуйста, нажмите кнопку /start ниже, чтобы продолжить работу.`;

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
                console.error(`Ошибка отправки обновления пользователю ${userId}:`, err);
            }
        }
    }
}