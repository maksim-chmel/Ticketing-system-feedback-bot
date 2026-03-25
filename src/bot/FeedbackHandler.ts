import TelegramBot, { Message, ReplyKeyboardMarkup, Contact } from 'node-telegram-bot-api';
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
                [{ text: "📡 Check Service Status" }],
                [{ text: "📋 Feedback Status" }],
                [{ text: "➕ Create Feedback" }]
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
        } catch (error: any) {
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
        } catch (error: any) {
            await this.bot.sendMessage(userId, "❌ Registration failed on the server.");
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
                await this.bot.sendMessage(userId, "❌ Cancelled.", {
                    reply_markup: this.mainMenuKeyboard()
                });
                return;
            }

            try {
                await axios.post(`${this.API_BASE}/new-feedback`, {
                    userId: userId,
                    username: msg.from?.username || 'unknown',
                    comment: text
                });

                await this.bot.sendMessage(userId, `✅ Feedback received!`, {
                    reply_markup: this.mainMenuKeyboard()
                });
                this.userStates.set(userId, FEEDBACK);
            } catch (error: any) {
                await this.bot.sendMessage(userId, "❌ Error saving feedback.");
            }
            return;
        }

        switch (text) {
            case "➕ Create Feedback":
                await this.bot.sendMessage(userId, "📝 Describe your issue:", {
                    reply_markup: this.cancelFeedbackKeyboard()
                });
                this.userStates.set(userId, WAITING_FEEDBACK_TEXT);
                return;

            case "📋 Feedback Status":
                try {
                    const response = await axios.get(`${this.API_BASE}/user-feedbacks/${userId}`);
                    const feedbacks = response.data;

                    if (!feedbacks || feedbacks.length === 0) {
                        await this.bot.sendMessage(userId, "📭 No feedbacks found.");
                    } else {
                        const messages = feedbacks.map((fb: any) => {
                            const date = new Date(fb.createdDate).toLocaleString('en-US');
                            const status = FEEDBACK_STATUSES[fb.status] ?? "❓ Unknown";
                            return `📋 *Feedback #${fb.id}*\n\n💬 ${fb.comment}\nStatus: ${status}\n📅 ${date}`;
                        });
                        await this.bot.sendMessage(userId, messages.join("\n\n"), { parse_mode: 'Markdown' });
                    }
                } catch (error: any) {
                    await this.bot.sendMessage(userId, "❌ Could not retrieve status.");
                }
                return;

            case "📡 Check Service Status":
                try {
                    await axios.get(`${this.API_BASE}/exists/${userId}`);
                    await this.bot.sendMessage(userId, "✅ *System Online*", { parse_mode: 'Markdown' });
                } catch {
                    await this.bot.sendMessage(userId, "⚠️ *API Offline*");
                }
                return;

            default:
                await this.bot.sendMessage(userId, "❓ Choose an option:", { reply_markup: this.mainMenuKeyboard() });
                return;
        }
    }
}