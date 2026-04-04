import axios, { AxiosInstance } from 'axios';
import { normalizeBackendError } from '../errors/AppError';

export interface RegisterUserPayload {
    userId: number;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    username: string;
}

export interface CreateFeedbackPayload {
    userId: number;
    username: string;
    comment: string;
}

export interface FeedbackDto {
    id: number;
    comment: string;
    status: number;
    date?: string;
    createdDate?: string;
}

export interface BroadcastMessageDto {
    message: string;
}

export class BotFeedbackApi {
    private readonly http: AxiosInstance;

    constructor(baseUrl: string) {
        this.http = axios.create({
            baseURL: baseUrl,
            timeout: 10_000
        });
    }

    async userExists(userId: number): Promise<boolean> {
        return this.execute('userExists', async () => {
            const { data } = await this.http.get<boolean>(`/exists/${userId}`);
            return data;
        });
    }

    async registerUser(payload: RegisterUserPayload): Promise<void> {
        await this.execute('registerUser', async () => {
            await this.http.post('/register-new-User', {
                UserId: payload.userId,
                Phone: payload.phoneNumber,
                FirstName: payload.firstName,
                LastName: payload.lastName,
                Username: payload.username
            });
        });
    }

    async createFeedback(payload: CreateFeedbackPayload): Promise<void> {
        await this.execute('createFeedback', async () => {
            await this.http.post('/new-feedback', payload);
        });
    }

    async getUserFeedbacks(userId: number): Promise<FeedbackDto[]> {
        return this.execute('getUserFeedbacks', async () => {
            const { data } = await this.http.get<FeedbackDto[]>(`/user-feedbacks/${userId}`);
            return data ?? [];
        });
    }

    async getAllUserIds(): Promise<number[]> {
        return this.execute('getAllUserIds', async () => {
            const { data } = await this.http.get<number[]>('/all-users');
            return data ?? [];
        });
    }

    async getBroadcastMessages(): Promise<BroadcastMessageDto[]> {
        return this.execute('getBroadcastMessages', async () => {
            const { data } = await this.http.get<BroadcastMessageDto[]>('/broadcast-messages');
            return data ?? [];
        });
    }

    private async execute<T>(operation: string, action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (error) {
            throw normalizeBackendError(error, operation);
        }
    }
}
