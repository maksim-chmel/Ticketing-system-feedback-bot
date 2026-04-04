const test = require('node:test');
const assert = require('node:assert/strict');

const { FeedbackHandler } = require('../dist/bot/FeedbackHandler.js');

function createContext({ userId = 1, firstName = 'Max', username = 'maksim' } = {}) {
    const calls = {
        reply: [],
        editMessageText: [],
        answerCbQuery: 0
    };

    const ctx = {
        from: {
            id: userId,
            first_name: firstName,
            username
        },
        reply: async (text, extra) => {
            calls.reply.push({ text, extra });
        },
        editMessageText: async (text, extra) => {
            calls.editMessageText.push({ text, extra });
        },
        answerCbQuery: async () => {
            calls.answerCbQuery += 1;
        }
    };

    return { ctx, calls };
}

test('handleStart renders registration screen for a new user', async () => {
    const api = {
        userExists: async () => false
    };

    const handler = new FeedbackHandler(api);
    const { ctx, calls } = createContext();

    await handler.handleStart(ctx);

    assert.equal(calls.reply.length, 1);
    assert.match(calls.reply[0].text, /register/i);
    assert.match(calls.reply[0].text, /phone number/i);
});

test('handleStart renders home screen for an existing user', async () => {
    const api = {
        userExists: async () => true
    };

    const handler = new FeedbackHandler(api);
    const { ctx, calls } = createContext();

    await handler.handleStart(ctx);

    assert.equal(calls.reply.length, 1);
    assert.match(calls.reply[0].text, /What would you like to do/i);
    assert.match(calls.reply[0].text, /Create a new feedback/i);
});

test('feedback flow sends new feedback and returns to home screen', async () => {
    const createFeedbackCalls = [];
    const api = {
        userExists: async () => true,
        createFeedback: async (payload) => {
            createFeedbackCalls.push(payload);
        }
    };

    const handler = new FeedbackHandler(api);
    const { ctx, calls } = createContext();

    await handler.handleStart(ctx);
    ctx.callbackQuery = { data: 'create_feedback', message: {} };
    await handler.handleAction(ctx);

    ctx.message = { text: 'The order form does not open' };
    delete ctx.callbackQuery;
    await handler.handleMessage(ctx);

    assert.equal(createFeedbackCalls.length, 1);
    assert.equal(createFeedbackCalls[0].comment, 'The order form does not open');
    assert.match(calls.reply[calls.reply.length - 1].text, /Feedback sent/i);
});

test('service status action edits existing bot message', async () => {
    const api = {
        userExists: async () => true
    };

    const handler = new FeedbackHandler(api);
    const { ctx, calls } = createContext();

    await handler.handleStart(ctx);
    ctx.callbackQuery = { data: 'service_status', message: {} };
    await handler.handleAction(ctx);

    assert.equal(calls.answerCbQuery, 1);
    assert.equal(calls.editMessageText.length, 1);
    assert.match(calls.editMessageText[0].text, /API is available/i);
});
