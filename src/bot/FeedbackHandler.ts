import TelegramBot, { Message, ReplyKeyboardMarkup, Contact } from 'node-telegram-bot-api';
import { Database } from '../db/Database';

const FEEDBACK_STATUSES: Record<number, string> = {
    0: "🟢 Открыта",
    1: "🟡 В обработке",
    2: "🟠 Ожидает ответа",
    3: "🔵 Закрыта",
    4: "🔴 Отклонена"
};

const WAITING_CONTACT = 0;
const FEEDBACK = 1;
const WAITING_FEEDBACK_TEXT = 2;

export class FeedbackHandler {
    private bot: TelegramBot;
    private db: Database;
    private userStates: Map<number, number>;

    constructor(bot: TelegramBot, db: Database) {
        this.bot = bot;
        this.db = db;
        this.userStates = new Map();
    }

    private mainMenuKeyboard(): ReplyKeyboardMarkup {
        return {
            keyboard: [
                [{ text: "📡 Проверить состояние сервиса" }],
                [{ text: "📋 Статус заявок" }],
                [{ text: "➕ Создать заявку" }]
            ],
            resize_keyboard: true
        };
    }

    private cancelFeedbackKeyboard(): ReplyKeyboardMarkup {
        return {
            keyboard: [
                [{ text: "❌ Отмена" }]
            ],
            resize_keyboard: true
        };
    }

    async handleStart(msg: Message): Promise<void> {
        const userId = msg.from!.id;
        const userExists = await this.db.userExists(userId);
        this.userStates.set(userId, userExists ? FEEDBACK : WAITING_CONTACT);
        if (userExists) {
            await this.bot.sendMessage(userId, "👋 С возвращением!", {
                reply_markup: this.mainMenuKeyboard()
            });
        } else {
            await this.bot.sendMessage(userId, "👋 Привет! Отправьте номер телефона.", {
                reply_markup: {
                    keyboard: [[{ text: "📞 Отправить номер телефона", request_contact: true }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    }

    async handleContact(msg: Message): Promise<void> {
        const userId = msg.from!.id;
        const contact: Contact | undefined = msg.contact;
        if (!contact) {
            await this.bot.sendMessage(userId, "❗ Пожалуйста используйте кнопку");
            this.userStates.set(userId, WAITING_CONTACT);
            return;
        }
        await this.db.saveUser(
            userId,
            contact.phone_number,
            msg.from!.first_name ?? '',
            msg.from!.last_name ?? '',
            msg.from!.username ?? ''
        );
        this.userStates.set(userId, FEEDBACK);
        await this.bot.sendMessage(userId, "✅ Вы зарегистрированы!", {
            reply_markup: this.mainMenuKeyboard()
        });
    }

    async handleMessage(msg: Message): Promise<void> {
        const userId = msg.from!.id;
        const text = msg.text ?? '';

        if (!this.userStates.has(userId)) {
            await this.handleStart(msg);
            return;
        }

        const state = this.userStates.get(userId);

        if (state === WAITING_CONTACT) {
            await this.bot.sendMessage(userId, "❗ Пожалуйста используйте кнопку");
            return;
        }

        if (state === WAITING_FEEDBACK_TEXT) {
            if (text === "❌ Отмена") {
                this.userStates.set(userId, FEEDBACK);
                await this.bot.sendMessage(userId, "❌ Создание заявки отменено.", {
                    reply_markup: this.mainMenuKeyboard()
                });
                return;
            }
            // Пользователь прислал текст заявки
            const feedbackId = await this.db.saveFeedback(userId, text);
            if (feedbackId) {
                await this.bot.sendMessage(userId, `✅ Заявка принята. ID: *${feedbackId}*`, {
                    parse_mode: 'Markdown',
                    reply_markup: this.mainMenuKeyboard()
                });
                this.userStates.set(userId, FEEDBACK);
            } else {
                await this.bot.sendMessage(userId, "❌ Ошибка при сохранении заявки.", {
                    reply_markup: this.mainMenuKeyboard()
                });
            }
            return;
        }

        // Основное меню
        switch (text) {
            case "➕ Создать заявку":
                await this.bot.sendMessage(userId, "📝 Пожалуйста, напишите текст вашей заявки:", {
                    reply_markup: this.cancelFeedbackKeyboard()
                });
                this.userStates.set(userId, WAITING_FEEDBACK_TEXT);
                return;

            case "🔄 Перезапустить":
                await this.handleStart(msg);
                return;

            case "📡 Проверить состояние сервиса":
                try {
                    await this.db.getAllUserIds();
                    await this.bot.sendMessage(userId, "✅ *Сервис онлайн*\n\n🟢 Сервис работает\n🟢 База доступна", {
                        parse_mode: 'Markdown',
                        reply_markup: this.mainMenuKeyboard()
                    });
                } catch {
                    await this.bot.sendMessage(userId, "⚠️ *Есть проблемы с сервисом*\n\n🟢 Сервис работает\n🔴 БД не доступна", {
                        parse_mode: 'Markdown',
                        reply_markup: this.mainMenuKeyboard()
                    });
                }
                return;

            case "📋 Статус заявок":
                const feedbacks = await this.db.getUserFeedbacks(userId);

                if (feedbacks.length === 0) {
                    await this.bot.sendMessage(userId, "📭 У вас нет заявок.", {
                        reply_markup: this.mainMenuKeyboard()
                    });
                } else {
                    const messages = feedbacks.map(fb => {
                        const created = new Intl.DateTimeFormat('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }).format(new Date(fb.CreatedDate));

                        const status = FEEDBACK_STATUSES[fb.Status as keyof typeof FEEDBACK_STATUSES] ?? "Неизвестно";

                        return `📋 *Ваша заявка #${fb.Id}*\n\n✍️ ${fb.Comment}\n${status} *Статус:*\n🕓 *Создана:* ${created}`;
                    });

                    const fullMessage = messages.join("\n\n");

                    await this.bot.sendMessage(userId, fullMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: this.mainMenuKeyboard()
                    });
                }
                return;

            default:
                await this.bot.sendMessage(userId, "❓ Неизвестная команда. Пожалуйста, выберите пункт меню.", {
                    reply_markup: this.mainMenuKeyboard()
                });
                return;
        }
    }
}