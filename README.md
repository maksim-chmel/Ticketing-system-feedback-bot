# feedback_bot [![FeedbackBot CI/CD](https://github.com/maksim-chmel/Ticketing-system-feedback-bot/actions/workflows/deploy.yml/badge.svg)](https://github.com/maksim-chmel/Ticketing-system-feedback-bot/actions/workflows/deploy.yml)

Telegram bot for collecting and tracking user feedback. Serves two audiences from a single process: end users who submit and track feedback, and operators who receive real-time alerts.

## What The Bot Does

**For users:**
- registers by phone number (one-time);
- creates feedback entries;
- shows the last 10 feedbacks with statuses (🟢 Open, 🟡 In Progress, 🟠 Waiting, 🔵 Closed, 🔴 Rejected);
- checks service availability;
- shows a help screen via `/help` or the Help button;
- receives broadcast messages;
- receives a startup update notification when the bot is redeployed.

**For operators** (requires `OPERATOR_CHAT_ID`):
- sends an instant alert to the operator chat when any new feedback arrives;
- forwards a copy of every broadcast message to the operator chat.

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
| `API_KEY` | API key for backend auth |

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
| `BROADCAST_INTERVAL_MS` | `60000` | How often to poll for broadcast messages (ms). The first poll also runs immediately on startup |
| `SEQ_URL` | — | Seq structured log ingestion URL |
| `UPDATES_FILE_PATH` | `./updates.txt` | Path to the update notification text file. Falls back to `"There are new updates."` if the file is missing |

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

The container runs with `TZ=Europe/Berlin`. This affects how timestamps are displayed in feedback notifications.

To persist the update notification file across container rebuilds, add a bind mount in `docker-compose.yml`:

```yaml
volumes:
  - ./updates.txt:/app/updates.txt
```
