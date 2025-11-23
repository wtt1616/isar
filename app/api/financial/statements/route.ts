import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import Papa from 'papaparse';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Fetch all bank statements
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin, head_imam, and bendahari can access
    if (!['admin', 'head_imam', 'bendahari'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [statements] = await pool.query<RowDataPacket[]>(
      `SELECT
        bs.*,
        u.name as uploader_name
      FROM bank_statements bs
      LEFT JOIN users u ON bs.uploaded_by = u.id
      ORDER BY bs.year DESC, bs.month DESC, bs.upload_date DESC`
    );

    return NextResponse.json(statements);
  } catch (error) {
    console.error('Error fetching bank statements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank statements' },
      { status: 500 }
    );
  }
}

// POST - Upload new bank statement
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only bendahari and admin can upload
    if (!['admin', 'bendahari'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const month = parseInt(formData.get('month') as string);
    const year = parseInt(formData.get('year') as string);

    if (!file || !month || !year) {
      return NextResponse.json(
        { error: 'File, month, and year are required' },
        { status: 400 }
      );
    }

    // Check if statement for this month/year already exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM bank_statements WHERE month = ? AND year = ?',
      [month, year]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Penyata bank untuk ${month}/${year} sudah wujud` },
        { status: 400 }
      );
    }

    // Read and parse CSV file
    const fileText = await file.text();
    const parseResult = Papa.parse(fileText, {
      header: false,
      skipEmptyLines: true,
    });

    const rows = parseResult.data as string[][];

    // Find the header row (row with "Transaction Date")
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some(cell => cell && cell.includes('Transaction Date'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid CSV format: Header row not found' },
        { status: 400 }
      );
    }

    // Extract transaction rows (start from header + 1)
    const transactionRows = rows.slice(headerRowIndex + 1);

    // Insert bank statement record
    const [statementResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO bank_statements
        (filename, month, year, uploaded_by, total_transactions)
      VALUES (?, ?, ?, ?, ?)`,
      [file.name, month, year, session.user.id, transactionRows.length]
    );

    const statementId = statementResult.insertId;

    // Insert transactions
    let insertedCount = 0;
    for (const row of transactionRows) {
      // Skip if row doesn't have enough data
      if (row.length < 10) continue;

      try {
        const transactionDate = parseTransactionDate(row[1]);
        if (!transactionDate) continue; // Skip invalid dates

        const debitAmount = parseAmount(row[7]);
        const creditAmount = parseAmount(row[8]);
        const balance = parseAmount(row[9]);

        // Determine transaction type based on credit/debit
        // But leave category as NULL (uncategorized) for manual categorization
        let transactionType = 'penerimaan';
        if (debitAmount && debitAmount > 0) {
          transactionType = 'pembayaran';
        } else if (creditAmount && creditAmount > 0) {
          transactionType = 'penerimaan';
        }

        await pool.query(
          `INSERT INTO financial_transactions
            (statement_id, transaction_date, customer_eft_no, transaction_code,
             transaction_description, ref_cheque_no, servicing_branch,
             debit_amount, credit_amount, balance, sender_recipient_name,
             payment_details, transaction_type, category_penerimaan, category_pembayaran)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            statementId,
            transactionDate,
            row[2] || null,
            row[3] || null,
            row[4] || null,
            row[5] || null,
            row[6] || null,
            debitAmount,
            creditAmount,
            balance,
            row[10] || null,
            row[11] || null,
            transactionType,
            null, // category_penerimaan - NULL = uncategorized
            null, // category_pembayaran - NULL = uncategorized
          ]
        );

        insertedCount++;
      } catch (err) {
        console.error('Error inserting transaction:', err, row);
        // Continue with next row
      }
    }

    // Update total transactions count
    await pool.query(
      'UPDATE bank_statements SET total_transactions = ? WHERE id = ?',
      [insertedCount, statementId]
    );

    return NextResponse.json({
      success: true,
      statement_id: statementId,
      total_transactions: insertedCount,
      message: `Berjaya dimuat naik ${insertedCount} transaksi`,
    });
  } catch (error) {
    console.error('Error uploading bank statement:', error);
    return NextResponse.json(
      { error: 'Failed to upload bank statement' },
      { status: 500 }
    );
  }
}

// Helper function to parse transaction date
function parseTransactionDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // Format: "1/6/2025 6:15" or "1/6/2025"
    const parts = dateStr.trim().split(' ');
    const dateParts = parts[0].split('/');

    if (dateParts.length !== 3) return null;

    const day = dateParts[0].padStart(2, '0');
    const month = dateParts[1].padStart(2, '0');
    const year = dateParts[2];

    let time = '00:00:00';
    if (parts.length > 1) {
      time = parts[1] + ':00';
    }

    return `${year}-${month}-${day} ${time}`;
  } catch (error) {
    return null;
  }
}

// Helper function to parse amount
function parseAmount(amountStr: string): number | null {
  if (!amountStr || amountStr.trim() === '') return null;

  const parsed = parseFloat(amountStr.replace(/,/g, ''));
  return isNaN(parsed) ? null : parsed;
}
