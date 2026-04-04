import fs from 'fs/promises';
import { Telegraf, Markup } from 'telegraf';
import { FeedbackHandler } from './FeedbackHandler';
import { log } from './logger';
import { AppConfig } from '../config';
import { BotFeedbackApi, BroadcastMessageDto } from '../api/BotFeedbackApi';
import { getErrorLogProps, normalizeBackendError, normalizeTelegramError } from '../errors/AppError';
import { en } from '../i18n/en';

export class BotService {
    private readonly bot: Telegraf;
    private readonly feedbackHandler: FeedbackHandler;
    private broadcastTimer?: NodeJS.Timeout;

    constructor(
        private readonly config: AppConfig,
        private readonly api: BotFeedbackApi
    ) {
        this.bot = new Telegraf(config.botToken);
        this.feedbackHandler = new FeedbackHandler(api);
    }

    async broadcastLoop() {
        try {
            const messages = await this.api.getBroadcastMessages();
            if (!messages.length) {
                return;
            }

            const userIds = await this.api.getAllUserIds();
            for (const msg of messages) {
                await this.broadcastMessage(msg, userIds);
            }
        } catch (error) {
            const normalized = normalizeBackendError(error, 'broadcastLoop');
            log('Error', 'Broadcast loop failed', getErrorLogProps(normalized));
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
        this.bot.command('help', ctx => this.feedbackHandler.handleHelp(ctx));
        this.bot.action(/.+/, ctx => this.feedbackHandler.handleAction(ctx));
        this.bot.on('contact', ctx => this.feedbackHandler.handleContact(ctx));
        this.bot.on('text', (ctx, next) => {
            if (ctx.message.text.startsWith('/')) return next();
            return this.feedbackHandler.handleMessage(ctx);
        });

        this.sendUpdateNotification().catch(error => {
            const normalized = normalizeBackendError(error, 'sendUpdateNotification');
            log('Error', 'Update notification failed', getErrorLogProps(normalized));
        });

        await this.bot.launch();

        this.broadcastTimer = setInterval(() => {
            this.broadcastLoop().catch(error => {
                const normalized = normalizeBackendError(error, 'scheduledBroadcastLoop');
                log('Error', 'Scheduled broadcast loop failed', getErrorLogProps(normalized));
            });
        }, this.config.broadcastIntervalMs);

        process.once('SIGINT', () => this.shutdown('SIGINT'));
        process.once('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    private async sendUpdateNotification() {
        const text = await fs.readFile(this.config.updatesFilePath, 'utf-8').catch(() => 'There are new updates.');
        const ids = await this.api.getAllUserIds().catch((error: unknown): number[] => {
            const normalized = normalizeBackendError(error, 'sendUpdateNotification.getAllUserIds');
            log('Error', 'Failed to fetch users for update notification', getErrorLogProps(normalized));
            return [];
        });

        for (const id of ids) {
            try {
                await this.bot.telegram.sendMessage(
                    id,
                    en.messages.updateNotification(text),
                    Markup.keyboard([['/start']]).resize().oneTime()
                );
            } catch (error) {
                const normalized = normalizeTelegramError(error, 'sendUpdateNotification.sendMessage');
                if (!normalized.expected) {
                    log('Warning', 'Failed to send update notification', {
                        UserId: id,
                        ...getErrorLogProps(normalized)
                    });
                }
            }
        }
    }

    private async broadcastMessage(message: BroadcastMessageDto, userIds: number[]) {
        for (const id of userIds) {
            try {
                await this.bot.telegram.sendMessage(id, `📢 ${message.message}`);
            } catch (error) {
                const normalized = normalizeTelegramError(error, 'broadcastMessage.sendMessage');
                if (!normalized.expected) {
                    log('Warning', 'Failed to deliver broadcast', {
                        UserId: id,
                        ...getErrorLogProps(normalized)
                    });
                }
            }
        }
    }

    private shutdown(signal: 'SIGINT' | 'SIGTERM') {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
        }

        this.bot.stop(signal);
    }
}
