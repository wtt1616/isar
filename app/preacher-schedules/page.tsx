'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Preacher {
  id: number;
  name: string;
  is_active: number;
}

interface Schedule {
  schedule_date: string;
  subuh_preacher_id: number | null;
  maghrib_preacher_id: number | null;
  notes: string;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  subuh_preacher_id: number | null;
  maghrib_preacher_id: number | null;
  notes: string;
}

export default function PreacherSchedulesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [preachers, setPreachers] = useState<Preacher[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [schedules, setSchedules] = useState<Map<string, Schedule>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchPreachers();
      fetchSchedules();
    }
  }, [session, currentDate]);

  useEffect(() => {
    generateCalendar();
  }, [currentDate]);

  const fetchPreachers = async () => {
    try {
      const response = await fetch('/api/preachers?active=true');
      const data = await response.json();

      if (response.ok) {
        setPreachers(data.preachers);
      }
    } catch (err) {
      console.error('Error fetching preachers:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch(
        `/api/preacher-schedules?year=${year}&month=${month}`
      );
      const data = await response.json();

      if (response.ok) {
        const scheduleMap = new Map<string, Schedule>();
        data.schedules.forEach((schedule: any) => {
          scheduleMap.set(schedule.schedule_date, {
            schedule_date: schedule.schedule_date,
            subuh_preacher_id: schedule.subuh_preacher_id,
            maghrib_preacher_id: schedule.maghrib_preacher_id,
            notes: schedule.notes || ''
          });
        });
        setSchedules(scheduleMap);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateCalendar = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days: CalendarDay[] = [];
    const currentDateIter = new Date(startDate);

    // Generate 6 weeks (42 days) to cover all possible month layouts
    for (let i = 0; i < 42; i++) {
      const dateString = currentDateIter.toISOString().split('T')[0];
      const isCurrentMonth = currentDateIter.getMonth() === month - 1;

      days.push({
        date: new Date(currentDateIter),
        dateString,
        isCurrentMonth,
        subuh_preacher_id: null,
        maghrib_preacher_id: null,
        notes: ''
      });

      currentDateIter.setDate(currentDateIter.getDate() + 1);
    }

    setCalendarDays(days);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handlePreacherChange = (
    dateString: string,
    type: 'subuh' | 'maghrib',
    preacherId: number | null
  ) => {
    const newSchedules = new Map(schedules);
    const existing = newSchedules.get(dateString) || {
      schedule_date: dateString,
      subuh_preacher_id: null,
      maghrib_preacher_id: null,
      notes: ''
    };

    if (type === 'subuh') {
      existing.subuh_preacher_id = preacherId;
    } else {
      existing.maghrib_preacher_id = preacherId;
    }

    newSchedules.set(dateString, existing);
    setSchedules(newSchedules);
  };

  const handleSaveSchedules = async () => {
    if (session?.user?.role !== 'head_imam') {
      setError('Only Head Imam can save preacher schedules');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const schedulesArray = Array.from(schedules.values()).filter(
        (schedule) => schedule.subuh_preacher_id || schedule.maghrib_preacher_id
      );

      const response = await fetch('/api/preacher-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: schedulesArray })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        fetchSchedules();
      } else {
        setError(data.error || 'Failed to save schedules');
      }
    } catch (err) {
      setError('Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getPreacherName = (preacherId: number | null): string => {
    if (!preacherId) return '-';
    const preacher = preachers.find((p) => p.id === preacherId);
    return preacher ? preacher.name : '-';
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

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 no-print">
        <h1>Preacher Schedules - {monthName}</h1>
        <div className="btn-group">
          <button
            className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('calendar')}
          >
            <i className="bi bi-calendar-month me-2"></i>
            Calendar View
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('list')}
          >
            <i className="bi bi-list-ul me-2"></i>
            List View
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show no-print" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show no-print" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button className="btn btn-outline-secondary no-print" onClick={handlePreviousMonth}>
              <i className="bi bi-chevron-left"></i> Previous
            </button>
            <h3 className="mb-0">{monthName}</h3>
            <button className="btn btn-outline-secondary no-print" onClick={handleNextMonth}>
              Next <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          {viewMode === 'calendar' ? (
            <div className="table-responsive">
              <table className="table table-bordered calendar-table">
                <thead>
                  <tr>
                    <th>Sunday</th>
                    <th>Monday</th>
                    <th>Tuesday</th>
                    <th>Wednesday</th>
                    <th>Thursday</th>
                    <th>Friday</th>
                    <th>Saturday</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, weekIndex) => (
                    <tr key={weekIndex}>
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const dayData = calendarDays[weekIndex * 7 + dayIndex];
                        if (!dayData) return null;

                        const schedule = schedules.get(dayData.dateString);
                        const isHeadImam = session?.user?.role === 'head_imam';

                        return (
                          <td
                            key={dayIndex}
                            className={`calendar-day ${!dayData.isCurrentMonth ? 'other-month' : ''}`}
                          >
                            <div className="day-number">
                              {dayData.date.getDate()}
                            </div>
                            {dayData.isCurrentMonth && (
                              <div className="preacher-slots">
                                <div className="slot mb-2">
                                  <small className="text-muted d-block">Subuh</small>
                                  {isHeadImam ? (
                                    <select
                                      className="form-select form-select-sm"
                                      value={schedule?.subuh_preacher_id || ''}
                                      onChange={(e) =>
                                        handlePreacherChange(
                                          dayData.dateString,
                                          'subuh',
                                          e.target.value ? parseInt(e.target.value) : null
                                        )
                                      }
                                    >
                                      <option value="">-</option>
                                      {preachers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="small">
                                      {getPreacherName(schedule?.subuh_preacher_id || null)}
                                    </div>
                                  )}
                                </div>
                                <div className="slot">
                                  <small className="text-muted d-block">Maghrib</small>
                                  {isHeadImam ? (
                                    <select
                                      className="form-select form-select-sm"
                                      value={schedule?.maghrib_preacher_id || ''}
                                      onChange={(e) =>
                                        handlePreacherChange(
                                          dayData.dateString,
                                          'maghrib',
                                          e.target.value ? parseInt(e.target.value) : null
                                        )
                                      }
                                    >
                                      <option value="">-</option>
                                      {preachers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="small">
                                      {getPreacherName(schedule?.maghrib_preacher_id || null)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Subuh Preacher</th>
                    <th>Maghrib Preacher</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarDays
                    .filter((day) => day.isCurrentMonth)
                    .map((day) => {
                      const schedule = schedules.get(day.dateString);
                      const isHeadImam = session?.user?.role === 'head_imam';
                      const dayName = day.date.toLocaleDateString('en-US', { weekday: 'long' });

                      return (
                        <tr key={day.dateString}>
                          <td>{day.date.getDate()}</td>
                          <td>{dayName}</td>
                          <td>
                            {isHeadImam ? (
                              <select
                                className="form-select"
                                value={schedule?.subuh_preacher_id || ''}
                                onChange={(e) =>
                                  handlePreacherChange(
                                    day.dateString,
                                    'subuh',
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              >
                                <option value="">-</option>
                                {preachers.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              getPreacherName(schedule?.subuh_preacher_id || null)
                            )}
                          </td>
                          <td>
                            {isHeadImam ? (
                              <select
                                className="form-select"
                                value={schedule?.maghrib_preacher_id || ''}
                                onChange={(e) =>
                                  handlePreacherChange(
                                    day.dateString,
                                    'maghrib',
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              >
                                <option value="">-</option>
                                {preachers.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              getPreacherName(schedule?.maghrib_preacher_id || null)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {session?.user?.role === 'head_imam' && (
            <div className="mt-3 d-flex gap-2 no-print">
              <button
                className="btn btn-primary"
                onClick={handleSaveSchedules}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-save me-2"></i>
                    Save Schedules
                  </>
                )}
              </button>
              <button className="btn btn-outline-secondary" onClick={handlePrint}>
                <i className="bi bi-printer me-2"></i>
                Print
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .calendar-table {
          table-layout: fixed;
        }
        .calendar-day {
          height: 150px;
          vertical-align: top;
          padding: 8px;
        }
        .calendar-day.other-month {
          background-color: #f8f9fa;
          opacity: 0.5;
        }
        .day-number {
          font-weight: bold;
          margin-bottom: 8px;
        }
        .preacher-slots {
          font-size: 0.875rem;
        }
        .slot select {
          font-size: 0.75rem;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .calendar-table {
            font-size: 0.75rem;
          }
          .calendar-day {
            height: auto;
            page-break-inside: avoid;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}
