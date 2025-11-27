import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Category mappings for BR-KMS-018 report
const TERIMAAN_CATEGORIES = [
  'Sumbangan Am',
  'Sumbangan Khas (Amanah)',
  'Hasil Sewaan / Penjanaan Ekonomi',
  'Pelaburan',
  'Deposit',
  'Hibah Bank',
  'Lain-Lain Terimaan',
];

const PERBELANJAAN_CATEGORIES = [
  'Perkhidmatan Dan Pentadbiran',
  'Pembangunan Dan Penyelenggaraan',
  'Dakwah Dan Pengimarahan',
  'Khidmat Sosial Dan Kemasyarakatan',
  'Penjanaan Ekonomi',
  'Pelbagai',
];

// Map database categories to report categories
function mapPenerimaanCategory(dbCategory: string): string {
  const mapping: { [key: string]: string } = {
    'Sumbangan Am': 'Sumbangan Am',
    'Sumbangan Khas (Amanah)': 'Sumbangan Khas (Amanah)',
    'Hasil Sewaan/Penjanaan Ekonomi': 'Hasil Sewaan / Penjanaan Ekonomi',
    'Hibah Pelaburan': 'Pelaburan',
    'Deposit': 'Deposit',
    'Hibah Bank': 'Hibah Bank',
    'Lain-lain Terimaan': 'Lain-Lain Terimaan',
    'Tahlil': 'Sumbangan Am', // Group under Sumbangan Am
    'Sumbangan Elaun': 'Lain-Lain Terimaan', // Group under Lain-Lain
  };
  return mapping[dbCategory] || 'Lain-Lain Terimaan';
}

function mapPembayaranCategory(dbCategory: string): string {
  const mapping: { [key: string]: string } = {
    'Pentadbiran': 'Perkhidmatan Dan Pentadbiran',
    'Pengurusan Sumber Manusia': 'Perkhidmatan Dan Pentadbiran',
    'Pembangunan dan Penyelenggaraan': 'Pembangunan Dan Penyelenggaraan',
    'Dakwah dan Pengimarahan': 'Dakwah Dan Pengimarahan',
    'Khidmat Sosial dan Kemasyarakatan': 'Khidmat Sosial Dan Kemasyarakatan',
    'Pembelian Aset': 'Pelbagai',
    'Perbelanjaan Khas (Amanah)': 'Pelbagai',
    'Pelbagai': 'Pelbagai',
  };
  return mapping[dbCategory] || 'Pelbagai';
}

