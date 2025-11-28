import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch all permohonan (admin only) or check availability
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkDate = searchParams.get('check_date');

    // Public endpoint to check date availability
    if (checkDate) {
      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT id, tajuk_majlis, masa_majlis, waktu_majlis, status
         FROM permohonan_majlis
         WHERE tarikh_majlis = ? AND status IN ('pending', 'approved')`,
        [checkDate]
      );
      return NextResponse.json({ bookings: existing });
    }

    // Admin-only: fetch all permohonan
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'head_imam'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    // Get total count
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM permohonan_majlis ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT pm.*, u.name as approved_by_name
       FROM permohonan_majlis pm
       LEFT JOIN users u ON pm.approved_by = u.id
       ${whereClause}
       ORDER BY pm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching permohonan majlis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new permohonan (public)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      nama_pemohon,
      no_kad_pengenalan,
      alamat,
      no_telefon_rumah,
      no_handphone,
      tajuk_majlis,
      tarikh_majlis,
      hari_majlis,
      masa_majlis,
      waktu_majlis,
      jumlah_jemputan,
      peralatan,
      peralatan_lain,
      bersetuju_terma
    } = body;

    // Validation
    if (!nama_pemohon || !no_kad_pengenalan || !alamat || !no_handphone ||
        !tajuk_majlis || !tarikh_majlis || !hari_majlis || !masa_majlis ||
        !waktu_majlis || !jumlah_jemputan || !bersetuju_terma) {
      return NextResponse.json({ error: 'Sila lengkapkan semua maklumat yang diperlukan' }, { status: 400 });
    }

    // Check if date is already booked for the same time slot
    const [existing] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM permohonan_majlis
       WHERE tarikh_majlis = ? AND waktu_majlis = ? AND status IN ('pending', 'approved')`,
      [tarikh_majlis, waktu_majlis]
    );

    if ((existing as any[]).length > 0) {
      return NextResponse.json({
        error: 'Tarikh dan waktu ini telah ditempah. Sila pilih tarikh atau waktu lain.'
      }, { status: 400 });
    }

    // Insert new permohonan
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO permohonan_majlis (
        nama_pemohon, no_kad_pengenalan, alamat, no_telefon_rumah, no_handphone,
        tajuk_majlis, tarikh_majlis, hari_majlis, masa_majlis, waktu_majlis,
        jumlah_jemputan, peralatan, peralatan_lain, bersetuju_terma
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nama_pemohon, no_kad_pengenalan, alamat, no_telefon_rumah || null, no_handphone,
        tajuk_majlis, tarikh_majlis, hari_majlis, masa_majlis, waktu_majlis,
        jumlah_jemputan, JSON.stringify(peralatan || []), peralatan_lain || null, bersetuju_terma
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Permohonan berjaya dihantar. Anda akan dihubungi selepas permohonan diproses.',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating permohonan majlis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update permohonan status (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'head_imam'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, rejection_reason } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (status === 'rejected' && !rejection_reason) {
      return NextResponse.json({ error: 'Sila nyatakan sebab penolakan' }, { status: 400 });
    }

    await pool.execute(
      `UPDATE permohonan_majlis
       SET status = ?, approved_by = ?, approved_at = ?, rejection_reason = ?
       WHERE id = ?`,
      [
        status,
        status !== 'pending' ? session.user.id : null,
        status !== 'pending' ? new Date() : null,
        status === 'rejected' ? rejection_reason : null,
        id
      ]
    );

    return NextResponse.json({ success: true, message: 'Status berjaya dikemaskini' });
  } catch (error) {
    console.error('Error updating permohonan majlis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete permohonan (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await pool.execute('DELETE FROM permohonan_majlis WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Permohonan berjaya dipadam' });
  } catch (error) {
    console.error('Error deleting permohonan majlis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
