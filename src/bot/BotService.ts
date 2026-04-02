import fs from 'fs/promises';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { FeedbackHandler } from './FeedbackHandler';
import { log } from './logger';

export class BotService {
    private readonly bot: Telegraf;
    private feedbackHandler: FeedbackHandler;
    private readonly API_BASE = 'http://adminpanel-back:8080/api/BotFeedback';

    constructor() {
        this.bot = new Telegraf(process.env.BOT_TOKEN!);
        this.feedbackHandler = new FeedbackHandler();
    }

    private async getAllUserIds(): Promise<number[]> {
        try {
            const { data } = await axios.get(`${this.API_BASE}/all-users`);
            return data;
        } catch (e: any) {
            log('Error', 'Failed to fetch user IDs: {Msg}', { Msg: e.message });
            return [];
        }
    }

    async broadcastLoop() {
        const { data: messages } = await axios.get(`${this.API_BASE}/broadcast-messages`);
        if (!messages?.length) return;

        const userIds = await this.getAllUserIds();
        for (const msg of messages) {
            for (const id of userIds) {
                try {
                    await this.bot.telegram.sendMessage(id, `📢 ${msg.message}`);
                } catch { /* log fail */ }
            }
        }
    }

    async init() {
        
        this.bot.use(async (ctx, next) => {
            const start = Date.now();
            await next();
            log('Information', 'Update {Type} from {User} processed in {MS}ms', {
                Type: ctx.updateType,
                User: ctx.from?.username || ctx.from?.id,
                MS: Date.now() - start
            });
        });

        this.bot.start(ctx => this.feedbackHandler.handleStart(ctx));
        this.bot.on('contact', ctx => this.feedbackHandler.handleContact(ctx));
        this.bot.on('text', (ctx, next) => {
            if (ctx.message.text.startsWith('/')) return next();
            return this.feedbackHandler.handleMessage(ctx);
        });

        
        this.sendUpdateNotification().catch(e => log('Error', 'Update notify failed'));

        await this.bot.launch();

        setInterval(() => this.broadcastLoop(), 60000);

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    private async sendUpdateNotification() {
        const text = await fs.readFile('./updates.txt', 'utf-8').catch(() => 'New fixes!');
        const ids = await this.getAllUserIds();
        for (const id of ids) {
            await this.bot.telegram.sendMessage(id, `🤖 Bot Updated!\n\n${text}`,
                Markup.keyboard([['/start']]).resize().oneTime()
            ).catch(() => {});
        }
    }
}