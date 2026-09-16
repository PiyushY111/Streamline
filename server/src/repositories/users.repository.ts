import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export class UsersRepository {
  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return user || null;
  }

  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async create(data: { email: string; name?: string; passwordHash: string; avatar?: string }, executor: any = db) {
    const [newUser] = await executor.insert(users).values({
      email: data.email.toLowerCase().trim(),
      name: data.name,
      passwordHash: data.passwordHash,
      avatar: data.avatar,
    }).returning();
    return newUser;
  }
}

export const usersRepository = new UsersRepository();
