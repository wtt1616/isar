'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Schedule, User } from '@/types';
import { getUserColor } from '@/lib/userColors';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [imams, setImams] = useState<User[]>([]);
  const [bilals, setBilals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchSchedules();
    }
  }, [session, selectedWeek]);

  const getWednesday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Calculate days to Wednesday (day 3)
    // If today is Wednesday (3), diff = 0
    // If today is Thursday (4) or later, go back to previous Wednesday
    // If today is before Wednesday, go forward to next Wednesday
    const diff = day === 0 ? 3 : day <= 3 ? 3 - day : -(day - 3);
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
    setLoading(true);
    const wednesday = getWednesday(selectedWeek);
    const tuesday = new Date(wednesday);
    tuesday.setDate(wednesday.getDate() + 6);

    const startDate = formatDateOnly(wednesday);
    const endDate = formatDateOnly(tuesday);

    try {
      const [schedulesRes, imamsRes, bilalsRes] = await Promise.all([
        fetch(`/api/schedules?start_date=${startDate}&end_date=${endDate}`),
        fetch('/api/users?role=imam'),
        fetch('/api/users?role=bilal'),
      ]);

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data);
      }
      if (imamsRes.ok) setImams(await imamsRes.json());
      if (bilalsRes.ok) setBilals(await bilalsRes.json());
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  if (status === 'loading' || !session) {
    return (
      <div className="loading">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const days = getDaysOfWeek();
  const prayerTimes = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];
  const wednesday = getWednesday(selectedWeek);
  const tuesday = new Date(wednesday);
  tuesday.setDate(wednesday.getDate() + 6);

  return (
    <>
      <Navbar />
      <div className="container mt-4">
        <div className="row mb-4 no-print">
          <div className="col-md-8">
            <h2>Prayer Schedule</h2>
            <p className="text-muted">
              Week: {wednesday.toLocaleDateString()} - {tuesday.toLocaleDateString()}
            </p>
          </div>
          <div className="col-md-4 text-end">
            <button className="btn btn-outline-success me-2" onClick={handlePrint}>
              <i className="bi bi-printer"></i> Print Schedule
            </button>
          </div>
        </div>

        <div className="card mb-4 no-print">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <button
                className="btn btn-secondary"
                onClick={() => changeWeek(-1)}
              >
                &larr; Previous Week
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setSelectedWeek(new Date())}
              >
                Current Week
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => changeWeek(1)}
              >
                Next Week &rarr;
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner-border text-success" role="status"></div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="alert alert-warning">
            No schedule available for this week.
          </div>
        ) : (
          <>
            {/* Color Legend with Count */}
            <div className="card mb-3 no-print">
              <div className="card-header">
                <h5 className="mb-0">Color Legend & Weekly Distribution</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Imams</h6>
                    <div className="d-flex flex-wrap gap-2">
                      {(() => {
                        // Count occurrences of each imam
                        const imamCounts = new Map<number, number>();
                        schedules.forEach(s => {
                          imamCounts.set(s.imam_id, (imamCounts.get(s.imam_id) || 0) + 1);
                        });

                        return Array.from(imamCounts.entries()).map(([imamId, count]) => {
                          const imam = imams.find(i => i.id === imamId);
                          if (!imam) return null;
                          const color = getUserColor(imamId);
                          return (
                            <div
                              key={imamId}
                              className="px-3 py-2 rounded d-flex align-items-center gap-2"
                              style={{
                                backgroundColor: color.bg,
                                color: color.text,
                                border: `2px solid ${color.border}`,
                              }}
                            >
                              <span>{imam.name}</span>
                              <span className="badge bg-dark">{count}x</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6>Bilals</h6>
                    <div className="d-flex flex-wrap gap-2">
                      {(() => {
                        // Count occurrences of each bilal
                        const bilalCounts = new Map<number, number>();
                        schedules.forEach(s => {
                          bilalCounts.set(s.bilal_id, (bilalCounts.get(s.bilal_id) || 0) + 1);
                        });

                        return Array.from(bilalCounts.entries()).map(([bilalId, count]) => {
                          const bilal = bilals.find(b => b.id === bilalId);
                          if (!bilal) return null;
                          const color = getUserColor(bilalId);
                          return (
                            <div
                              key={bilalId}
                              className="px-3 py-2 rounded d-flex align-items-center gap-2"
                              style={{
                                backgroundColor: color.bg,
                                color: color.text,
                                border: `2px solid ${color.border}`,
                              }}
                            >
                              <span>{bilal.name}</span>
                              <span className="badge bg-dark">{count}x</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="table-responsive">
                <table className="table table-bordered prayer-schedule-table">
                  <thead>
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
                        <td className="prayer-time-cell">{prayer}</td>
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
                                    className="mb-2 p-2 rounded"
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
          </>
        )}
      </div>
    </>
  );
}
