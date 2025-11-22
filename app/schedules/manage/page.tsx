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
  const [sendingReminders, setSendingReminders] = useState(false);

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
    // Calculate days to Wednesday (day 3) for the week containing this date
    // Week runs from Wednesday to Tuesday
    // If today is Wednesday (3), Thursday (4), Friday (5), Saturday (6): use this week's Wednesday
    // If today is Sunday (0), Monday (1), Tuesday (2): use this week's Wednesday (which is ahead)
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

  const copySchedule = async () => {
    const wednesday = getWednesday(selectedWeek);
    const startDate = formatDateOnly(wednesday);

    try {
      setLoading(true);
      const response = await fetch('/api/schedules/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.conflictCount > 0) {
          showAlert(
            'warning',
            `Schedule copied successfully! ${result.conflictCount} slot(s) have conflicts and are marked with a red star. Please manually assign Imam/Bilal for these slots.`
          );
        } else {
          showAlert('success', 'Schedule copied successfully from previous week!');
        }
        fetchData();
      } else {
        const error = await response.json();
        showAlert('danger', error.error || 'Failed to copy schedule');
      }
    } catch (error) {
      showAlert('danger', 'Error copying schedule');
    } finally {
      setLoading(false);
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

  const saveAllEdits = async () => {
    // Collect all schedules in edit mode
    const editedScheduleIds = Object.keys(editMode).filter(id => editMode[id]);

    if (editedScheduleIds.length === 0) {
      showAlert('warning', 'No schedules to save');
      return;
    }

    // Build updates array
    const updates = editedScheduleIds.map(id => ({
      id: parseInt(id),
      imam_id: editValues[id].imam_id,
      bilal_id: editValues[id].bilal_id,
    }));

    try {
      setLoading(true);
      const response = await fetch('/api/schedules/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (response.ok) {
        const result = await response.json();
        showAlert('success', result.message || `Successfully saved ${updates.length} schedules!`);

        // Clear all edit modes
        setEditMode({});
        setEditValues({});

        // Refresh data
        fetchData();
      } else {
        const error = await response.json();
        showAlert('danger', error.error || 'Failed to save schedules');
      }
    } catch (error) {
      console.error('Error saving schedules:', error);
      showAlert('danger', 'Error saving schedules');
    } finally {
      setLoading(false);
    }
  };

  const cancelAllEdits = () => {
    setEditMode({});
    setEditValues({});
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

  const sendWeekReminders = async () => {
    if (schedules.length === 0) {
      showAlert('warning', 'No schedules to send reminders for');
      return;
    }

    if (!confirm(`Send WhatsApp reminders to all Imams and Bilals for this week (${schedules.length} schedules)?`)) {
      return;
    }

    try {
      setSendingReminders(true);

      const scheduleIds = schedules.map(s => s.id);

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_for_schedules',
          scheduleIds
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showAlert('success', result.message || `Sent ${result.sent} reminders successfully!`);
      } else {
        showAlert('danger', result.error || 'Failed to send reminders');
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      showAlert('danger', 'Error sending reminders. Please check WhatsApp configuration.');
    } finally {
      setSendingReminders(false);
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

  const getWeekDateRange = (weekOffset: number = 0) => {
    const targetDate = new Date(selectedWeek);
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);

    const wednesday = getWednesday(targetDate);
    const tuesday = new Date(wednesday);
    tuesday.setDate(wednesday.getDate() + 6);

    const formatShort = (date: Date) => {
      return date.toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'short'
      });
    };

    return `${formatShort(wednesday)} - ${formatShort(tuesday)}`;
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
            <div className="d-flex align-items-center mb-2">
              <i className="bi bi-calendar-range me-3" style={{ fontSize: '2.5rem', color: '#059669' }}></i>
              <div>
                <h2 className="mb-1">Manage Prayer Schedule</h2>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                  <i className="bi bi-calendar3 me-2"></i>
                  {wednesday.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} - {tuesday.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-4 text-end d-flex align-items-center justify-content-end gap-2 flex-wrap">
            <button className="btn btn-success d-flex align-items-center" onClick={generateSchedule}>
              <i className="bi bi-magic me-2"></i>Generate
            </button>
            <button className="btn btn-info d-flex align-items-center" onClick={copySchedule}>
              <i className="bi bi-files me-2"></i>Copy
            </button>
            {schedules.length > 0 && (
              <>
                <button
                  className="btn btn-primary d-flex align-items-center"
                  onClick={sendWeekReminders}
                  disabled={sendingReminders}
                >
                  {sendingReminders ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-whatsapp me-2"></i>Send Reminders
                    </>
                  )}
                </button>
                <button className="btn btn-danger d-flex align-items-center" onClick={deleteWeekSchedules}>
                  <i className="bi bi-trash me-2"></i>Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-sm-6">
            <div className="card h-100" style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: 'none',
              color: 'white'
            }}>
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="mb-0 opacity-75 small">Total Schedules</p>
                    <h4 className="mb-0 fw-bold" style={{ color: 'white' }}>{schedules.length}</h4>
                  </div>
                  <i className="bi bi-calendar-check" style={{ fontSize: '2rem', opacity: '0.3' }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card h-100" style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              color: 'white'
            }}>
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="mb-0 opacity-75 small">Editing</p>
                    <h4 className="mb-0 fw-bold" style={{ color: 'white' }}>{Object.keys(editMode).filter(id => editMode[id]).length}</h4>
                  </div>
                  <i className="bi bi-pencil-square" style={{ fontSize: '2rem', opacity: '0.3' }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card h-100" style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
              color: 'white'
            }}>
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="mb-0 opacity-75 small">Available Imams</p>
                    <h4 className="mb-0 fw-bold" style={{ color: 'white' }}>{imams.filter(u => u.is_active).length}</h4>
                  </div>
                  <i className="bi bi-person-badge" style={{ fontSize: '2rem', opacity: '0.3' }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card h-100" style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              color: 'white'
            }}>
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <p className="mb-0 opacity-75 small">Available Bilals</p>
                    <h4 className="mb-0 fw-bold" style={{ color: 'white' }}>{bilals.filter(u => u.is_active).length}</h4>
                  </div>
                  <i className="bi bi-person-check" style={{ fontSize: '2rem', opacity: '0.3' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Batch Edit Actions */}
        {Object.keys(editMode).some(id => editMode[id]) && (
          <div className="alert alert-info d-flex justify-content-between align-items-center" role="alert">
            <span>
              <strong>{Object.keys(editMode).filter(id => editMode[id]).length}</strong> schedule(s) in edit mode
            </span>
            <div>
              <button className="btn btn-primary me-2" onClick={saveAllEdits}>
                Save All Changes
              </button>
              <button className="btn btn-secondary" onClick={cancelAllEdits}>
                Cancel All
              </button>
            </div>
          </div>
        )}

        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between gap-2 flex-wrap">
              <button className="btn btn-secondary d-flex flex-column align-items-center" onClick={() => changeWeek(-1)} style={{ flex: '1 1 auto', minHeight: '60px' }}>
                <div>&larr; Previous Week</div>
                <small className="text-white-50 mt-1">{getWeekDateRange(-1)}</small>
              </button>
              <button className="btn btn-primary d-flex flex-column align-items-center" onClick={() => setSelectedWeek(new Date())} style={{ flex: '1 1 auto', minHeight: '60px' }}>
                <div>Current Week</div>
                <small className="text-white-50 mt-1">{getWeekDateRange(0)}</small>
              </button>
              <button className="btn btn-secondary d-flex flex-column align-items-center" onClick={() => changeWeek(1)} style={{ flex: '1 1 auto', minHeight: '60px' }}>
                <div>Next Week &rarr;</div>
                <small className="text-white-50 mt-1">{getWeekDateRange(1)}</small>
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
                                      value={editValues[schedule.id]?.imam_id || ''}
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
                                      <option value="">-- Select Imam --</option>
                                      {availableImams.map((imam) => (
                                        <option key={imam.id} value={imam.id}>
                                          {imam.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="form-select form-select-sm mb-2"
                                      value={editValues[schedule.id]?.bilal_id || ''}
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
                                      <option value="">-- Select Bilal --</option>
                                      {availableBilals.map((bilal) => (
                                        <option key={bilal.id} value={bilal.id}>
                                          {bilal.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      className="btn btn-sm btn-secondary btn-sm w-100"
                                      onClick={() => cancelEdit(schedule.id)}
                                    >
                                      Cancel
                                    </button>
                                    <small className="text-muted d-block mt-1">
                                      Click "Save All Changes" to save
                                    </small>
                                  </div>
                                ) : (
                                  <div>
                                    {/* Red star indicator for vacant slots */}
                                    {(schedule.imam_id === null || schedule.bilal_id === null) && (
                                      <div className="text-center mb-2">
                                        <i
                                          className="bi bi-star-fill"
                                          style={{ color: 'red', fontSize: '1.5rem' }}
                                          title="Vacant - Please assign manually"
                                        ></i>
                                      </div>
                                    )}

                                    <div
                                      className="mb-2 p-2 rounded"
                                      style={{
                                        backgroundColor: schedule.imam_id ? getUserColor(schedule.imam_id).bg : '#f8f9fa',
                                        color: schedule.imam_id ? getUserColor(schedule.imam_id).text : '#6c757d',
                                        border: `2px solid ${schedule.imam_id ? getUserColor(schedule.imam_id).border : '#dee2e6'}`,
                                      }}
                                    >
                                      <strong>Imam:</strong> {schedule.imam_name || <span className="text-danger">VACANT</span>}
                                    </div>
                                    <div
                                      className="mb-2 p-2 rounded"
                                      style={{
                                        backgroundColor: schedule.bilal_id ? getUserColor(schedule.bilal_id).bg : '#f8f9fa',
                                        color: schedule.bilal_id ? getUserColor(schedule.bilal_id).text : '#6c757d',
                                        border: `2px solid ${schedule.bilal_id ? getUserColor(schedule.bilal_id).border : '#dee2e6'}`,
                                      }}
                                    >
                                      <strong>Bilal:</strong> {schedule.bilal_name || <span className="text-danger">VACANT</span>}
                                    </div>
                                    <button
                                      className="btn btn-sm btn-primary mt-2"
                                      onClick={() =>
                                        enableEdit(schedule.id, schedule.imam_id || 0, schedule.bilal_id || 0)
                                      }
                                    >
                                      {(schedule.imam_id === null || schedule.bilal_id === null) ? 'Assign' : 'Edit'}
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

            {/* Color Legend with Count - Moved below table */}
            {schedules.length > 0 && (
              <div className="card mt-3">
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
          </>
        )}
      </div>
    </>
  );
}
