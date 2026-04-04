import { Context, Markup } from 'telegraf';
import { BotFeedbackApi, FeedbackDto } from '../api/BotFeedbackApi';
import { AppError, getErrorLogProps, normalizeBackendError, normalizeTelegramError } from '../errors/AppError';
import { en } from '../i18n/en';
import { log } from './logger';

enum UserState {
    WaitingContact = 0,
    Idle = 1,
    WaitingFeedbackText = 2
}

enum CallbackAction {
    Home = 'home',
    CreateFeedback = 'create_feedback',
    MyFeedbacks = 'my_feedbacks',
    RefreshFeedbacks = 'refresh_feedbacks',
    ServiceStatus = 'service_status',
    RefreshServiceStatus = 'refresh_service_status',
    Help = 'help',
    CancelFeedback = 'cancel_feedback'
}

type BotContext = Context & {
    message?: {
        text?: string;
        contact?: {
            phone_number: string;
            user_id?: number;
        };
    };
    callbackQuery?: {
        data?: string;
        message?: unknown;
    };
};

export class FeedbackHandler {
    private readonly userStates: Map<number, UserState>;

    constructor(private readonly api: BotFeedbackApi) {
        this.userStates = new Map();
    }

    async handleStart(ctx: BotContext): Promise<void> {
        const userId = ctx.from!.id;

        try {
            const userExists = await this.api.userExists(userId);
            this.userStates.set(userId, userExists ? UserState.Idle : UserState.WaitingContact);

            if (userExists) {
                await this.renderHome(ctx, true);
            } else {
                await this.renderRegistration(ctx);
            }
        } catch (error) {
            await this.handleBackendFailure(ctx, error, 'handleStart', en.messages.connectionError);
        }
    }

    async handleHelp(ctx: BotContext): Promise<void> {
        const userId = ctx.from!.id;
        const state = this.userStates.get(userId);

        if (state === UserState.WaitingContact) {
            await this.renderRegistration(ctx);
            return;
        }

        this.userStates.set(userId, UserState.Idle);
        await this.renderHelp(ctx, false);
    }

    async handleContact(ctx: BotContext): Promise<void> {
        const userId = ctx.from!.id;
        const contact = ctx.message?.contact;

        if (!contact) {
            await ctx.reply(en.messages.registrationUseButton);
            return;
        }

        if (contact.user_id && contact.user_id !== userId) {
            await ctx.reply(en.messages.registrationOwnPhoneOnly);
            return;
        }

        try {
            await this.api.registerUser({
                userId,
                phoneNumber: contact.phone_number,
                firstName: ctx.from!.first_name,
                lastName: ctx.from!.last_name ?? '',
                username: ctx.from!.username ?? ''
            });

            this.userStates.set(userId, UserState.Idle);
            await this.safeReply(ctx, en.messages.registrationSuccess, Markup.removeKeyboard(), 'replyRegistrationSuccess');
            await this.renderHome(ctx, false);
        } catch (error) {
            await this.handleBackendFailure(ctx, error, 'handleContact', en.messages.registrationFailed);
        }
    }

    async handleMessage(ctx: BotContext): Promise<void> {
        const userId = ctx.from!.id;
        const text = ctx.message?.text?.trim() ?? '';

        if (!this.userStates.has(userId)) {
            await this.handleStart(ctx);
            return;
        }

        const state = this.userStates.get(userId);

        if (state === UserState.WaitingContact) {
            await this.renderRegistration(ctx);
            return;
        }

        if (state === UserState.WaitingFeedbackText) {
            if (!text || text === en.buttons.cancel) {
                this.userStates.set(userId, UserState.Idle);
                await this.renderHome(ctx, false, en.messages.feedbackCancelled);
                return;
            }

            try {
                await this.api.createFeedback({
                    userId,
                    username: ctx.from?.username || 'unknown',
                    comment: text
                });

                this.userStates.set(userId, UserState.Idle);
                await this.renderHome(ctx, false, en.messages.feedbackSent);
            } catch (error) {
                await this.handleBackendFailure(ctx, error, 'handleMessageCreateFeedback', en.messages.feedbackSaveFailed);
            }

            return;
        }

        await this.renderHome(ctx, false, en.messages.unknownInput);
    }