// GET - Generate BR-KMS-018 Laporan Kewangan Bulanan Dan Berkala
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
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Initialize monthly data structure
    const months = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGS', 'SEPT', 'OKT', 'NOV', 'DIS'];

    // Initialize terimaan data
    const terimaanData: { [category: string]: { [month: number]: number; jumlah: number } } = {};
    TERIMAAN_CATEGORIES.forEach(cat => {
      terimaanData[cat] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };
    });

    // Initialize perbelanjaan data
    const perbelanjaanData: { [category: string]: { [month: number]: number; jumlah: number } } = {};
    PERBELANJAAN_CATEGORIES.forEach(cat => {
      perbelanjaanData[cat] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };
    });

    // Fetch all transactions for the year grouped by month and category
    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT
        MONTH(ft.transaction_date) as month,
        ft.transaction_type,
        ft.category_penerimaan,
        ft.category_pembayaran,
        COALESCE(ft.credit_amount, 0) as credit_amount,
        COALESCE(ft.debit_amount, 0) as debit_amount
      FROM financial_transactions ft
      JOIN bank_statements bs ON ft.statement_id = bs.id
      WHERE YEAR(ft.transaction_date) = ?
      AND ft.transaction_type IN ('penerimaan', 'pembayaran')
      ORDER BY ft.transaction_date`,
      [year]
    );

    // Process transactions
    for (const txn of transactions) {
      const month = txn.month;

      if (txn.transaction_type === 'penerimaan' && txn.category_penerimaan) {
        const reportCategory = mapPenerimaanCategory(txn.category_penerimaan);
        const amount = parseFloat(txn.credit_amount) || 0;
        terimaanData[reportCategory][month] += amount;
        terimaanData[reportCategory].jumlah += amount;
      } else if (txn.transaction_type === 'pembayaran' && txn.category_pembayaran) {
        const reportCategory = mapPembayaranCategory(txn.category_pembayaran);
        const amount = parseFloat(txn.debit_amount) || 0;
        perbelanjaanData[reportCategory][month] += amount;
        perbelanjaanData[reportCategory].jumlah += amount;
      }
    }

    // Calculate monthly totals
    const jumlahTerimaan: { [month: number]: number; jumlah: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };
    const jumlahPerbelanjaan: { [month: number]: number; jumlah: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };

    TERIMAAN_CATEGORIES.forEach(cat => {
      for (let m = 1; m <= 12; m++) {
        jumlahTerimaan[m] += terimaanData[cat][m];
      }
      jumlahTerimaan.jumlah += terimaanData[cat].jumlah;
    });

    PERBELANJAAN_CATEGORIES.forEach(cat => {
      for (let m = 1; m <= 12; m++) {
        jumlahPerbelanjaan[m] += perbelanjaanData[cat][m];
      }
      jumlahPerbelanjaan.jumlah += perbelanjaanData[cat].jumlah;
    });

    // Calculate Lebih/Kurang (Surplus/Deficit)
    const lebihKurang: { [month: number]: number; jumlah: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };
    for (let m = 1; m <= 12; m++) {
      lebihKurang[m] = jumlahTerimaan[m] - jumlahPerbelanjaan[m];
    }
    lebihKurang.jumlah = jumlahTerimaan.jumlah - jumlahPerbelanjaan.jumlah;

    // Get opening balance for the year (from January or earliest statement)
    const [openingBalanceData] = await pool.query<RowDataPacket[]>(
      `SELECT opening_balance FROM bank_statements
       WHERE year = ? AND month = 1 AND opening_balance IS NOT NULL
       ORDER BY id ASC LIMIT 1`,
      [year]
    );

    // If no January opening balance, calculate from previous year's closing
    let yearOpeningBalance = 0;
    if (openingBalanceData.length > 0 && openingBalanceData[0].opening_balance) {
      yearOpeningBalance = parseFloat(openingBalanceData[0].opening_balance);
    } else {
      // Calculate from all transactions before this year
      const [prevYearBalance] = await pool.query<RowDataPacket[]>(
        `SELECT
          COALESCE(SUM(ft.credit_amount), 0) - COALESCE(SUM(ft.debit_amount), 0) as balance
        FROM financial_transactions ft
        JOIN bank_statements bs ON ft.statement_id = bs.id
        WHERE bs.year < ?`,
        [year]
      );

      // Also get earliest opening balance
      const [earliestOpening] = await pool.query<RowDataPacket[]>(
        `SELECT opening_balance FROM bank_statements
         WHERE opening_balance IS NOT NULL AND opening_balance != 0
         ORDER BY year ASC, month ASC LIMIT 1`
      );

      const prevBalance = prevYearBalance.length > 0 ? parseFloat(prevYearBalance[0].balance || 0) : 0;
      const earliestOpeningBal = earliestOpening.length > 0 ? parseFloat(earliestOpening[0].opening_balance || 0) : 0;
      yearOpeningBalance = earliestOpeningBal + prevBalance;
    }

    // Calculate monthly opening and closing balances
    const bakiAwalBulan: { [month: number]: number; jumlah: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };
    const bakiAkhir: { [month: number]: number; jumlah: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, jumlah: 0 };

    let runningBalance = yearOpeningBalance;
    for (let m = 1; m <= 12; m++) {
      bakiAwalBulan[m] = runningBalance;
      bakiAkhir[m] = runningBalance + lebihKurang[m];
      runningBalance = bakiAkhir[m];
    }
    bakiAwalBulan.jumlah = yearOpeningBalance;
    bakiAkhir.jumlah = runningBalance;

    return NextResponse.json({
      year,
      months,
      terimaan: {
        categories: TERIMAAN_CATEGORIES,
        data: terimaanData,
        jumlah: jumlahTerimaan,
      },
      perbelanjaan: {
        categories: PERBELANJAAN_CATEGORIES,
        data: perbelanjaanData,
        jumlah: jumlahPerbelanjaan,
      },
      lebihKurang,
      bakiAwalBulan,
      bakiAkhir,
    });
  } catch (error) {
    console.error('Error generating laporan bulanan:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
