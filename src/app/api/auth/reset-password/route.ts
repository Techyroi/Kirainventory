import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, resetToken, newPassword } = await req.json();

    if (!email || !resetToken || !newPassword) {
      return NextResponse.json({ error: 'Email, reset code, and new password are required' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.prepare(`SELECT * FROM users WHERE email = ? AND reset_token = ?`).get(email, resetToken) as any;

    if (!user) {
      return NextResponse.json({ error: 'Invalid reset code or email' }, { status: 400 });
    }

    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?`)
      .run(passwordHash, new Date().toISOString(), user.id);

    return NextResponse.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
