'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Schedule, User } from '@/types';
import { getUserColor } from '@/lib/userColors';

export default function ManageSchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [imams, setImams] = useState<User[]>([]);
  const [bilals, setBilals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});
  const [editValues, setEditValues] = useState<{ [key: string]: { imam_id: number; bilal_id: number } }>({});
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(null);
  const [unavailability, setUnavailability] = useState<Map<string, Set<number>>>(new Map());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session) {
      const role = (session.user as any).role;
      if (role !== 'head_imam' && role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session) {
      fetchData();
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

  const fetchData = async () => {
    setLoading(true);
    const wednesday = getWednesday(selectedWeek);
    const tuesday = new Date(wednesday);
    tuesday.setDate(wednesday.getDate() + 6);

    const startDate = formatDateOnly(wednesday);
    const endDate = formatDateOnly(tuesday);

    try {
      const [schedulesRes, imamsRes, bilalsRes, unavailabilityRes] = await Promise.all([
        fetch(`/api/schedules?start_date=${startDate}&end_date=${endDate}`),
        fetch('/api/users?role=imam'),
        fetch('/api/users?role=bilal'),
        fetch(`/api/availability?start_date=${startDate}&end_date=${endDate}&is_available=false`),
      ]);

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setSchedules(schedulesData);
      }
      if (imamsRes.ok) setImams(await imamsRes.json());
      if (bilalsRes.ok) setBilals(await bilalsRes.json());

      if (unavailabilityRes.ok) {
        const unavailabilityData = await unavailabilityRes.json();
        // Build a map: "date_prayerTime" -> Set of unavailable user IDs
        const unavailMap = new Map<string, Set<number>>();
        unavailabilityData.forEach((item: any) => {
          const dateStr = typeof item.date === 'string'
            ? item.date.split('T')[0]
            : item.date;
          const key = `${dateStr}_${item.prayer_time}`;
          if (!unavailMap.has(key)) {
            unavailMap.set(key, new Set());
          }
          unavailMap.get(key)!.add(item.user_id);
        });
        setUnavailability(unavailMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSchedule = async () => {
    const wednesday = getWednesday(selectedWeek);
    const startDate = formatDateOnly(wednesday);

    try {
      const response = await fetch('/api/schedules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate }),
      });

      if (response.ok) {
        showAlert('success', 'Schedule generated successfully!');
        fetchData();
      } else {
        const error = await response.json();
        showAlert('danger', error.error || 'Failed to generate schedule');
      }
    } catch (error) {
      showAlert('danger', 'Error generating schedule');
    }
  };

  const enableEdit = (scheduleId: number, imamId: number, bilalId: number) => {
    setEditMode({ ...editMode, [scheduleId]: true });
    setEditValues({ ...editValues, [scheduleId]: { imam_id: imamId, bilal_id: bilalId } });
  };

  const cancelEdit = (scheduleId: number) => {
    const newEditMode = { ...editMode };
    delete newEditMode[scheduleId];
    setEditMode(newEditMode);
  };

  const saveEdit = async (scheduleId: number) => {
    const values = editValues[scheduleId];
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        showAlert('success', 'Schedule updated successfully!');
        fetchData();
        cancelEdit(scheduleId);
      } else {
        showAlert('danger', 'Failed to update schedule');
      }
    } catch (error) {
      showAlert('danger', 'Error updating schedule');
    }
  };

  const deleteWeekSchedules = async () => {
    if (schedules.length === 0) {
      showAlert('warning', 'No schedules to delete for this week');
      return;
    }

    if (!confirm(`Are you sure you want to delete ALL ${schedules.length} schedules for this week? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);

      // Delete all schedules for the week
      const deletePromises = schedules.map(schedule =>
        fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        showAlert('success', `Successfully deleted ${successCount} schedules for this week!`);
      } else if (successCount > 0) {
        showAlert('warning', `Deleted ${successCount} schedules, but ${failCount} failed to delete`);
      } else {
        showAlert('danger', 'Failed to delete schedules');
      }

      fetchData();
    } catch (error) {
      console.error('Error deleting schedules:', error);
      showAlert('danger', 'Error deleting schedules');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
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
    return schedules.find((s) => s.date.split('T')[0] === date && s.prayer_time === prayerTime);
  };

  const getAvailableUsers = (date: string, prayerTime: string, role: 'imam' | 'bilal') => {
    const key = `${date}_${prayerTime}`;
    const unavailableIds = unavailability.get(key) || new Set();
    const users = role === 'imam' ? imams : bilals;
    return users.filter(user => !unavailableIds.has(user.id));
  };

  if (status === 'loading' || !session) {
    return (
      <div className="loading">
        <div className="spinner-border text-success" role="status"></div>
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
        {alert && (
          <div className={`alert alert-${alert.type} alert-custom`} role="alert">
            {alert.message}
          </div>
        )}

        <div className="row mb-4">
          <div className="col-md-8">
            <h2>Manage Prayer Schedule</h2>
            <p className="text-muted">
              Week: {wednesday.toLocaleDateString()} - {tuesday.toLocaleDateString()}
            </p>
          </div>
          <div className="col-md-4 text-end">
            <button className="btn btn-success me-2" onClick={generateSchedule}>
              Generate Schedule
            </button>
            {schedules.length > 0 && (
              <button className="btn btn-danger" onClick={deleteWeekSchedules}>
                Delete Week
              </button>
            )}
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between">
              <button className="btn btn-secondary" onClick={() => changeWeek(-1)}>
                &larr; Previous Week
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedWeek(new Date())}>
                Current Week
              </button>
              <button className="btn btn-secondary" onClick={() => changeWeek(1)}>
                Next Week &rarr;
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner-border text-success" role="status"></div>
          </div>
        ) : (
          <>
            {/* Color Legend with Count */}
            {schedules.length > 0 && (
              <div className="card mb-3">
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
            )}

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
                          const isEditing = schedule && editMode[schedule.id];
                          const availableImams = getAvailableUsers(date, prayer, 'imam');
                          const availableBilals = getAvailableUsers(date, prayer, 'bilal');

                          return (
                            <td key={`${date}-${prayer}`}>
                              {schedule ? (
                                isEditing ? (
                                  <div>
                                    <select
                                      className="form-select form-select-sm mb-2"
                                      value={editValues[schedule.id]?.imam_id}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          [schedule.id]: {
                                            ...editValues[schedule.id],
                                            imam_id: parseInt(e.target.value),
                                          },
                                        })
                                      }
                                    >
                                      {availableImams.map((imam) => (
                                        <option key={imam.id} value={imam.id}>
                                          {imam.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="form-select form-select-sm mb-2"
                                      value={editValues[schedule.id]?.bilal_id}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          [schedule.id]: {
                                            ...editValues[schedule.id],
                                            bilal_id: parseInt(e.target.value),
                                          },
                                        })
                                      }
                                    >
                                      {availableBilals.map((bilal) => (
                                        <option key={bilal.id} value={bilal.id}>
                                          {bilal.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      className="btn btn-sm btn-success me-1"
                                      onClick={() => saveEdit(schedule.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => cancelEdit(schedule.id)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
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
                                    <button
                                      className="btn btn-sm btn-primary mt-2"
                                      onClick={() =>
                                        enableEdit(schedule.id, schedule.imam_id, schedule.bilal_id)
                                      }
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )
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
