import { Message, Contact, ReplyKeyboardMarkup } from 'node-telegram-bot-api';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const FEEDBACK_STATUSES: Record<number, string> = {
    0: "🟢 Open",
    1: "🟡 In Progress",
    2: "🟠 Pending Response",
    3: "🔵 Closed",
    4: "🔴 Rejected"
};

const WAITING_CONTACT = 0;
const FEEDBACK = 1;
const WAITING_FEEDBACK_TEXT = 2;

export class FeedbackHandler {
    private bot: TelegramBot;
    private userStates: Map<number, number>;
    private readonly API_BASE = 'http://adminpanel-back:8080/api/BotFeedback';

    constructor(bot: TelegramBot) {
        this.bot = bot;
        this.userStates = new Map();
    }

    private mainMenuKeyboard(): ReplyKeyboardMarkup {
        return {
            keyboard: [
                [{ text: "📡 Service Status" }],
                [{ text: "📋 My Feedbacks" }],
                [{ text: "➕ Create New Feedback" }]
            ],
            resize_keyboard: true
        };
    }

    private cancelFeedbackKeyboard(): ReplyKeyboardMarkup {
        return {
            keyboard: [[{ text: "❌ Cancel" }]],
            resize_keyboard: true
        };
    }

    async handleStart(msg: Message): Promise<void> {
        const userId = msg.from!.id;
        try {
            const response = await axios.get(`${this.API_BASE}/exists/${userId}`);
            const userExists = response.data;

            this.userStates.set(userId, userExists ? FEEDBACK : WAITING_CONTACT);

            if (userExists) {
                await this.bot.sendMessage(userId, "👋 Welcome back!", {
                    reply_markup: this.mainMenuKeyboard()
                });
            } else {
                await this.bot.sendMessage(userId, "👋 Hello! Please share your phone number to register.", {
                    reply_markup: {
                        keyboard: [[{ text: "📞 Share Phone Number", request_contact: true }]],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            }
        } catch (error) {
            await this.bot.sendMessage(userId, "⚠️ Connection error. Please try again later.");
        }
    }

    async handleContact(msg: Message): Promise<void> {
        const userId = msg.from!.id;
        const contact: Contact | undefined = msg.contact;

        if (!contact) {
            await this.bot.sendMessage(userId, "❗ Please use the button provided.");
            return;
        }

        try {
            await axios.post(`${this.API_BASE}/register-new-User`, {
                userId: userId,
                phoneNumber: contact.phone_number,
                firstName: msg.from!.first_name ?? '',
                lastName: msg.from!.last_name ?? '',
                username: msg.from!.username ?? ''
            });

            this.userStates.set(userId, FEEDBACK);
            await this.bot.sendMessage(userId, "✅ Registration successful!", {
                reply_markup: this.mainMenuKeyboard()
            });
        } catch (error) {
            await this.bot.sendMessage(userId, "❌ Registration failed.");
        }
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
            await this.bot.sendMessage(userId, "❗ Please register first.");
            return;
        }

        if (state === WAITING_FEEDBACK_TEXT) {
            if (text === "❌ Cancel") {
                this.userStates.set(userId, FEEDBACK);
                await this.bot.sendMessage(userId, "❌ Cancelled.", { reply_markup: this.mainMenuKeyboard() });
                return;
            }

            try {
                await axios.post(`${this.API_BASE}/new-feedback`, {
                    userId: userId,
                    username: msg.from?.username || 'unknown',
                    comment: text
                });

                await this.bot.sendMessage(userId, `✅ Feedback sent to operator!`, { reply_markup: this.mainMenuKeyboard() });
                this.userStates.set(userId, FEEDBACK);
            } catch (error) {
                await this.bot.sendMessage(userId, "❌ Error saving feedback.");
            }
            return;
        }

        switch (text) {
            case "➕ Create New Feedback":
                await this.bot.sendMessage(userId, "📝 Please describe your issue:", { reply_markup: this.cancelFeedbackKeyboard() });
                this.userStates.set(userId, WAITING_FEEDBACK_TEXT);
                return;

            case "📋 My Feedbacks":
                try {
                    const response = await axios.get(`${this.API_BASE}/user-feedbacks/${userId}`);
                    const feedbacks = response.data;

                    if (!feedbacks || feedbacks.length === 0) {
                        await this.bot.sendMessage(userId, "📭 You haven't sent any feedbacks yet.");
                    } else {
                        const messages = feedbacks.map((fb: any) => {
                            // Проверка полей в разных регистрах (Date vs createdDate)
                            const rawDate = fb.date || fb.Date || fb.createdDate || fb.CreatedDate;
                            const dateStr = (rawDate && !isNaN(Date.parse(rawDate)))
                                ? new Date(rawDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : 'Date N/A';

                            // Обращение к полям DTO (PascalCase)
                            const status = FEEDBACK_STATUSES[fb.status] || FEEDBACK_STATUSES[fb.Status] || "❓ Unknown";
                            const comment = fb.comment || fb.Comment || 'No content';
                            const id = fb.id || fb.Id;

                            return `📋 *Feedback #${id}*\n\n💬 ${comment}\nStatus: ${status}\n📅 ${dateStr}`;
                        });
                        await this.bot.sendMessage(userId, messages.join("\n\n---\n\n"), { parse_mode: 'Markdown' });
                    }
                } catch (error) {
                    await this.bot.sendMessage(userId, "❌ Could not retrieve status.");
                }
                return;

            case "📡 Service Status":
                try {
                    await axios.get(`${this.API_BASE}/exists/${userId}`);
                    await this.bot.sendMessage(userId, "✅ *System Online*", { parse_mode: 'Markdown' });
                } catch {
                    await this.bot.sendMessage(userId, "⚠️ *API Offline*");
                }
                return;

            default:
                await this.bot.sendMessage(userId, "❓ Please choose an option:", { reply_markup: this.mainMenuKeyboard() });
                return;
        }
    }
}