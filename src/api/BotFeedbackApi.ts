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
    status: number | string;
    createdDate?: string;
    date?: string;
}

export interface BroadcastMessageDto {
    id: number;
    message: string;
    created?: string;
    isActive?: boolean;
}

export interface UserDto {
    userId: number;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    comments: string | null;
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
            try {
                await this.http.get<UserDto>(`/operator/users/${userId}`);
                return true;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return false;
                }
                throw error;
            }
        });
    }

    async registerUser(payload: RegisterUserPayload): Promise<void> {
        await this.execute('registerUser', async () => {
            await this.http.put(`/operator/users/${payload.userId}`, {
                userId: payload.userId,
                phone: payload.phoneNumber,
                firstName: payload.firstName || null,
                lastName: payload.lastName || null,
                username: payload.username || null,
                comments: null
            });
        });
    }

    async createFeedback(payload: CreateFeedbackPayload): Promise<void> {
        await this.execute('createFeedback', async () => {
            await this.http.post('/operator/feedbacks', {
                userId: payload.userId,
                comment: payload.comment,
                createdDate: new Date().toISOString(),
                status: 0
            });
        });
    }

    async getUserFeedbacks(userId: number): Promise<FeedbackDto[]> {
        return this.execute('getUserFeedbacks', async () => {
            const { data } = await this.http.get<FeedbackDto[]>(`/operator/users/${userId}/feedbacks`);
            return data ?? [];
        });
    }

    async getAllUserIds(): Promise<number[]> {
        return this.execute('getAllUserIds', async () => {
            const { data } = await this.http.get<number[]>('/operator/user-ids');
            return data ?? [];
        });
    }

    async getBroadcastMessages(): Promise<BroadcastMessageDto[]> {
        return this.execute('getBroadcastMessages', async () => {
            const { data } = await this.http.post<BroadcastMessageDto[]>('/operator/broadcast-message-pulls');
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
