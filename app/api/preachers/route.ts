import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch all preachers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = 'SELECT id, name, phone, email, photo, is_active, created_at FROM preachers';

    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }

    query += ' ORDER BY name ASC';

    const [preachers] = await pool.query<RowDataPacket[]>(query);

    return NextResponse.json({ preachers });
  } catch (error) {
    console.error('Error fetching preachers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preachers' },
      { status: 500 }
    );
  }
}

// POST - Create new preacher (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can add preachers' },
        { status: 403 }
      );
    }

    const { name, phone, email } = await request.json();

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if email already exists (if email provided)
    if (email && email.trim() !== '') {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM preachers WHERE email = ?',
        [email.trim()]
      );

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Insert new preacher
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO preachers (name, phone, email, is_active) VALUES (?, ?, ?, 1)',
      [name.trim(), phone?.trim() || null, email?.trim() || null]
    );

    return NextResponse.json(
      {
        message: 'Preacher added successfully',
        preacherId: result.insertId
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating preacher:', error);
    return NextResponse.json(
      { error: 'Failed to create preacher' },
      { status: 500 }
    );
  }
}

// PUT - Update preacher (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can update preachers' },
        { status: 403 }
      );
    }

    const { id, name, phone, email, is_active } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Preacher ID is required' },
        { status: 400 }
      );
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if email already exists for another preacher
    if (email && email.trim() !== '') {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM preachers WHERE email = ? AND id != ?',
        [email.trim(), id]
      );

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Update preacher
    await pool.query(
      'UPDATE preachers SET name = ?, phone = ?, email = ?, is_active = ? WHERE id = ?',
      [name.trim(), phone?.trim() || null, email?.trim() || null, is_active ? 1 : 0, id]
    );

    return NextResponse.json({ message: 'Preacher updated successfully' });
  } catch (error) {
    console.error('Error updating preacher:', error);
    return NextResponse.json(
      { error: 'Failed to update preacher' },
      { status: 500 }
    );
  }
}

// DELETE - Delete preacher (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can delete preachers' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Preacher ID is required' },
        { status: 400 }
      );
    }

    // Delete preacher (cascading will set foreign keys to NULL in schedules)
    await pool.query('DELETE FROM preachers WHERE id = ?', [id]);

    return NextResponse.json({ message: 'Preacher deleted successfully' });
  } catch (error) {
    console.error('Error deleting preacher:', error);
    return NextResponse.json(
      { error: 'Failed to delete preacher' },
      { status: 500 }
    );
  }
}
