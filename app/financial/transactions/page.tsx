'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { FinancialTransaction, PenerimaanCategory, PembayaranCategory } from '@/types';

export default function TransactionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statementId = searchParams.get('statement_id');

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<FinancialTransaction[]>([]); // Store all transactions for counts
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'uncategorized' | 'penerimaan' | 'pembayaran'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [showCategorizeModal, setShowCategorizeModal] = useState(false);
  const [categorizing, setCategorizing] = useState(false);

  // Form states
  const [transactionType, setTransactionType] = useState<'penerimaan' | 'pembayaran'>('penerimaan');
  const [categoryPenerimaan, setCategoryPenerimaan] = useState<PenerimaanCategory | ''>('');
  const [categoryPembayaran, setCategoryPembayaran] = useState<PembayaranCategory | ''>('');
  const [notes, setNotes] = useState('');

  const penerimaanCategories: PenerimaanCategory[] = [
    'Sumbangan Am',
    'Sumbangan Khas (Amanah)',
    'Hasil Sewaan/Penjanaan Ekonomi',
    'Tahlil',
    'Sumbangan Elaun',
    'Hibah Pelaburan',
    'Deposit',
    'Hibah Bank',
    'Lain-lain Terimaan'
  ];

  const pembayaranCategories: PembayaranCategory[] = [
    'Pentadbiran',
    'Pengurusan Sumber Manusia',
    'Pembangunan dan Penyelenggaraan',
    'Dakwah dan Pengimarahan',
    'Khidmat Sosial dan Kemasyarakatan',
    'Pembelian Aset',
    'Perbelanjaan Khas (Amanah)',
    'Pelbagai'
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session && !['admin', 'bendahari', 'head_imam'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session && statementId) {
      fetchTransactions();
    }
  }, [session, statementId, filter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Always fetch ALL transactions first
      const response = await fetch(`/api/financial/transactions?statement_id=${statementId}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched transactions:', data.length);
        console.log('Transaction breakdown:', {
          uncategorized: data.filter((t: FinancialTransaction) => !t.category_penerimaan && !t.category_pembayaran).length,
          penerimaan_records: data.filter((t: FinancialTransaction) => t.credit_amount && t.credit_amount > 0).length,
          pembayaran_records: data.filter((t: FinancialTransaction) => t.debit_amount && t.debit_amount > 0).length,
        });

        setAllTransactions(data); // Store all for counts

        // Filter for display
        if (filter === 'all') {
          setTransactions(data);
        } else if (filter === 'uncategorized') {
          // Uncategorized = no category assigned (both categories are NULL)
          const filtered = data.filter((t: FinancialTransaction) => !t.category_penerimaan && !t.category_pembayaran);
          setTransactions(filtered);
        } else if (filter === 'penerimaan') {
          // Penerimaan = has credit_amount
          const filtered = data.filter((t: FinancialTransaction) => t.credit_amount && t.credit_amount > 0);
          setTransactions(filtered);
        } else if (filter === 'pembayaran') {
          // Pembayaran = has debit_amount
          const filtered = data.filter((t: FinancialTransaction) => t.debit_amount && t.debit_amount > 0);
          setTransactions(filtered);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorize = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);

    // Pre-fill form based on existing category or suggest based on amounts
    if (transaction.category_penerimaan) {
      setTransactionType('penerimaan');
      setCategoryPenerimaan(transaction.category_penerimaan);
      setCategoryPembayaran('');
    } else if (transaction.category_pembayaran) {
      setTransactionType('pembayaran');
      setCategoryPembayaran(transaction.category_pembayaran);
      setCategoryPenerimaan('');
    } else {
      // Suggest type based on transaction amounts
      if (transaction.credit_amount && transaction.credit_amount > 0) {
        setTransactionType('penerimaan');
      } else if (transaction.debit_amount && transaction.debit_amount > 0) {
        setTransactionType('pembayaran');
      }
      setCategoryPenerimaan('');
      setCategoryPembayaran('');
    }

    setNotes(transaction.notes || '');
    setShowCategorizeModal(true);
  };

  const handleSaveCategorization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransaction) return;

    try {
      setCategorizing(true);

      const response = await fetch('/api/financial/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: selectedTransaction.id,
          transaction_type: transactionType,
          category_penerimaan: transactionType === 'penerimaan' ? categoryPenerimaan : null,
          category_pembayaran: transactionType === 'pembayaran' ? categoryPembayaran : null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        setShowCategorizeModal(false);
        resetForm();
        fetchTransactions();
      } else {
        const error = await response.json();
        alert('Gagal: ' + error.error);
      }
    } catch (error) {
      console.error('Error categorizing transaction:', error);
      alert('Gagal menyimpan kategori');
    } finally {
      setCategorizing(false);
    }
  };

  const resetForm = () => {
    setSelectedTransaction(null);
    setTransactionType('penerimaan');
    setCategoryPenerimaan('');
    setCategoryPembayaran('');
    setNotes('');
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return `RM ${amount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate counts from ALL transactions, not filtered ones
  // Uncategorized = both categories are NULL
  const uncategorizedCount = allTransactions.filter(t => !t.category_penerimaan && !t.category_pembayaran).length;
  // Penerimaan = has credit_amount
  const penerimaanCount = allTransactions.filter(t => t.credit_amount && t.credit_amount > 0).length;
  // Pembayaran = has debit_amount
  const pembayaranCount = allTransactions.filter(t => t.debit_amount && t.debit_amount > 0).length;
  const totalCount = allTransactions.length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
      <Navbar />

      <div className="container-fluid mt-4 px-4">
        <div className="row mb-4">
          <div className="col">
            <button className="btn btn-outline-secondary mb-3" onClick={() => router.back()}>
              <i className="bi bi-arrow-left me-2"></i>
              Kembali
            </button>
            <h2 className="mb-0">
              <i className="bi bi-list-ul me-2"></i>
              Senarai Transaksi
            </h2>
            <p className="text-muted">Kategorikan transaksi penerimaan dan pembayaran</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="row mb-3">
          <div className="col">
            <div className="btn-group" role="group">
              <button
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('all')}
              >
                Semua ({totalCount})
              </button>
              <button
                className={`btn ${filter === 'uncategorized' ? 'btn-warning' : 'btn-outline-warning'}`}
                onClick={() => setFilter('uncategorized')}
              >
                Belum Dikategorikan ({uncategorizedCount})
              </button>
              <button
                className={`btn ${filter === 'penerimaan' ? 'btn-success' : 'btn-outline-success'}`}
                onClick={() => setFilter('penerimaan')}
              >
                Penerimaan ({penerimaanCount})
              </button>
              <button
                className={`btn ${filter === 'pembayaran' ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={() => setFilter('pembayaran')}
              >
                Pembayaran ({pembayaranCount})
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: '100px' }}>Tarikh</th>
                    <th style={{ width: '120px' }}>No. EFT</th>
                    <th>Penerangan</th>
                    <th style={{ width: '180px' }}>Nama Pengirim/Penerima</th>
                    <th style={{ width: '180px' }}>Butiran Pembayaran</th>
                    <th style={{ width: '120px' }} className="text-end">Debit (RM)</th>
                    <th style={{ width: '120px' }} className="text-end">Kredit (RM)</th>
                    <th style={{ width: '100px' }}>Jenis</th>
                    <th style={{ width: '180px' }}>Kategori</th>
                    <th style={{ width: '120px' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-muted">
                        Tiada transaksi dijumpai
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          <small>
                            {new Date(transaction.transaction_date).toLocaleDateString('ms-MY', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </small>
                        </td>
                        <td>
                          <small>{transaction.customer_eft_no || '-'}</small>
                        </td>
                        <td>
                          <small>{transaction.transaction_description || '-'}</small>
                        </td>
                        <td><small>{transaction.sender_recipient_name || '-'}</small></td>
                        <td>
                          <small className="text-muted">{transaction.payment_details || '-'}</small>
                        </td>
                        <td className="text-end">
                          {transaction.debit_amount ? (
                            <span className="text-danger fw-bold">
                              {formatCurrency(transaction.debit_amount)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="text-end">
                          {transaction.credit_amount ? (
                            <span className="text-success fw-bold">
                              {formatCurrency(transaction.credit_amount)}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {transaction.credit_amount && transaction.credit_amount > 0 ? (
                            <span className="badge bg-success">Terima</span>
                          ) : transaction.debit_amount && transaction.debit_amount > 0 ? (
                            <span className="badge bg-danger">Bayar</span>
                          ) : (
                            <span className="badge bg-secondary">-</span>
                          )}
                        </td>
                        <td>
                          <small>
                            {transaction.category_penerimaan || transaction.category_pembayaran || '-'}
                          </small>
                        </td>
                        <td>
                          {['admin', 'bendahari'].includes(session?.user.role || '') && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleCategorize(transaction)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Categorize Modal */}
      {showCategorizeModal && selectedTransaction && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-tags me-2"></i>
                  Kategorikan Transaksi
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowCategorizeModal(false);
                    resetForm();
                  }}
                ></button>
              </div>
              <form onSubmit={handleSaveCategorization}>
                <div className="modal-body">
                  {/* Transaction Details */}
                  <div className="alert alert-info">
                    <strong>Tarikh:</strong> {new Date(selectedTransaction.transaction_date).toLocaleDateString('ms-MY')}<br/>
                    <strong>Penerangan:</strong> {selectedTransaction.transaction_description}<br/>
                    <strong>Nama:</strong> {selectedTransaction.sender_recipient_name}<br/>
                    <strong>Jumlah:</strong> {' '}
                    {selectedTransaction.credit_amount ? (
                      <span className="text-success fw-bold">+{formatCurrency(selectedTransaction.credit_amount)}</span>
                    ) : (
                      <span className="text-danger fw-bold">-{formatCurrency(selectedTransaction.debit_amount)}</span>
                    )}
                  </div>

                  {/* Transaction Type */}
                  <div className="mb-3">
                    <label className="form-label">Jenis Transaksi</label>
                    <div className="btn-group w-100" role="group">
                      <input
                        type="radio"
                        className="btn-check"
                        name="transactionType"
                        id="typePenerimaan"
                        checked={transactionType === 'penerimaan'}
                        onChange={() => setTransactionType('penerimaan')}
                      />
                      <label className="btn btn-outline-success" htmlFor="typePenerimaan">
                        <i className="bi bi-cash-coin me-2"></i>
                        Penerimaan
                      </label>

                      <input
                        type="radio"
                        className="btn-check"
                        name="transactionType"
                        id="typePembayaran"
                        checked={transactionType === 'pembayaran'}
                        onChange={() => setTransactionType('pembayaran')}
                      />
                      <label className="btn btn-outline-danger" htmlFor="typePembayaran">
                        <i className="bi bi-cash-stack me-2"></i>
                        Pembayaran
                      </label>
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="mb-3">
                    <label className="form-label">Kategori</label>
                    {transactionType === 'penerimaan' ? (
                      <select
                        className="form-select"
                        value={categoryPenerimaan}
                        onChange={(e) => setCategoryPenerimaan(e.target.value as PenerimaanCategory)}
                        required
                      >
                        <option value="">Pilih Kategori Penerimaan</option>
                        {penerimaanCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="form-select"
                        value={categoryPembayaran}
                        onChange={(e) => setCategoryPembayaran(e.target.value as PembayaranCategory)}
                        required
                      >
                        <option value="">Pilih Kategori Pembayaran</option>
                        {pembayaranCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="mb-3">
                    <label className="form-label">Nota (Opsional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Tambah nota jika perlu..."
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowCategorizeModal(false);
                      resetForm();
                    }}
                    disabled={categorizing}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={categorizing}
                  >
                    {categorizing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Simpan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
