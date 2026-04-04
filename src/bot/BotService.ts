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
            log('Information', 'Broadcast poll started');

            const messages = await this.api.getBroadcastMessages();
            log('Information', 'Broadcast poll fetched messages', {
                Count: messages.length
            });

            if (!messages.length) {
                log('Information', 'Broadcast poll finished with no messages');
                return;
            }

            const userIds = await this.api.getAllUserIds();
            log('Information', 'Broadcast poll fetched users', {
                Count: userIds.length
            });

            for (const msg of messages) {
                await this.broadcastMessage(msg, userIds);
            }

            log('Information', 'Broadcast poll finished', {
                MessageCount: messages.length,
                UserCount: userIds.length
            });
        } catch (error) {
            const normalized = normalizeBackendError(error, 'broadcastLoop');
            log('Error', 'Broadcast loop failed', getErrorLogProps(normalized));
        }
    }

    async init() {
        log('Information', 'Bot initialization started');

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

        log('Information', 'Broadcast scheduler started', {
            IntervalMs: this.config.broadcastIntervalMs
        });

        this.broadcastLoop().catch(error => {
            const normalized = normalizeBackendError(error, 'initialBroadcastLoop');
            log('Error', 'Initial broadcast loop failed', getErrorLogProps(normalized));
        });

        this.broadcastTimer = setInterval(() => {
            this.broadcastLoop().catch(error => {
                const normalized = normalizeBackendError(error, 'scheduledBroadcastLoop');
                log('Error', 'Scheduled broadcast loop failed', getErrorLogProps(normalized));
            });
        }, this.config.broadcastIntervalMs);

        log('Information', 'Launching Telegram bot');
        await this.bot.launch();
        log('Information', 'Telegram bot launch completed');

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
        let deliveredCount = 0;

        log('Information', 'Broadcast delivery started', {
            UserCount: userIds.length,
            Preview: message.message.slice(0, 80)
        });

        for (const id of userIds) {
            try {
                await this.bot.telegram.sendMessage(id, `📢 ${message.message}`);
                deliveredCount += 1;
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

        log('Information', 'Broadcast delivery finished', {
            UserCount: userIds.length,
            DeliveredCount: deliveredCount,
            Preview: message.message.slice(0, 80)
        });
    }

    private shutdown(signal: 'SIGINT' | 'SIGTERM') {
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
        }

        this.bot.stop(signal);
    }
}
