import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

async function sendResetEmail(to: string, code: string, resetUrl: string): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return false;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM?.trim() || user;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from,
    to,
    subject: 'Kiralyte POS system — Password Reset Code',
    text: `Your password reset code is: ${code}\n\nOr open this link to reset your password:\n${resetUrl}\n\nThis code expires in 30 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #ffffff;">Kiralyte POS system</h2>
        <p style="color: #cbd5e1; font-size: 14px;">Use the 6-digit code below to reset your password (expires in 30 minutes):</p>
        <div style="margin: 20px 0; padding: 14px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; background: #1e293b; border-radius: 8px; color: #a5b4fc;">
          ${code}
        </div>
        <p style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
            Reset Password
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `
  });

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();
    const user = (await db
      .prepare(`SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(email.trim())) as { id: string; email: string } | undefined;

    if (!user) {
      return NextResponse.json({
        success: true,
        emailSent: true,
        message: 'If an account exists for that email, a 6-digit reset code has been sent.'
      });
    }

    const resetToken = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db
      .prepare(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`)
      .run(resetToken, expires, user.id);

    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(user.email)}&code=${resetToken}`;

    const emailSent = await sendResetEmail(user.email, resetToken, resetUrl);

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset code for ${user.email}: ${resetToken} (${resetUrl})`);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? 'A 6-digit password reset code has been sent to your email.'
        : 'Reset code generated. Email delivery is not configured yet (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env).'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
