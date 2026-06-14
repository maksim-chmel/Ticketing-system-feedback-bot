import http from 'http';
import * as signalR from '@microsoft/signalr';
import { OperatorNotifier } from './OperatorNotifier';
import { log } from '../bot/logger';

interface FeedbackEvent {
    id: number;
    phone?: string | null;
    username?: string | null;
    comment?: string | null;
    date?: string | null;
    createdDate?: string | null;
}

class NodeHttpClient extends signalR.HttpClient {
    send(request: signalR.HttpRequest): Promise<signalR.HttpResponse> {
        return new Promise((resolve, reject) => {
            const url = new URL(request.url!);
            const req = http.request(
                {
                    host: url.hostname,
                    port: parseInt(url.port || '80'),
                    path: url.pathname + url.search,
                    method: request.method,
                    headers: request.headers as Record<string, string>
                },
                res => {
                    let body = '';
                    res.on('data', (chunk: Buffer) => { body += chunk; });
                    res.on('end', () => resolve(new signalR.HttpResponse(res.statusCode ?? 0, res.statusMessage ?? '', body)));
                }
            );
            req.on('error', reject);
            req.end(request.content ?? '');
        });
    }
}

function formatFeedbackNotification(fb: FeedbackEvent): string {
    const username = fb.username ? `@${fb.username}` : 'unknown';
    const rawDate = fb.date ?? fb.createdDate;
    const formattedDate = rawDate
        ? new Date(rawDate).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        : 'Just now';

    return [
        `🆕 New Feedback #${fb.id}`,
        `📅 Time: ${formattedDate}`,
        `📱 Phone: ${fb.phone || 'N/A'}`,
        `👤 User: ${username}`,
        `💬 Comment: ${fb.comment?.trim() || 'No comment'}`
    ].join('\n');
}

export async function startFeedbackAlarmHub(hubUrl: string, notifier: OperatorNotifier): Promise<void> {
    const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
            httpClient: new NodeHttpClient()
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    connection.on('newFeedback', async (fb: FeedbackEvent) => {
        const text = formatFeedbackNotification(fb);
        await notifier.send(text);
        log('Information', 'Operator notified about feedback #{Id}', { Id: fb.id });
    });

    connection.onreconnecting(() => log('Warning', 'Feedback alarm hub reconnecting'));
    connection.onreconnected(() => log('Information', 'Feedback alarm hub reconnected'));
    connection.onclose(() => log('Error', 'Feedback alarm hub connection closed'));

    await connection.start();
    const safeUrl = hubUrl.replace(/access_token=[^&]*/i, 'access_token=***');
    log('Information', 'Feedback alarm hub connected: {Url}', { Url: safeUrl });
}
