# feedback_bot

Telegram bot for end users of the ticketing platform. The bot registers users by phone number, sends feedback to a backend API, shows the latest feedback statuses, and delivers broadcast messages.

## Current Architecture

This repository is a Telegram client over HTTP API. It does not connect to PostgreSQL directly.

```text
Telegram user
   |
   v
feedback_bot (this repo)
   |
   v
BotFeedback HTTP API
   |
   v
backend + database
```

## What The Bot Does

- registers a user from a Telegram contact;
- shows a callback-driven inline UI inside the chat;
- creates a new feedback entry through backend API;
- shows the last 10 feedbacks with statuses;
- checks backend API availability;
- sends startup update notifications;
- sends broadcast messages to all known users.

## Stack

- Node.js 18
- TypeScript
- Telegraf
- Axios
- Docker / Docker Compose

## Project Structure

```text
src/
  api/
    BotFeedbackApi.ts
  bot/
    BotService.ts
    FeedbackHandler.ts
    logger.ts
  errors/
    AppError.ts
  i18n/
    en.ts
  config.ts
  index.ts

tests/
  feedback-handler.test.js
```

## Environment Variables

See [.env.example](./.env.example).

Required:

- `BOT_TOKEN`

Optional:

- `API_BASE_URL` default: `http://adminpanel-back:8080/api/BotFeedback`
- `SEQ_URL` default: disabled
- `UPDATES_FILE_PATH` default: `./updates.txt`
- `BROADCAST_INTERVAL_MS` default: `60000`

## Local Run

```bash
npm install
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Tests

```bash
npm test
```

The test suite currently covers the main `FeedbackHandler` interaction flow.

## Docker

Build and start:

```bash
docker compose up -d --build feedback-bot
```

The image uses a multi-stage Docker build:

- build stage installs dev dependencies and compiles TypeScript;
- runtime stage contains only production dependencies and compiled output.

## Notes

- The bot UI texts are centralized in [src/i18n/en.ts](./src/i18n/en.ts).
- Backend API and Telegram API errors are normalized in [src/errors/AppError.ts](./src/errors/AppError.ts).
- Generated files such as `dist/` and local `node_modules/` should not be committed.
