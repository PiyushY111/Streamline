import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usersRepository } from '../repositories/users.repository.js';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { auditService } from './audit.service.js';

export class AuthService {
  async register(email: string, password?: string, name?: string) {
    const existing = await usersRepository.findByEmail(email);
    if (existing) throw new Error('User with this email already exists');

    const passwordHash = password ? await bcrypt.hash(password, 10) : '';

    const runInTx = typeof db.transaction === 'function'
      ? (fn: (tx: any) => Promise<any>) => db.transaction(fn as any)
      : (fn: (tx: any) => Promise<any>) => fn(db);

    const user = await runInTx(async (tx) => {
      const newUser = await usersRepository.create({ email, name, passwordHash }, tx);
      await auditService.logAction(newUser.id, 'user.registered', { email: newUser.email }, tx);
      return newUser;
    });

    const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });

    return { user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }, token };
  }

  async login(email: string, password?: string) {
    const user = await usersRepository.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');

    if (password && user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) throw new Error('Invalid email or password');
    }

    const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });
    return { user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }, token };
  }

  async getMe(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error('User not found');
    return { id: user.id, email: user.email, name: user.name, avatar: user.avatar };
  }
}

export const authService = new AuthService();
