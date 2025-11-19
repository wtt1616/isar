import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch preacher schedules for a specific month or date range
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT
        ps.id,
        ps.schedule_date,
        ps.notes,
        ps.subuh_preacher_id,
        ps.maghrib_preacher_id,
        sp.name as subuh_preacher_name,
        mp.name as maghrib_preacher_name,
        ps.created_at,
        ps.updated_at
      FROM preacher_schedules ps
      LEFT JOIN preachers sp ON ps.subuh_preacher_id = sp.id
      LEFT JOIN preachers mp ON ps.maghrib_preacher_id = mp.id
    `;

    const params: any[] = [];

    if (year && month) {
      // Fetch schedules for specific month
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      query += ' WHERE ps.schedule_date BETWEEN ? AND ?';
      params.push(startOfMonth, endOfMonth);
    } else if (startDate && endDate) {
      // Fetch schedules for date range
      query += ' WHERE ps.schedule_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY ps.schedule_date ASC';

    const [schedules] = await pool.query<RowDataPacket[]>(query, params);

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching preacher schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preacher schedules' },
      { status: 500 }
    );
  }
}

// POST - Create or update preacher schedules (Head Imam only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is head_imam
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    console.log('POST /api/preacher-schedules - User role:', userRole, 'User ID:', userId);

    if (userRole !== 'head_imam') {
      return NextResponse.json(
        { error: 'Only Head Imam can create preacher schedules' },
        { status: 403 }
      );
    }

    const { schedules } = await request.json();

    console.log('Received schedules:', schedules);

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { error: 'Schedules array is required' },
        { status: 400 }
      );
    }

    // Use transaction for bulk insert/update
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const schedule of schedules) {
        const { schedule_date, subuh_preacher_id, maghrib_preacher_id, notes } = schedule;

        // Check if schedule already exists for this date
        const [existing] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM preacher_schedules WHERE schedule_date = ?',
          [schedule_date]
        );

        if (existing.length > 0) {
          // Update existing schedule
          await connection.query(
            `UPDATE preacher_schedules
             SET subuh_preacher_id = ?, maghrib_preacher_id = ?, notes = ?
             WHERE schedule_date = ?`,
            [subuh_preacher_id || null, maghrib_preacher_id || null, notes || null, schedule_date]
          );
        } else {
          // Insert new schedule
          await connection.query(
            `INSERT INTO preacher_schedules
             (schedule_date, subuh_preacher_id, maghrib_preacher_id, notes, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
              schedule_date,
              subuh_preacher_id || null,
              maghrib_preacher_id || null,
              notes || null,
              userId
            ]
          );
        }
      }

      await connection.commit();

      return NextResponse.json(
        { message: 'Preacher schedules saved successfully' },
        { status: 200 }
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error saving preacher schedules:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save preacher schedules', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Delete a preacher schedule (Head Imam only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is head_imam
    const userRole = (session.user as any).role;

    if (userRole !== 'head_imam') {
      return NextResponse.json(
        { error: 'Only Head Imam can delete preacher schedules' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const date = searchParams.get('date');

    if (!id && !date) {
      return NextResponse.json(
        { error: 'Schedule ID or date is required' },
        { status: 400 }
      );
    }

    if (id) {
      await pool.query('DELETE FROM preacher_schedules WHERE id = ?', [id]);
    } else if (date) {
      await pool.query('DELETE FROM preacher_schedules WHERE schedule_date = ?', [date]);
    }

    return NextResponse.json({ message: 'Preacher schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting preacher schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete preacher schedule' },
      { status: 500 }
    );
  }
}
