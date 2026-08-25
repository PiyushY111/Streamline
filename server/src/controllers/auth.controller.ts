import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: 'Email is already registered. Please sign in instead.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      email,
      name: name || email.split('@')[0],
      passwordHash,
    }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      createdAt: users.createdAt,
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ message: 'Account created successfully', user: newUser, token });
  } catch (err: any) {
    logger.error({ err }, 'Error during user registration');
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
    } else {
      // First password set for user originally created via OAuth
      const passwordHash = await bcrypt.hash(password, 10);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    }

    const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    res.json({ message: 'Login successful', user: safeUser, token });
  } catch (err: any) {
    logger.error({ err }, 'Error during login');
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('session_token');
  res.json({ message: 'Logged out successfully' });
}
