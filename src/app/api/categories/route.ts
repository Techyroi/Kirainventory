import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';

    const db = getDb();
    const bizId = session.businessId;

    let sql = `
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.status != 'Inactive'
      WHERE c.business_id = ?
    `;

    const params: any[] = [bizId];

    if (query) {
      sql += ` AND (c.name LIKE ? OR c.description LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`);
    }

    sql += ` GROUP BY c.id ORDER BY c.name ASC`;

    const categories = db.prepare(sql).all(...params);
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'Staff') {
      return NextResponse.json({ error: 'Staff users cannot create categories' }, { status: 403 });
    }

    const { name, description } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const db = getDb();
    const bizId = session.businessId;

    const existing = db.prepare(`SELECT id FROM categories WHERE business_id = ? AND name = ?`).get(bizId, name);
    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
    }

    const id = 'cat_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO categories (id, business_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, bizId, name, description || '', now, now);

    const category = db.prepare(`SELECT c.*, 0 as product_count FROM categories c WHERE id = ?`).get(id);

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
