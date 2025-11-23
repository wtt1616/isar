'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { BankStatement } from '@/types';

export default function FinancialManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session && !['admin', 'bendahari', 'head_imam'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session) {
      fetchStatements();
    }
  }, [session]);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/financial/statements');
      if (response.ok) {
        const data = await response.json();
        setStatements(data);
      }
    } catch (error) {
      console.error('Error fetching statements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedMonth || !selectedYear) {
      setUploadMessage('Sila pilih fail, bulan dan tahun');
      return;
    }

    try {
      setUploading(true);
      setUploadMessage('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('month', selectedMonth);
      formData.append('year', selectedYear);

      const response = await fetch('/api/financial/statements', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadMessage(`✓ ${data.message}`);
        setSelectedFile(null);
        setSelectedMonth('');
        setSelectedYear('');
        setShowUploadModal(false);
        fetchStatements();
      } else {
        setUploadMessage(`✗ ${data.error}`);
      }
    } catch (error) {
      setUploadMessage('✗ Gagal memuat naik fail');
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const monthNames = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];

  const getMonthName = (month: number) => monthNames[month - 1] || '';

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

      <div className="container mt-4">
        <div className="row mb-4">
          <div className="col">
            <h2 className="mb-0">
              <i className="bi bi-cash-coin me-2"></i>
              Pengurusan Kewangan
            </h2>
            <p className="text-muted">Pengurusan penyata bank dan transaksi kewangan masjid</p>
          </div>
          {['admin', 'bendahari'].includes(session?.user.role || '') && (
            <div className="col-auto">
              <button
                className="btn btn-primary"
                onClick={() => setShowUploadModal(true)}
              >
                <i className="bi bi-upload me-2"></i>
                Muat Naik Penyata Bank
              </button>
            </div>
          )}
        </div>

        {/* Statements List */}
        <div className="card">
          <div className="card-header bg-white">
            <h5 className="mb-0">Senarai Penyata Bank</h5>
          </div>
          <div className="card-body">
            {statements.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                <p className="mt-3">Tiada penyata bank dimuat naik lagi</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Bulan/Tahun</th>
                      <th>Nama Fail</th>
                      <th>Tarikh Muat Naik</th>
                      <th>Dimuat Naik Oleh</th>
                      <th>Jumlah Transaksi</th>
                      <th>Dikategorikan</th>
                      <th>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map((statement) => (
                      <tr key={statement.id}>
                        <td>
                          <strong>{getMonthName(statement.month)} {statement.year}</strong>
                        </td>
                        <td>
                          <i className="bi bi-file-earmark-spreadsheet me-2 text-success"></i>
                          {statement.filename}
                        </td>
                        <td>
                          {new Date(statement.upload_date).toLocaleDateString('ms-MY', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td>{statement.uploader_name}</td>
                        <td>
                          <span className="badge bg-primary">{statement.total_transactions}</span>
                        </td>
                        <td>
                          <span className={`badge ${statement.categorized_count === statement.total_transactions ? 'bg-success' : 'bg-warning'}`}>
                            {statement.categorized_count} / {statement.total_transactions}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => router.push(`/financial/transactions?statement_id=${statement.id}`)}
                          >
                            <i className="bi bi-list-ul me-1"></i>
                            Lihat Transaksi
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => router.push(`/dashboard/reports/buku-tunai?month=${statement.month}&year=${statement.year}`)}
                          >
                            <i className="bi bi-file-earmark-text me-1"></i>
                            Buku Tunai
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-upload me-2"></i>
                  Muat Naik Penyata Bank
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadMessage('');
                  }}
                ></button>
              </div>
              <form onSubmit={handleUpload}>
                <div className="modal-body">
                  {uploadMessage && (
                    <div className={`alert ${uploadMessage.startsWith('✓') ? 'alert-success' : 'alert-danger'}`}>
                      {uploadMessage}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Fail Penyata Bank (CSV)</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".csv"
                      onChange={handleFileChange}
                      required
                    />
                    <div className="form-text">
                      Format: CSV sahaja. Fail penyata bank dari bank.
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Bulan</label>
                      <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        required
                      >
                        <option value="">Pilih Bulan</option>
                        {monthNames.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Tahun</label>
                      <select
                        className="form-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        required
                      >
                        <option value="">Pilih Tahun</option>
                        {[2024, 2025, 2026, 2027, 2028].map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      <strong>Fail dipilih:</strong> {selectedFile.name}
                      <br />
                      <small>Saiz: {(selectedFile.size / 1024).toFixed(2)} KB</small>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadMessage('');
                    }}
                    disabled={uploading}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading || !selectedFile || !selectedMonth || !selectedYear}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Memuat Naik...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-upload me-2"></i>
                        Muat Naik
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
