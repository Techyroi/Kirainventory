import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: string } | undefined;

    if (!user) {
      return NextResponse.json({ success: true, message: 'If the email exists, a reset code was generated.' });
    }

    const resetToken = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`).run(resetToken, expires, user.id);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset code for ${email}: ${resetToken}`);
    }

    return NextResponse.json({
      success: true,
      message: 'If the email exists, a reset code was generated.'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
