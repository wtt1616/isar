'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Preacher {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: number;
  created_at: string;
}

export default function ManagePreachersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [preachers, setPreachers] = useState<Preacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPreacher, setEditingPreacher] = useState<Preacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    is_active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetchPreachers();
    }
  }, [session]);

  const fetchPreachers = async () => {
    try {
      const response = await fetch('/api/preachers');
      const data = await response.json();

      if (response.ok) {
        setPreachers(data.preachers);
      } else {
        setError(data.error || 'Failed to fetch preachers');
      }
    } catch (err) {
      setError('Failed to fetch preachers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (preacher?: Preacher) => {
    if (preacher) {
      setEditingPreacher(preacher);
      setFormData({
        name: preacher.name,
        phone: preacher.phone || '',
        email: preacher.email || '',
        is_active: preacher.is_active === 1
      });
    } else {
      setEditingPreacher(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        is_active: true
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPreacher(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const url = editingPreacher ? '/api/preachers' : '/api/preachers';
      const method = editingPreacher ? 'PUT' : 'POST';

      const payload = editingPreacher
        ? { id: editingPreacher.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowModal(false);
        fetchPreachers();
      } else {
        setError(data.error || 'Failed to save preacher');
      }
    } catch (err) {
      setError('Failed to save preacher');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this preacher? This will remove them from all schedules.')) {
      return;
    }

    try {
      const response = await fetch(`/api/preachers?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        fetchPreachers();
      } else {
        setError(data.error || 'Failed to delete preacher');
      }
    } catch (err) {
      setError('Failed to delete preacher');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (session?.user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Manage Preachers</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Preacher
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {preachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No preachers found. Add your first preacher to get started.
                    </td>
                  </tr>
                ) : (
                  preachers.map((preacher) => (
                    <tr key={preacher.id}>
                      <td>{preacher.name}</td>
                      <td>{preacher.phone || '-'}</td>
                      <td>{preacher.email || '-'}</td>
                      <td>
                        <span className={`badge ${preacher.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {preacher.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleOpenModal(preacher)}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(preacher.id)}
                        >
                          <i className="bi bi-trash"></i> Delete
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingPreacher ? 'Edit Preacher' : 'Add Preacher'}
                </h5>
                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="phone" className="form-label">
                      Phone
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor="is_active">
                      Active
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingPreacher ? 'Update' : 'Add'} Preacher
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