    async handleAction(ctx: BotContext): Promise<void> {
        const userId = ctx.from!.id;
        const action = ctx.callbackQuery?.data;

        await this.answerCallback(ctx);

        if (!this.userStates.has(userId)) {
            await this.handleStart(ctx);
            return;
        }

        if (this.userStates.get(userId) === UserState.WaitingContact) {
            await this.renderRegistration(ctx);
            return;
        }

        switch (action) {
            case CallbackAction.Home:
                this.userStates.set(userId, UserState.Idle);
                await this.renderHome(ctx, true);
                break;
            case CallbackAction.CreateFeedback:
                await this.openFeedbackComposer(ctx);
                break;
            case CallbackAction.MyFeedbacks:
            case CallbackAction.RefreshFeedbacks:
                await this.renderFeedbacks(ctx, true);
                break;
            case CallbackAction.ServiceStatus:
            case CallbackAction.RefreshServiceStatus:
                await this.renderServiceStatus(ctx, true);
                break;
            case CallbackAction.Help:
                this.userStates.set(userId, UserState.Idle);
                await this.renderHelp(ctx, true);
                break;
            case CallbackAction.CancelFeedback:
                this.userStates.set(userId, UserState.Idle);
                await this.renderHome(ctx, true, en.messages.feedbackCancelled);
                break;
            default:
                await this.renderHome(ctx, true);
                break;
        }
    }

    private async renderRegistration(ctx: BotContext) {
        this.userStates.set(ctx.from!.id, UserState.WaitingContact);

        await this.safeReply(
            ctx,
            en.messages.registration(ctx.from?.first_name ?? 'there'),
            Markup.keyboard([[Markup.button.contactRequest(en.buttons.sharePhone)]])
                .resize()
                .oneTime(),
            'renderRegistration'
        );
    }

    private async renderHome(ctx: BotContext, preferEdit: boolean, prefix?: string) {
        this.userStates.set(ctx.from!.id, UserState.Idle);
        await this.sendOrEdit(
            ctx,
            en.messages.home(ctx.from?.first_name ?? 'there', prefix),
            this.mainMenuKeyboard(),
            preferEdit,
            'renderHome'
        );
    }

    private async renderHelp(ctx: BotContext, preferEdit: boolean) {
        await this.sendOrEdit(
            ctx,
            en.messages.help,
            Markup.inlineKeyboard([
                [Markup.button.callback(en.buttons.backToHome, CallbackAction.Home)]
            ]),
            preferEdit,
            'renderHelp'
        );
    }

    private async openFeedbackComposer(ctx: BotContext) {
        this.userStates.set(ctx.from!.id, UserState.WaitingFeedbackText);

        await this.sendOrEdit(
            ctx,
            en.messages.feedbackComposer,
            Markup.inlineKeyboard([
                [Markup.button.callback(en.buttons.cancel, CallbackAction.CancelFeedback)]
            ]),
            true,
            'openFeedbackComposer'
        );
    }

