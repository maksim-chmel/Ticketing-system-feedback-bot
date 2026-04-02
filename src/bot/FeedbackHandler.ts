import { Context, Markup } from 'telegraf';
import axios from 'axios';

const FEEDBACK_STATUSES: Record<number, string> = {
    0: "🟢 Open", 1: "🟡 In Progress", 2: "🟠 Pending Response", 3: "🔵 Closed", 4: "🔴 Rejected"
};

const WAITING_CONTACT = 0;
const FEEDBACK = 1;
const WAITING_FEEDBACK_TEXT = 2;

export class FeedbackHandler {
    private userStates: Map<number, number>;
    private readonly API_BASE = 'http://adminpanel-back:8080/api/BotFeedback';

    constructor() {
        this.userStates = new Map();
    }

    private mainMenuKeyboard() {
        return Markup.keyboard([
            ['📡 Service Status'],
            ['📋 My Feedbacks'],
            ['➕ Create New Feedback']
        ]).resize();
    }

    private cancelFeedbackKeyboard() {
        return Markup.keyboard([['❌ Cancel']]).resize();
    }

    async handleStart(ctx: Context): Promise<void> {
        const userId = ctx.from!.id;
        try {
            const response = await axios.get(`${this.API_BASE}/exists/${userId}`);
            const userExists = response.data;
            this.userStates.set(userId, userExists ? FEEDBACK : WAITING_CONTACT);

            if (userExists) {
                await ctx.reply("👋 Welcome back!", this.mainMenuKeyboard());
            } else {
                await ctx.reply("👋 Hello! Please share your phone number to register.",
                    Markup.keyboard([[Markup.button.contactRequest("📞 Share Phone Number")]])
                        .resize().oneTime()
                );
            }
        } catch (error) {
            await ctx.reply("⚠️ Connection error. Please try again later.");
        }
    }

    async handleContact(ctx: Context): Promise<void> {
        const userId = ctx.from!.id;
        const message = ctx.message as any;
        const contact = message?.contact;

        if (!contact) {
            await ctx.reply("❗ Please use the button provided.");
            return;
        }

        try {
            await axios.post(`${this.API_BASE}/register-new-User`, {
                userId,
                phoneNumber: contact.phone_number,
                firstName: ctx.from!.first_name,
                lastName: ctx.from!.last_name ?? '',
                username: ctx.from!.username ?? ''
            });
            this.userStates.set(userId, FEEDBACK);
            await ctx.reply("✅ Registration successful!", this.mainMenuKeyboard());
        } catch (error) {
            await ctx.reply("❌ Registration failed.");
        }
    }

    async handleMessage(ctx: Context): Promise<void> {
        const userId = ctx.from!.id;
        const message = ctx.message as any;
        const text = message?.text ?? '';

        if (!this.userStates.has(userId)) return this.handleStart(ctx);
        const state = this.userStates.get(userId);

        if (state === WAITING_CONTACT) {
            return void await ctx.reply("❗ Please register first.");
        }

        if (state === WAITING_FEEDBACK_TEXT) {
            if (text === "❌ Cancel") {
                this.userStates.set(userId, FEEDBACK);
                return void await ctx.reply("❌ Cancelled.", this.mainMenuKeyboard());
            }
            try {
                await axios.post(`${this.API_BASE}/new-feedback`, {
                    userId,
                    username: ctx.from?.username || 'unknown',
                    comment: text
                });
                await ctx.reply(`✅ Feedback sent!`, this.mainMenuKeyboard());
                this.userStates.set(userId, FEEDBACK);
            } catch {
                await ctx.reply("❌ Error saving feedback.");
            }
            return;
        }

        switch (text) {
            case "➕ Create New Feedback":
                await ctx.reply("📝 Please describe your issue:", this.cancelFeedbackKeyboard());
                this.userStates.set(userId, WAITING_FEEDBACK_TEXT);
                break;
            case "📋 My Feedbacks":
                await this.showUserFeedbacks(ctx, userId);
                break;
            case "📡 Service Status":
                try {
                    await axios.get(`${this.API_BASE}/exists/${userId}`);
                    await ctx.replyWithMarkdown("✅ *System Online*");
                } catch {
                    await ctx.replyWithMarkdown("⚠️ *API Offline*");
                }
                break;
            default:
                await ctx.reply("❓ Please choose an option:", this.mainMenuKeyboard());
        }
    }

    private async showUserFeedbacks(ctx: Context, userId: number) {
        try {
            const { data: feedbacks } = await axios.get(`${this.API_BASE}/user-feedbacks/${userId}`);
            if (!feedbacks?.length) return await ctx.reply("📭 No feedbacks found.");

            const list = feedbacks.map((fb: any) => {
                const date = new Date(fb.date || fb.createdDate).toLocaleString('en-GB');
                const status = FEEDBACK_STATUSES[fb.status] || "❓ Unknown";
                return `📋 *Feedback #${fb.id}*\n💬 ${fb.comment}\nStatus: ${status}\n📅 ${date}`;
            }).join("\n\n---\n\n");
            await ctx.replyWithMarkdown(list);
        } catch {
            await ctx.reply("❌ Error retrieving feedbacks.");
        }
    }
}