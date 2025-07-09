// src/db/Database.ts
import { Pool } from 'pg';
import { config } from 'dotenv';
export interface BroadcastMessage {
    Id: number;
    Message: string;
    Created: Date;
    IsActive: boolean;
}

config();

export class Database {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DB_CONNECTION_STRING,
        });
    }

    async connect() {
        try {
            await this.pool.connect();
            console.log('Подключение к БД успешно');
        } catch (error) {
            console.error('Ошибка подключения к БД:', error);
            throw error;
        }
    }

    async saveUser(
        userId: number,
        phone: string,
        firstName: string,
        lastName: string,
        username: string
    ): Promise<void> {
        const query = `
      INSERT INTO "Users" ("UserId", "Phone", "FirstName", "LastName", "Username")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("UserId") DO UPDATE SET
        "Phone" = EXCLUDED."Phone",
        "FirstName" = EXCLUDED."FirstName",
        "LastName" = EXCLUDED."LastName",
        "Username" = EXCLUDED."Username";
    `;
        try {
            await this.pool.query(query, [userId, phone, firstName, lastName, username]);
        } catch (err) {
            console.error('[DB] Ошибка saveUser:', err);
            throw err;
        }
    }

    async saveFeedback(
        userId: number,
        comment: string
    ): Promise<number | null> {
        const query = `
      INSERT INTO "Feedbacks" ("UserId", "Comment", "Status", "CreatedDate")
      VALUES ($1, $2, 0, NOW())
      RETURNING "Id";
    `;
        try {
            const result = await this.pool.query(query, [userId, comment]);
            return result.rows[0]?.Id ?? null;
        } catch (err) {
            console.error('[DB] Ошибка saveFeedback:', err);
            return null;
        }
    }

    async getUserFeedbacks(userId: number): Promise<{
        Id: number;
        Status: number;
        CreatedDate: Date;
        Comment: string;
    }[]> {
        const query = `
            SELECT "Id", "Status", "CreatedDate", "Comment"
            FROM "Feedbacks"
            WHERE "UserId" = $1
            ORDER BY "CreatedDate" DESC
                LIMIT 10;
        `;
        try {
            const result = await this.pool.query(query, [userId]);
            return result.rows;
        } catch (err) {
            console.error('[DB] Ошибка getUserFeedbacks:', err);
            return [];
        }
    }

    async userExists(userId: number): Promise<boolean> {
        const query = `SELECT EXISTS (SELECT 1 FROM "Users" WHERE "UserId" = $1) AS "exists"`;
        try {
            const result = await this.pool.query(query, [userId]);
            return result.rows[0]?.exists ?? false;
        } catch (err) {
            console.error('[DB] Ошибка userExists:', err);
            return false;
        }
    }

    async getAllUserIds(): Promise<number[]> {
        try {
            const result = await this.pool.query(`SELECT "UserId" FROM "Users";`);
            return result.rows.map(row => row.UserId);
        } catch (err) {
            console.error('[DB] Ошибка getAllUserIds:', err);
            return [];
        }
    }
    async getAllActiveBroadcastMessages(): Promise<BroadcastMessage[]> {
        const result = await this.pool.query(`SELECT * FROM "BroadcastMessages" WHERE "IsActive" = true`);
        return result.rows as BroadcastMessage[];
    }

    async deleteBroadcastMessageById(id: number): Promise<void> {
        await this.pool.query(`DELETE FROM "BroadcastMessages" WHERE "Id" = $1`, [id]);
    }
}