    private async renderServiceStatus(ctx: BotContext, preferEdit: boolean) {
        let message = en.messages.serviceOnline;

        try {
            await this.api.userExists(ctx.from!.id);
        } catch (error) {
            const normalized = normalizeBackendError(error, 'renderServiceStatus');
            log('Warning', 'Service status check failed for {UserId}', {
                UserId: ctx.from!.id,
                ...getErrorLogProps(normalized)
            });
            message = en.messages.serviceOffline;
        }

        await this.sendOrEdit(
            ctx,
            message,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback(en.buttons.refresh, CallbackAction.RefreshServiceStatus),
                    Markup.button.callback(en.buttons.back, CallbackAction.Home)
                ]
            ]),
            preferEdit,
            'renderServiceStatus'
        );
    }

    private async renderFeedbacks(ctx: BotContext, preferEdit: boolean) {
        try {
            const feedbacks = await this.api.getUserFeedbacks(ctx.from!.id);
            const message = !feedbacks.length
                ? en.messages.noFeedbacks
                : [
                    en.messages.feedbacksTitle,
                    '',
                    ...feedbacks.slice(0, 10).map((fb: FeedbackDto) => this.formatFeedback(fb))
                ].join('\n\n');

            await this.sendOrEdit(
                ctx,
                message,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(en.buttons.refresh, CallbackAction.RefreshFeedbacks),
                        Markup.button.callback(en.buttons.back, CallbackAction.Home)
                    ]
                ]),
                preferEdit,
                'renderFeedbacks'
            );
        } catch (error) {
            const normalized = normalizeBackendError(error, 'renderFeedbacks');
            log('Error', 'Failed to load feedbacks for {UserId}', {
                UserId: ctx.from!.id,
                ...getErrorLogProps(normalized)
            });

            await this.sendOrEdit(
                ctx,
                en.messages.feedbackLoadFailed,
                Markup.inlineKeyboard([
                    [Markup.button.callback(en.buttons.back, CallbackAction.Home)]
                ]),
                preferEdit,
                'renderFeedbacksError'
            );
        }
    }

    private formatFeedback(feedback: FeedbackDto): string {
        const createdAt = feedback.date ?? feedback.createdDate;
        const formattedDate = createdAt
            ? new Date(createdAt).toLocaleString('en-GB')
            : en.messages.unknownDate;
        const status = en.statusLabels[feedback.status] || '❓ Unknown';

        return [
            `#${feedback.id}`,
            `Status: ${status}`,
            `Date: ${formattedDate}`,
            `Message: ${feedback.comment}`
        ].join('\n');
    }

    private mainMenuKeyboard() {
        return Markup.inlineKeyboard([
            [Markup.button.callback(en.buttons.createFeedback, CallbackAction.CreateFeedback)],
            [
                Markup.button.callback(en.buttons.myFeedbacks, CallbackAction.MyFeedbacks),
                Markup.button.callback(en.buttons.serviceStatus, CallbackAction.ServiceStatus)
            ],
            [Markup.button.callback(en.buttons.help, CallbackAction.Help)]
        ]);
    }

    private async sendOrEdit(
        ctx: BotContext,
        text: string,
        keyboard: ReturnType<typeof Markup.inlineKeyboard>,
        preferEdit: boolean,
        operation: string
    ) {
        const extra = { reply_markup: keyboard.reply_markup };

        if (preferEdit && ctx.callbackQuery?.message) {
            try {
                await ctx.editMessageText(text, extra);
                return;
            } catch (error) {
                const normalized = normalizeTelegramError(error, `${operation}.editMessageText`);
                if (!normalized.expected) {
                    log('Warning', 'Failed to edit Telegram message for {UserId}', {
                        UserId: ctx.from!.id,
                        ...getErrorLogProps(normalized)
                    });
                }
            }
        }

        await this.safeReply(ctx, text, extra, `${operation}.reply`);
    }

    private async safeReply(
        ctx: BotContext,
        text: string,
        extra: Parameters<BotContext['reply']>[1],
        operation: string
    ) {
        try {
            await ctx.reply(text, extra);
        } catch (error) {
            const normalized = normalizeTelegramError(error, operation);
            log('Error', 'Failed to send Telegram reply for {UserId}', {
                UserId: ctx.from!.id,
                ...getErrorLogProps(normalized)
            });
        }
    }

    private async handleBackendFailure(
        ctx: BotContext,
        error: unknown,
        operation: string,
        fallbackMessage: string
    ) {
        const normalized = normalizeBackendError(error, operation);
        log('Error', 'Backend operation failed for {UserId}', {
            UserId: ctx.from!.id,
            ...getErrorLogProps(normalized)
        });

        await this.safeReply(ctx, normalized.userMessage || fallbackMessage, undefined, `${operation}.backendFailureReply`);
    }

    private async answerCallback(ctx: BotContext) {
        if (!ctx.callbackQuery) {
            return;
        }

        try {
            await ctx.answerCbQuery();
        } catch (error) {
            const normalized = normalizeTelegramError(error, 'answerCallback');
            if (!normalized.expected) {
                log('Warning', 'Failed to answer callback query for {UserId}', {
                    UserId: ctx.from!.id,
                    ...getErrorLogProps(normalized)
                });
            }
        }
    }
}
