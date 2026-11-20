import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  return 'dev-only-insecure-secret-change-in-env';
}

export interface UserSession {
  userId: string;
  businessId: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Staff';
  isPlatformAdmin?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signToken(payload: UserSession): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, getJwtSecret()) as UserSession;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req?: NextRequest): Promise<UserSession | null> {
  let token: string | undefined;

  if (req) {
    // 1. Try Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // 2. Try cookie
    if (!token) {
      token = req.cookies.get('auth_token')?.value;
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      if (cookieStore && typeof cookieStore.get === 'function') {
        token = cookieStore.get('auth_token')?.value;
      }
    } catch {
      // In non-RSC context
    }
  }

  if (!token) return null;
  const session = verifyToken(token);
  if (!session) return null;

  try {
    const db = await getDb();
    const row = (await db.prepare(`
      SELECT u.status AS user_status, b.access_status AS business_status
      FROM users u
      JOIN businesses b ON b.id = u.business_id
      WHERE u.id = ? AND u.business_id = ?
    `).get(session.userId, session.businessId)) as { user_status?: string; business_status?: string } | undefined;

    if (!row || row.user_status !== 'active' || row.business_status === 'paused') {
      return null;
    }
  } catch {
    return null;
  }

  return session;
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  const configured = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  if (!configured || !email) return false;
  const allowed = configured
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function enforceRole(session: UserSession | null, allowedRoles: ('Admin' | 'Manager' | 'Staff')[]): boolean {
  if (!session) return false;
  return allowedRoles.includes(session.role);
}
