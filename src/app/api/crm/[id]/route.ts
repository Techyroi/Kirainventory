import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

function requirePlatformAdmin(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const db = getDb();
  const user = db.prepare(`SELECT is_platform_admin FROM users WHERE id = ?`).get(session.userId) as { is_platform_admin?: number } | undefined;
  if (!user?.is_platform_admin) {
    return { error: NextResponse.json({ error: 'Platform administrator access required' }, { status: 403 }) };
  }
  return { session, db };
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const auth = requirePlatformAdmin(req);
    if ('error' in auth) return auth.error;
    const { session, db } = auth;
    const { id } = await props.params;

    const existing = db.prepare(`SELECT id FROM businesses WHERE id = ?`).get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Client business not found' }, { status: 404 });
    }

    const body = await req.json();
    const now = new Date().toISOString();

    // Optional: toggle an individual user inside this business
    if (body.user_id && body.user_status) {
      if (body.user_id === session.userId && body.user_status === 'disabled') {
        return NextResponse.json({ error: 'You cannot disable your own platform admin account' }, { status: 400 });
      }
      if (!['active', 'disabled'].includes(body.user_status)) {
        return NextResponse.json({ error: 'Invalid user status' }, { status: 400 });
      }
      db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND business_id = ?`)
        .run(body.user_status, now, body.user_id, id);
      return NextResponse.json({ success: true });
    }

    if (id === session.businessId && body.access_status === 'paused') {
      return NextResponse.json({ error: 'You cannot pause your own platform admin workspace' }, { status: 400 });
    }

    let accessStatus = body.access_status;
    let paymentStatus = body.payment_status;
    let lastPaidAt = body.last_paid_at;

    if (body.action === 'mark_paid') {
      accessStatus = 'active';
      paymentStatus = 'Paid';
      lastPaidAt = now;
    }

    if (accessStatus && !['active', 'paused'].includes(accessStatus)) {
      return NextResponse.json({ error: 'Invalid access_status' }, { status: 400 });
    }
    if (paymentStatus && !['Paid', 'Pending', 'Overdue', 'Trial'].includes(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 });
    }

    const planAmount = body.plan_amount !== undefined ? Number(body.plan_amount) : null;

    db.prepare(`
      UPDATE businesses SET
        access_status = COALESCE(?, access_status),
        payment_status = COALESCE(?, payment_status),
        plan_amount = COALESCE(?, plan_amount),
        last_paid_at = COALESCE(?, last_paid_at),
        next_due_date = CASE WHEN ? THEN ? ELSE next_due_date END,
        crm_notes = CASE WHEN ? THEN ? ELSE crm_notes END,
        updated_at = ?
      WHERE id = ?
    `).run(
      accessStatus ?? null,
      paymentStatus ?? null,
      planAmount !== null && !Number.isNaN(planAmount) ? planAmount : null,
      lastPaidAt ?? null,
      body.next_due_date !== undefined ? 1 : 0,
      body.next_due_date || null,
      body.crm_notes !== undefined ? 1 : 0,
      body.crm_notes ?? null,
      now,
      id
    );

    const updated = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(id);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const auth = requirePlatformAdmin(req);
    if ('error' in auth) return auth.error;
    const { session, db } = auth;
    const { id } = await props.params;

    if (id === session.businessId) {
      return NextResponse.json({ error: 'You cannot delete your own platform admin workspace' }, { status: 400 });
    }

    const existing = db.prepare(`SELECT id FROM businesses WHERE id = ?`).get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Client business not found' }, { status: 404 });
    }

    db.prepare(`DELETE FROM businesses WHERE id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
