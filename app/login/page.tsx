'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getUserColor } from '@/lib/userColors';

interface Schedule {
  id: number;
  date: string;
  prayer_time: string;
  imam_id: number;
  bilal_id: number;
  imam_name?: string;
  bilal_name?: string;
}

interface PreacherSchedule {
  schedule_date: string;
  subuh_preacher_id: number | null;
  dhuha_preacher_id: number | null;
  maghrib_preacher_id: number | null;
  friday_preacher_id: number | null;
  subuh_preacher_name?: string;
  dhuha_preacher_name?: string;
  maghrib_preacher_name?: string;
  friday_preacher_name?: string;
  subuh_preacher_photo?: string | null;
  dhuha_preacher_photo?: string | null;
  maghrib_preacher_photo?: string | null;
  friday_preacher_photo?: string | null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [preacherSchedules, setPreacherSchedules] = useState<PreacherSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const router = useRouter();

  useEffect(() => {
    fetchSchedules();
  }, [selectedWeek]);

  const getWednesday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Calculate days to Wednesday (day 3) for the week containing this date
    // Week runs from Wednesday to Tuesday
    let diff;
    if (day === 0) {
      // Sunday: go back 4 days to get Wednesday of this week
      diff = -4;
    } else if (day === 1) {
      // Monday: go back 5 days to get Wednesday of this week
      diff = -5;
    } else if (day === 2) {
      // Tuesday: go back 6 days to get Wednesday of this week
      diff = -6;
    } else {
      // Wednesday (3), Thursday (4), Friday (5), Saturday (6): go back (day - 3) days
      diff = 3 - day;
    }
    const wednesday = new Date(d);
    wednesday.setDate(d.getDate() + diff);
    return wednesday;
  };

  const formatDateOnly = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    const wednesday = getWednesday(selectedWeek);
    const tuesday = new Date(wednesday);
    tuesday.setDate(wednesday.getDate() + 6);

    const startDate = formatDateOnly(wednesday);
    const endDate = formatDateOnly(tuesday);

    try {
      const [schedulesRes, preacherSchedulesRes] = await Promise.all([
        fetch(`/api/schedules?start_date=${startDate}&end_date=${endDate}`),
        fetch(`/api/preacher-schedules?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data);
      }
      if (preacherSchedulesRes.ok) {
        const data = await preacherSchedulesRes.json();
        setPreacherSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const changeWeek = (direction: number) => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    setSelectedWeek(newDate);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-MY', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getDaysOfWeek = () => {
    const wednesday = getWednesday(selectedWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(wednesday);
      date.setDate(wednesday.getDate() + i);
      days.push(formatDateOnly(date));
    }
    return days;
  };

  const getScheduleForSlot = (date: string, prayerTime: string) => {
    return schedules.find(
      (s) => s.date.split('T')[0] === date && s.prayer_time === prayerTime
    );
  };

  const getPreacherScheduleForDate = (date: string) => {
    return preacherSchedules.find((ps) => ps.schedule_date === date);
  };

  const renderPreacherInfo = (name?: string, photo?: string | null) => {
    if (!name) return <span className="text-muted">-</span>;

    return (
      <div className="d-flex align-items-center gap-2">
        {photo ? (
          <img
            src={photo}
            alt={name}
            width={30}
            height={30}
            className="rounded-circle"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div
            className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
            style={{ width: '30px', height: '30px', fontSize: '12px' }}
          >
            <i className="bi bi-person-fill"></i>
          </div>
        )}
        <span className="small">{name}</span>
      </div>
    );
  };

  const days = getDaysOfWeek();
  const prayerTimes = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];
  const wednesday = getWednesday(selectedWeek);
  const tuesday = new Date(wednesday);
  tuesday.setDate(wednesday.getDate() + 6);

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}>
      {/* Header */}
      <nav className="navbar navbar-light bg-white shadow-sm" style={{ borderBottom: '3px solid #f59e0b' }}>
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1 fw-bold d-flex align-items-center" style={{ color: '#059669' }}>
            <i className="bi bi-mosque me-2" style={{ fontSize: '2rem' }}></i>
            <div>
              <div style={{ fontSize: '1.5rem', lineHeight: '1.2' }}>iSAR System</div>
              <div style={{ fontSize: '0.875rem', fontWeight: '400', color: '#4b5563' }}>Public Schedule View</div>
            </div>
          </span>
          <button
            className="btn btn-success d-flex align-items-center"
            onClick={() => setShowLoginModal(true)}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: 'none',
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600'
            }}
          >
            <i className="bi bi-box-arrow-in-right me-2"></i>
            Staff Login
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mt-4 pb-5">
        {/* Week Navigation */}
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)' }}>
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-4 mb-3 mb-md-0">
                <h4 className="mb-1 d-flex align-items-center" style={{ color: '#059669' }}>
                  <i className="bi bi-calendar-week me-2"></i>
                  Weekly Schedule
                </h4>
                <p className="text-muted mb-0 small">
                  <i className="bi bi-calendar-range me-1"></i>
                  {wednesday.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} - {tuesday.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="col-md-8 text-end">
                <div className="btn-group">
                  <button
                    className="btn btn-outline-secondary d-flex align-items-center"
                    onClick={() => changeWeek(-1)}
                    disabled={schedulesLoading}
                  >
                    <i className="bi bi-chevron-left me-1"></i> Previous
                  </button>
                  <button
                    className="btn btn-primary d-flex align-items-center"
                    onClick={() => setSelectedWeek(new Date())}
                    disabled={schedulesLoading}
                  >
                    <i className="bi bi-calendar-check me-1"></i> Current Week
                  </button>
                  <button
                    className="btn btn-outline-secondary d-flex align-items-center"
                    onClick={() => changeWeek(1)}
                    disabled={schedulesLoading}
                  >
                    Next <i className="bi bi-chevron-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {schedulesLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="alert alert-warning">
            No schedule available for this week.
          </div>
        ) : (
          <>
            {/* Prayer Schedule */}
            <div className="card mb-4">
              <div className="card-header text-white">
                <h5 className="mb-0">
                  <i className="bi bi-clock me-2"></i>
                  Prayer Schedule
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Prayer Time</th>
                        {days.map((date) => (
                          <th key={date}>{formatDate(date)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prayerTimes.map((prayer) => (
                        <tr key={prayer}>
                          <td className="fw-bold">{prayer}</td>
                          {days.map((date) => {
                            const schedule = getScheduleForSlot(date, prayer);
                            return (
                              <td key={`${date}-${prayer}`}>
                                {schedule ? (
                                  <div>
                                    <div
                                      className="mb-2 p-2 rounded"
                                      style={{
                                        backgroundColor: getUserColor(schedule.imam_id).bg,
                                        color: getUserColor(schedule.imam_id).text,
                                        border: `2px solid ${getUserColor(schedule.imam_id).border}`,
                                      }}
                                    >
                                      <strong>Imam:</strong> {schedule.imam_name}
                                    </div>
                                    <div
                                      className="p-2 rounded"
                                      style={{
                                        backgroundColor: getUserColor(schedule.bilal_id).bg,
                                        color: getUserColor(schedule.bilal_id).text,
                                        border: `2px solid ${getUserColor(schedule.bilal_id).border}`,
                                      }}
                                    >
                                      <strong>Bilal:</strong> {schedule.bilal_name}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Preacher Schedule */}
            <div className="card mb-4">
              <div className="card-header text-white" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                <h5 className="mb-0">
                  <i className="bi bi-megaphone me-2"></i>
                  Preacher Schedule
                </h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Preaching Slot</th>
                        {days.map((date) => (
                          <th key={date}>{formatDate(date)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="fw-bold">Subuh</td>
                        {days.map((date) => {
                          const dateObj = new Date(date);
                          const dayOfWeek = dateObj.getDay();
                          const preacherSchedule = getPreacherScheduleForDate(date);

                          if (dayOfWeek === 1 || dayOfWeek === 4) {
                            return (
                              <td key={`${date}-subuh`} className="text-center text-muted">
                                No Preaching
                              </td>
                            );
                          }

                          if (dayOfWeek === 5) {
                            return (
                              <td key={`${date}-subuh`} className="text-center text-muted">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={`${date}-subuh`}>
                              {renderPreacherInfo(preacherSchedule?.subuh_preacher_name, preacherSchedule?.subuh_preacher_photo)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Dhuha (Weekend)</td>
                        {days.map((date) => {
                          const dateObj = new Date(date);
                          const dayOfWeek = dateObj.getDay();
                          const preacherSchedule = getPreacherScheduleForDate(date);

                          if (dayOfWeek === 1 || dayOfWeek === 4) {
                            return (
                              <td key={`${date}-dhuha`} className="text-center text-muted">
                                No Preaching
                              </td>
                            );
                          }

                          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            return (
                              <td key={`${date}-dhuha`} className="text-center text-muted">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={`${date}-dhuha`}>
                              {renderPreacherInfo(preacherSchedule?.dhuha_preacher_name, preacherSchedule?.dhuha_preacher_photo)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Maghrib</td>
                        {days.map((date) => {
                          const dateObj = new Date(date);
                          const dayOfWeek = dateObj.getDay();
                          const preacherSchedule = getPreacherScheduleForDate(date);

                          if (dayOfWeek === 1 || dayOfWeek === 4) {
                            return (
                              <td key={`${date}-maghrib`} className="text-center text-muted">
                                No Preaching
                              </td>
                            );
                          }

                          if (dayOfWeek === 5) {
                            return (
                              <td key={`${date}-maghrib`} className="text-center text-muted">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={`${date}-maghrib`}>
                              {renderPreacherInfo(preacherSchedule?.maghrib_preacher_name, preacherSchedule?.maghrib_preacher_photo)}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="fw-bold">Friday Preach</td>
                        {days.map((date) => {
                          const dateObj = new Date(date);
                          const dayOfWeek = dateObj.getDay();
                          const preacherSchedule = getPreacherScheduleForDate(date);

                          if (dayOfWeek === 1 || dayOfWeek === 4) {
                            return (
                              <td key={`${date}-friday`} className="text-center text-muted">
                                No Preaching
                              </td>
                            );
                          }

                          if (dayOfWeek !== 5) {
                            return (
                              <td key={`${date}-friday`} className="text-center text-muted">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={`${date}-friday`}>
                              {renderPreacherInfo(preacherSchedule?.friday_preacher_name, preacherSchedule?.friday_preacher_photo)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
              <div className="modal-header" style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                borderBottom: 'none',
                color: 'white'
              }}>
                <h5 className="modal-title fw-bold d-flex align-items-center">
                  <i className="bi bi-shield-lock me-2"></i>
                  Staff Login
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowLoginModal(false);
                    setError('');
                  }}
                ></button>
              </div>
              <div className="modal-body" style={{ padding: '2rem' }}>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} autoComplete="off">
                  <input type="text" name="fake-username" autoComplete="username" style={{ display: 'none' }} />
                  <input type="password" name="fake-password" autoComplete="new-password" style={{ display: 'none' }} />

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="off"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
