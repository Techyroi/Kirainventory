import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { comparePassword, isPlatformAdminEmail, signToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status === 'disabled') {
      return NextResponse.json({ error: 'Account has been disabled. Contact system administrator.' }, { status: 403 });
    }

    const business = await db.prepare(`SELECT access_status FROM businesses WHERE id = ?`).get(user.business_id) as { access_status?: string } | undefined;
    if (business?.access_status === 'paused') {
      return NextResponse.json({
        error: 'Your account access is currently paused. Please settle your balance or contact support to reactivate.'
      }, { status: 403 });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const sessionPayload = {
      userId: user.id,
      businessId: user.business_id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPlatformAdmin: isPlatformAdminEmail(user.email)
    };

    const token = signToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      token
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
