# Ticketing-system-feedback-bot

Telegram bot through which end users register and submit support tickets. Part of a four-component platform — see [System Overview](#system-overview) below.

---

## System Overview

This project is one of four components that form a complete ticketing platform:

| Repository | Technology | Role |
|---|---|---|
| [ticketing-system-server](https://github.com/maksim-chmel/Ticketing-system-server) | ASP.NET Core 8 | REST API, business logic, database |
| [ticketing-system-ui](https://github.com/maksim-chmel/Ticketing-system-ui) | React 19 + TypeScript | Admin panel for coordinators |
| **feedback_bot** ← you are here | Node.js + TypeScript | Telegram bot for end users |
| [alarm_bot](https://github.com/maksim-chmel/Ticketing-system-alarm-bot) | Node.js + TypeScript | Telegram bot that notifies operators of new tickets |

```
User (Telegram)
     │ creates ticket via feedback_bot (this repo)
     ▼
PostgreSQL ◄──────────────────────────────────────────────────
     │                                                        │
     ├── alarm_bot polls every 15s → notifies operator        │
     │                                                        │
     └── ticketing-system-server REST API ─────────────────── ┘
              │
              ▼
     ticketing-system-ui (admin panel)
```

---

## Features

- **Registration** — user sends phone number via Telegram contact button; stored in PostgreSQL
- **Create ticket** — user types a message which is saved as a new feedback record
- **Check ticket status** — shows last 10 tickets with current status
- **Service health check** — verifies database connectivity on demand
- **Broadcast delivery** — on startup, polls `BroadcastMessages` table every 60 seconds and sends queued messages to all registered users

---

## Tech Stack

| | |
|---|---|
| Runtime | Node.js + TypeScript |
| Telegram | node-telegram-bot-api |
| Database | PostgreSQL (via `pg`) |
| Containerization | Docker / Docker Compose |

---

## Project Structure

```
src/
├── index.ts          # Entry point, bot setup, broadcast loop
├── bot/
│   ├── BotService.ts     # Bot initialization, event routing, broadcast loop
│   └── FeedbackHandler.ts # State machine: registration, ticket creation, menu
└── db/
    └── Database.ts       # PostgreSQL queries
```

---

## User Flow

```
/start
  ├── New user → request phone number → register → main menu
  └── Returning user → main menu

Main menu:
  ├── Create ticket → type message → saved to DB
  ├── Ticket status → last 10 tickets with status
  └── Service health → DB ping
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with the shared schema (see [ticketing-system-server](https://github.com/maksim-chmel/Ticketing-system-server))
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### Environment Variables

Create a `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
DB_CONNECTION_STRING=postgresql://postgres:yourpassword@localhost:5432/feedbackdb
```

### Run locally

```bash
npm install
npm start
```

### Run with Docker Compose

```bash
docker compose up --build
```
