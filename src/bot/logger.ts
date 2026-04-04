import axios from 'axios';

type LogLevel = 'Information' | 'Warning' | 'Error' | 'Fatal';

function writeConsole(level: LogLevel, message: string, props: object) {
    const formatted = `[${level.toUpperCase()}] ${message}`;
    if (level === 'Error' || level === 'Fatal') {
        console.error(formatted, props);
        return;
    }

    console.log(formatted, props);
}

export const log = (level: LogLevel, message: string, props: object = {}) => {
    writeConsole(level, message, props);

    const seqUrl = process.env.SEQ_URL?.trim();
    if (!seqUrl) {
        return;
    }

    axios.post(`${seqUrl.replace(/\/$/, '')}/api/events/raw`, {
        Events: [{
            Timestamp: new Date().toISOString(),
            Level: level,
            MessageTemplate: message,
            Properties: {
                Application: 'TelegramBot',
                ...props
            }
        }]
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 2000
    }).catch((err: Error) => {
        console.error('Seq logging failed:', err.message);
    });
};
