import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, resetToken, token, newPassword } = await req.json();
    const code = (resetToken || token || '').trim();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, reset code, and new password are required' }, { status: 400 });
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = await getDb();
    const user = (await db
      .prepare(`SELECT id, reset_token_expires FROM users WHERE LOWER(email) = LOWER(?) AND reset_token = ?`)
      .get(email.trim(), code)) as { id: string; reset_token_expires?: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Invalid reset code or email' }, { status: 400 });
    }

    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?`)
      .run(passwordHash, new Date().toISOString(), user.id);

    return NextResponse.json({ success: true, message: 'Password has been reset successfully. You can now sign in.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
