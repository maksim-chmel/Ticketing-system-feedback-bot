import axios from 'axios';

const SEQ_URL = 'http://seq:5341/api/events/raw';

export const log = (level: string, message: string, props: object = {}) => {
   
    console.log(`[${level.toUpperCase()}] ${message}`, props);

   
    axios.post(SEQ_URL, {
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
    }).catch(err => {
       
        console.error('Seq logging failed:', err.message);
    });
};