'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Aktiviti {
  id: number;
  tajuk: string;
  keterangan: string | null;
  tarikh_mula: string;
  tarikh_tamat: string | null;
  masa_mula: string | null;
  masa_tamat: string | null;
  lokasi: string;
  kategori: string;
  penganjur: string | null;
  status: 'aktif' | 'batal';
  created_by: number;
  created_by_name: string | null;
  created_at: string;
}

const KATEGORI_OPTIONS = [
  { value: 'kuliah', label: 'Kuliah' },
  { value: 'program_khas', label: 'Program Khas' },
  { value: 'gotong_royong', label: 'Gotong-royong' },
  { value: 'mesyuarat', label: 'Mesyuarat' },
  { value: 'majlis', label: 'Majlis' },
  { value: 'lain_lain', label: 'Lain-lain' },
];

export default function AktivitiAdminPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [aktiviti, setAktiviti] = useState<Aktiviti[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Aktiviti | null>(null);
  const [formData, setFormData] = useState({
    tajuk: '',
    keterangan: '',
    tarikh_mula: '',
    tarikh_tamat: '',
    masa_mula: '',
    masa_tamat: '',
    lokasi: 'Surau Ar-Raudhah',
    kategori: 'lain_lain',
    penganjur: '',
    status: 'aktif'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (session) {
      fetchAktiviti();
    }
  }, [session, statusFilter]);

  const fetchAktiviti = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/aktiviti?admin=true&status=${statusFilter}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setAktiviti(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuatkan data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  };

  const getKategoriLabel = (kategori: string) => {
    const found = KATEGORI_OPTIONS.find(k => k.value === kategori);
    return found ? found.label : kategori;
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      tajuk: '',
      keterangan: '',
      tarikh_mula: '',
      tarikh_tamat: '',
      masa_mula: '',
      masa_tamat: '',
      lokasi: 'Surau Ar-Raudhah',
      kategori: 'lain_lain',
      penganjur: '',
      status: 'aktif'
    });
    setShowModal(true);
  };

  const openEditModal = (item: Aktiviti) => {
    setEditingItem(item);
    setFormData({
      tajuk: item.tajuk,
      keterangan: item.keterangan || '',
      tarikh_mula: item.tarikh_mula.split('T')[0],
      tarikh_tamat: item.tarikh_tamat ? item.tarikh_tamat.split('T')[0] : '',
      masa_mula: item.masa_mula || '',
      masa_tamat: item.masa_tamat || '',
      lokasi: item.lokasi,
      kategori: item.kategori,
      penganjur: item.penganjur || '',
      status: item.status
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.tajuk || !formData.tarikh_mula) {
      setError('Tajuk dan tarikh mula diperlukan');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = '/api/aktiviti';
      const method = editingItem ? 'PUT' : 'POST';
      const body = {
        ...(editingItem ? { id: editingItem.id } : {}),
        ...formData
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSuccess(editingItem ? 'Aktiviti berjaya dikemaskini' : 'Aktiviti berjaya ditambah');
      setShowModal(false);
      fetchAktiviti();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan aktiviti');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Adakah anda pasti untuk memadam aktiviti ini?')) return;

    try {
      const res = await fetch(`/api/aktiviti?id=${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSuccess('Aktiviti berjaya dipadam');
      fetchAktiviti();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal memadam aktiviti');
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="container py-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">Anda tidak mempunyai akses ke halaman ini.</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => router.push('/dashboard')}
          >
            &larr; Kembali
          </button>
          <h4 className="mb-0">Pengurusan Aktiviti Surau</h4>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <i className="bi bi-plus-lg me-1"></i> Tambah Aktiviti
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filter Tabs */}
      <ul className="nav nav-tabs mb-4">
        {[
          { key: 'all', label: 'Semua' },
          { key: 'aktif', label: 'Aktif' },
          { key: 'batal', label: 'Batal' }
        ].map(tab => (
          <li className="nav-item" key={tab.key}>
            <button
              className={`nav-link ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Tajuk</th>
                  <th>Tarikh</th>
                  <th>Masa</th>
                  <th>Lokasi</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {aktiviti.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Tiada aktiviti
                    </td>
                  </tr>
                ) : (
                  aktiviti.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.tajuk}</strong>
                        {item.penganjur && (
                          <><br /><small className="text-muted">Penganjur: {item.penganjur}</small></>
                        )}
                      </td>
                      <td>
                        {formatDate(item.tarikh_mula)}
                        {item.tarikh_tamat && item.tarikh_tamat !== item.tarikh_mula && (
                          <><br /><small className="text-muted">hingga {formatDate(item.tarikh_tamat)}</small></>
                        )}
                      </td>
                      <td>
                        {item.masa_mula ? (
                          <>
                            {formatTime(item.masa_mula)}
                            {item.masa_tamat && ` - ${formatTime(item.masa_tamat)}`}
                          </>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{item.lokasi}</td>
                      <td>
                        <span className="badge bg-secondary">{getKategoriLabel(item.kategori)}</span>
                      </td>
                      <td>
                        {item.status === 'aktif' ? (
                          <span className="badge bg-success">Aktif</span>
                        ) : (
                          <span className="badge bg-danger">Batal</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(item.id)}
                          title="Padam"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingItem ? 'Edit Aktiviti' : 'Tambah Aktiviti Baru'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-12 mb-3">
                    <label className="form-label">Tajuk Aktiviti <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.tajuk}
                      onChange={(e) => setFormData({ ...formData, tajuk: e.target.value })}
                      placeholder="Contoh: Kuliah Maghrib - Ustaz Ahmad"
                    />
                  </div>

                  <div className="col-12 mb-3">
                    <label className="form-label">Keterangan</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={formData.keterangan}
                      onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                      placeholder="Penerangan ringkas tentang aktiviti"
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Tarikh Mula <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.tarikh_mula}
                      onChange={(e) => setFormData({ ...formData, tarikh_mula: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Tarikh Tamat</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.tarikh_tamat}
                      onChange={(e) => setFormData({ ...formData, tarikh_tamat: e.target.value })}
                      min={formData.tarikh_mula}
                    />
                    <small className="text-muted">Kosongkan jika aktiviti sehari sahaja</small>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Masa Mula</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.masa_mula}
                      onChange={(e) => setFormData({ ...formData, masa_mula: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Masa Tamat</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.masa_tamat}
                      onChange={(e) => setFormData({ ...formData, masa_tamat: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Lokasi</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.lokasi}
                      onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                      placeholder="Surau Ar-Raudhah"
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Kategori</label>
                    <select
                      className="form-select"
                      value={formData.kategori}
                      onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    >
                      {KATEGORI_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Penganjur</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.penganjur}
                      onChange={(e) => setFormData({ ...formData, penganjur: e.target.value })}
                      placeholder="Nama penganjur / jawatankuasa"
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="aktif">Aktif</option>
                      <option value="batal">Batal</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
