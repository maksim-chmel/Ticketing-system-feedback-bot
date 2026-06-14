# feedback_bot [![FeedbackBot CI/CD](https://github.com/maksim-chmel/Ticketing-system-feedback-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/maksim-chmel/Ticketing-system-feedback-bot/actions/workflows/deploy.yml)

Telegram bot for the ticketing platform. Serves two audiences from a single process: end users who submit and track feedback, and operators who receive real-time alerts.

## What The Bot Does

**For users:**
- registers by phone number (one-time);
- creates feedback entries via the backend API;
- shows the last 10 feedbacks with statuses;
- checks backend API availability;
- receives broadcast messages from the admin panel;
- receives a startup update notification when the bot is redeployed.

**For operators** (requires `OPERATOR_CHAT_ID`):
- sends an instant alert to the operator chat when any new feedback arrives (via SignalR push — catches submissions from all sources, not just the bot);
- forwards a copy of every broadcast message to the operator chat.

## Architecture

```text
Telegram user                     Operator chat
     |                                 ^
     v                                 |
feedback_bot  <--SignalR push--  AdminPanelBack
     |                                 |
     +--------HTTP API--------------> +
                                       |
                                   database
```

## Project Structure

```text
src/
  api/
    BotFeedbackApi.ts       HTTP client for the backend API
  bot/
    BotService.ts           bot init, broadcast loop, /id command
    FeedbackHandler.ts      user-facing conversation logic
    logger.ts               console + Seq structured logging
  errors/
    AppError.ts             unified error model
  i18n/
    en.ts                   all user-facing strings
  operator/
    FeedbackAlarmHub.ts     SignalR listener → operator notifications
    OperatorNotifier.ts     sends messages to the operator chat
  config.ts
  index.ts

tests/
  feedback-handler.test.js
```

## Environment Variables

Required:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token |
| `API_KEY` | API key used for backend auth: sent as `X-Api-Key` header on REST requests and as `access_token` query param on the SignalR hub connection |

Optional — operator notifications:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPERATOR_CHAT_ID` | — | Chat ID to send operator alerts. If unset, operator notifications are disabled |
| `THREAD_ID` | — | Message thread ID inside a supergroup |
| `HUB_BASE_URL` | `http://adminpanel-back:8080` | Base URL of the SignalR hub |

Optional — general:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://adminpanel-back:8080/api` | Backend API base URL |
| `BROADCAST_INTERVAL_MS` | `60000` | How often to poll for broadcast messages (ms) |
| `SEQ_URL` | — | Seq structured log ingestion URL |
| `UPDATES_FILE_PATH` | `./updates.txt` | Path to the update notification text file |

To find your `OPERATOR_CHAT_ID` and `THREAD_ID`, send `/id` to the bot from the target chat or thread.

## Local Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

## Docker

```bash
docker compose up -d --build
```

Prerequisites:

- External network (create once):

```bash
docker network create feedback_shared_network
```

- The backend service (`adminpanel-back`) must be on the same `feedback_shared_network`, or override `API_BASE_URL` and `HUB_BASE_URL`.

To persist the update notification file across container rebuilds, add a bind mount in `docker-compose.yml`:

```yaml
volumes:
  - ./updates.txt:/app/updates.txt
```
