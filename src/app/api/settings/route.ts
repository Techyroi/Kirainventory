import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb();
    const business = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(session.businessId);

    return NextResponse.json(business);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'Admin') return NextResponse.json({ error: 'Only Administrators can update business settings' }, { status: 403 });

    const body = await req.json();
    const {
      name, logo, email, phone, address, currency,
      default_tax_rate, allow_negative_inventory, default_min_stock
    } = body;

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE businesses SET
        name = COALESCE(?, name),
        logo = COALESCE(?, logo),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        currency = COALESCE(?, currency),
        default_tax_rate = COALESCE(?, default_tax_rate),
        allow_negative_inventory = COALESCE(?, allow_negative_inventory),
        default_min_stock = COALESCE(?, default_min_stock),
        updated_at = ?
      WHERE id = ?
    `).run(
      name, logo, email, phone, address, currency,
      default_tax_rate !== undefined ? Number(default_tax_rate) : undefined,
      allow_negative_inventory !== undefined ? (allow_negative_inventory ? 1 : 0) : undefined,
      default_min_stock !== undefined ? Number(default_min_stock) : undefined,
      now, session.businessId
    );

    const updated = db.prepare(`SELECT * FROM businesses WHERE id = ?`).get(session.businessId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
