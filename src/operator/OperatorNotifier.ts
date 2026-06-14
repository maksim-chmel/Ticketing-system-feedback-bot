import { Telegraf } from 'telegraf';
import { log } from '../bot/logger';
import { normalizeTelegramError, getErrorLogProps } from '../errors/AppError';

export class OperatorNotifier {
    constructor(
        private readonly bot: Telegraf,
        private readonly chatId: number,
        private readonly threadId?: number
    ) {}

    async send(text: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(this.chatId, text, {
                message_thread_id: this.threadId
            });
        } catch (error) {
            const normalized = normalizeTelegramError(error, 'OperatorNotifier.send');
            log('Error', 'Failed to send operator notification', getErrorLogProps(normalized));
        }
    }
}
