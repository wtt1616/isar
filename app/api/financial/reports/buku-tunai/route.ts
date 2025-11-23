import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET - Generate BR-KMS-002 Buku Tunai (Cash Book)
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

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || (new Date().getMonth() + 1).toString();
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    // Get all transactions for the specified month and year
    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT
        ft.*,
        bs.month as statement_month,
        bs.year as statement_year
      FROM financial_transactions ft
      LEFT JOIN bank_statements bs ON ft.statement_id = bs.id
      WHERE MONTH(ft.transaction_date) = ?
      AND YEAR(ft.transaction_date) = ?
      AND ft.transaction_type != 'uncategorized'
      ORDER BY ft.transaction_date ASC, ft.id ASC`,
      [month, year]
    );

    // Group by category for summary
    const penerimaanByCategory: { [key: string]: number } = {};
    const pembayaranByCategory: { [key: string]: number } = {};
    let runningBalance = 0;

    // Add running balance to each transaction
    const transactionsWithBalance = transactions.map((txn) => {
      const creditAmount = parseFloat(txn.credit_amount || 0);
      const debitAmount = parseFloat(txn.debit_amount || 0);

      // Update running balance
      runningBalance += creditAmount - debitAmount;

      // Group by category
      if (txn.transaction_type === 'penerimaan' && txn.category_penerimaan) {
        penerimaanByCategory[txn.category_penerimaan] =
          (penerimaanByCategory[txn.category_penerimaan] || 0) + creditAmount;
      } else if (txn.transaction_type === 'pembayaran' && txn.category_pembayaran) {
        pembayaranByCategory[txn.category_pembayaran] =
          (pembayaranByCategory[txn.category_pembayaran] || 0) + debitAmount;
      }

      return {
        ...txn,
        running_balance: runningBalance,
        amount: txn.transaction_type === 'penerimaan' ? creditAmount : debitAmount
      };
    });

    const totalPenerimaan = Object.values(penerimaanByCategory).reduce((sum, val) => sum + val, 0);
    const totalPembayaran = Object.values(pembayaranByCategory).reduce((sum, val) => sum + val, 0);

    return NextResponse.json({
      month,
      year,
      transactions: transactionsWithBalance,
      penerimaanByCategory,
      pembayaranByCategory,
      totalPenerimaan,
      totalPembayaran,
      balance: runningBalance,
    });
  } catch (error) {
    console.error('Error generating buku tunai report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
