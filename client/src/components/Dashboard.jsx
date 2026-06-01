import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Bell, LogOut, CheckCircle, Circle, Calendar as CalendarIcon, X,
    ChevronDown, ChevronUp, Flag, FileText, Home, Search, Settings, Zap, Layout, Github, StickyNote, Edit3
} from 'lucide-react';
import ItemDetailOverlay from './ItemDetailOverlay';
import Calendar from './Calendar';
import MiniCalendar from './MiniCalendar';
import NotificationCenter from './NotificationCenter';
import Notes from './Notes';
import { parseTaskString, formatDeadline, isOverdue } from '../utils/parser';

// Returns a compact "time left" string: "3d", "5h", "20m", "overdue"
const getTimeLeft = (dateStr, isEvent = false, completed = false, missed = false) => {
    if (completed || missed || !dateStr) return null;
    const now = new Date();
    const target = new Date(dateStr);

    if (isEvent) {
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffMs = target - now;
        if (diffMs < 0) return 'overdue';
        if (diffMs === 0) return 'Today';
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return `${diffDays}d`;
    }

    const diffMs = target - now;
    if (diffMs <= 0) return 'overdue';

    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 1 || diffMs > 24 * 60 * 60 * 1000) {
        return `${diffDays}d`;
    }

    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs >= 1) return `${diffHrs}h`;

    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins}m`;
};
import { io } from 'socket.io-client';
import Footer from './Footer';
import { IoSearchCircleSharp } from "react-icons/io5";
import { User as UserIcon } from 'lucide-react';
import { TaskSkeleton, EventSkeleton } from './Skeleton';

const Avatar = ({ src, name, size = 'medium' }) => {
    const className = size === 'large' ? 'user-avatar-large' : 'user-avatar';
    const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    return (
        <div className={className} style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {src ? (
                <img
                    key={src}
                    src={src}
                    alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
            ) : null}
            <div className="avatar-fallback" style={{ display: src ? 'none' : 'flex' }}>
                {initials || <UserIcon size={size === 'large' ? 40 : 24} />}
            </div>
        </div>
    );
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const toLocalISOString = (date, timezone) => {
    if (!date) return '';
    const d = new Date(date);
    const options = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const Dashboard = ({ user, setUser, registerPushNotifications }) => {
    const [tasks, setTasks] = useState([]);
    const [events, setEvents] = useState([]);
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentView, setCurrentView] = useState('Home'); // Home, Calendar, Schedule, Profile
    const [isAdding, setIsAdding] = useState(false);
    const [isNotifying, setIsNotifying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [quickInput, setQuickInput] = useState('');
    const [draftItem, setDraftItem] = useState({ title: '', type: 'task', deadline: '', start: '', priority: 'Medium', notes: '' });
    const [editingId, setEditingId] = useState(null);
    const [hasManuallyChangedType, setHasManuallyChangedType] = useState(false);
    const [viewingItem, setViewingItem] = useState(null); // item to show in detail overlay
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [planTasks, setPlanTasks] = useState([]);
    const [skippedReviewIds, setSkippedReviewIds] = useState([]);
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('planory_notifications');
        return saved ? JSON.parse(saved) : [];
    });
    const [unreadCount, setUnreadCount] = useState(() => {
        const saved = localStorage.getItem('planory_unread_count');
        return saved ? parseInt(saved) : 0;
    });

    useEffect(() => {
        if (isAdding && !editingId) {
            setHasManuallyChangedType(false);
        }
    }, [isAdding, editingId]);

    useEffect(() => {
        localStorage.setItem('planory_notifications', JSON.stringify(notifications));
        localStorage.setItem('planory_unread_count', unreadCount.toString());
    }, [notifications, unreadCount]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const handleMessage = (event) => {
                if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
                    const newNotify = {
                        itemId: event.data.payload.data?.tag || null,
                        title: event.data.payload.title,
                        body: event.data.payload.body,
                        type: event.data.payload.tag?.includes('event') ? 'event' : event.data.payload.tag?.includes('missed') ? 'missed' : 'task',
                        timestamp: new Date().toISOString()
                    };
                    setNotifications(prev => [newNotify, ...prev].slice(0, 50));
                    setUnreadCount(prev => prev + 1);
                } else if (event.data && event.data.type === 'CLEAR_NOTIFICATION') {
                    const { itemId } = event.data;
                    if (itemId) {
                        setNotifications(prev => prev.filter(n => n.itemId !== itemId));
                    }
                }
            };
            navigator.serviceWorker.addEventListener('message', handleMessage);
            return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
        }
    }, []);

    useEffect(() => {
        if (user.user.nightMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [user.user.nightMode]);

    useEffect(() => {
        let retryTimeoutId = null;
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [tasksRes, eventsRes, notesRes] = await Promise.all([
                    fetch(`${API_URL}/api/tasks`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/api/events`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/api/notes`, { headers: { 'Authorization': `Bearer ${user.token}` } })
                ]);
                if (tasksRes.status === 401 || eventsRes.status === 401 || notesRes.status === 401) {
                    if (isMounted) setUser(null);
                    return;
                }
                if (tasksRes.ok && eventsRes.ok && notesRes.ok) {
                    const [tData, eData, nData] = await Promise.all([
                        tasksRes.json(),
                        eventsRes.json(),
                        notesRes.json()
                    ]);
                    if (isMounted) {
                        setTasks(tData);
                        setEvents(eData);
                        setNotes(nData);
                        setIsLoading(false);
                    }
                } else {
                    throw new Error('Server returned non-ok status');
                }
            } catch (err) {
                console.error('Fetch failed, retrying in 5s...', err);
                if (isMounted) {
                    retryTimeoutId = setTimeout(fetchData, 5000);
                }
            }
        };
        fetchData();

        // Setup Socket.io connection
        const socket = io(API_URL, {
            auth: { token: user.token }
        });

        socket.on('connect', () => {
            console.log('Socket connected, fetching data...');
            if (retryTimeoutId) {
                clearTimeout(retryTimeoutId);
                retryTimeoutId = null;
            }
            fetchData();
        });

        socket.on('taskCreated', (task) => {
            setTasks(prev => {
                if (prev.some(t => t.id === task.id)) return prev; // Prevent duplicates if we made the request
                return [task, ...prev];
            });
        });

        socket.on('taskUpdated', (task) => {
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        });

        socket.on('taskDeleted', (taskId) => {
            setTasks(prev => prev.filter(t => t.id !== taskId));
        });

        socket.on('eventCreated', (event) => {
            setEvents(prev => {
                if (prev.some(e => e.id === event.id)) return prev; // Prevent duplicates
                return [event, ...prev];
            });
        });

        socket.on('eventUpdated', (event) => {
            setEvents(prev => prev.map(e => e.id === event.id ? event : e));
        });

        socket.on('eventDeleted', (eventId) => {
            setEvents(prev => prev.filter(e => e.id !== eventId));
        });

        socket.on('noteCreated', (note) => {
            setNotes(prev => {
                if (prev.some(n => n.id === note.id)) return prev;
                return [...prev, note].sort((a, b) => a.order - b.order);
            });
        });

        socket.on('noteUpdated', (note) => {
            setNotes(prev => prev.map(n => n.id === note.id ? note : n).sort((a, b) => a.order - b.order));
        });

        socket.on('noteDeleted', (noteId) => {
            setNotes(prev => prev.filter(n => n.id !== noteId));
        });

        socket.on('notesReordered', (updates) => {
            setNotes(prev => {
                let updated = [...prev];
                updates.forEach(u => {
                    const idx = updated.findIndex(n => n.id === u.id);
                    if (idx !== -1) updated[idx] = { ...updated[idx], order: u.order };
                });
                return updated.sort((a, b) => a.order - b.order);
            });
        });

        return () => {
            isMounted = false;
            if (retryTimeoutId) clearTimeout(retryTimeoutId);
            socket.disconnect();
        };
    }, [user.token]);

    // Update draftItem when quickInput changes using the parser
    useEffect(() => {
        if (quickInput && !editingId) {
            const parsed = parseTaskString(quickInput);
            setDraftItem(prev => {
                const actualType = hasManuallyChangedType ? prev.type : parsed.type;
                return {
                    ...prev,
                    title: parsed.title,
                    deadline: actualType === 'task' ? (parsed.deadline || prev.deadline) : '',
                    start: actualType === 'event' ? (parsed.deadline || prev.start) : '',
                    type: actualType,
                    priority: parsed.priority
                };
            });
        }
    }, [quickInput, editingId, hasManuallyChangedType]);

    const saveItem = async () => {
        if (!draftItem.title.trim()) return;
        const isTask = draftItem.type === 'task';
        const endpoint = isTask ? 'tasks' : 'events';

        // Ensure dates are sent in ISO UTC format to the server
        const deadlineDate = draftItem.deadline ? new Date(draftItem.deadline) : null;
        const startDate = draftItem.start ? new Date(draftItem.start) : null;

        const payload = isTask
            ? { ...draftItem, deadline: deadlineDate ? deadlineDate.toISOString() : null }
            : { ...draftItem, start: startDate ? startDate.toISOString() : (deadlineDate ? deadlineDate.toISOString() : null) };

        const method = editingId ? 'PUT' : 'POST';
        const url = `${API_URL}/api/${endpoint}${editingId ? `/${editingId}` : ''}`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const saved = await response.json();
                if (editingId) {
                    if (isTask) setTasks(prev => prev.map(t => t.id === editingId ? saved : t));
                    else setEvents(prev => prev.map(e => e.id === editingId ? saved : e));
                } else {
                    if (isTask) setTasks([saved, ...tasks]);
                    else setEvents([saved, ...events]);
                }
                closeForm();
            }
        } catch (err) { }
    };

    const closeForm = () => {
        setIsAdding(false);
        setEditingId(null);
        setQuickInput('');
        setDraftItem({ title: '', type: 'task', deadline: '', start: '', priority: 'Medium', notes: '' });
        setHasManuallyChangedType(false);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setDraftItem({
            title: item.title,
            type: item.type,
            deadline: item.deadline || '',
            start: item.start || '',
            priority: item.priority,
            notes: item.notes || ''
        });
        setHasManuallyChangedType(true);
        setIsAdding(true);
    };

    const openDetail = (item) => {
        setViewingItem(item);
    };

    const deleteItem = async (id, type) => {
        const endpoint = type === 'event' ? 'events' : type === 'note' ? 'notes' : 'tasks';
        try {
            const response = await fetch(`${API_URL}/api/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (response.ok) {
                if (type === 'event') setEvents(prev => prev.filter(e => e.id !== id));
                else if (type === 'note') setNotes(prev => prev.filter(n => n.id !== id));
                else setTasks(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) { }
    };

    const toggleTaskComplete = async (task) => {
        const updated = { ...task, completed: !task.completed, missed: false };
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        try {
            await fetch(`${API_URL}/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ completed: updated.completed, missed: false })
            });
        } catch (err) { }
    };

    const handleReviewItem = async (item, status) => {
        const isTask = item.type === 'task';
        const endpoint = isTask ? 'tasks' : 'events';
        const payload = status === 'completed' 
            ? { completed: true, missed: false } 
            : { completed: false, missed: true };

        try {
            const response = await fetch(`${API_URL}/api/${endpoint}/${item.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${user.token}` 
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const saved = await response.json();
                if (isTask) {
                    setTasks(prev => prev.map(t => t.id === item.id ? saved : t));
                } else {
                    setEvents(prev => prev.map(e => e.id === item.id ? saved : e));
                }
            }
        } catch (err) {
            console.error('Failed to update review item status:', err);
        }
    };

    const skipReviewItem = (id) => {
        setSkippedReviewIds(prev => [...prev, id]);
    };

    const filteredItems = () => {
        const query = searchQuery.toLowerCase();
        const all = [
            ...tasks.map(t => ({ ...t, type: 'task' })),
            ...events.map(e => ({ ...e, type: 'event' })),
            ...notes.map(n => ({ ...n, type: 'note' }))
        ];
        return all.filter(item => {
            const matchTitle = item.title && item.title.toLowerCase().includes(query);
            const matchNotes = item.notes && item.notes.toLowerCase().includes(query);
            const matchContent = item.content && item.content.toLowerCase().includes(query); // For Notes feature
            return matchTitle || matchNotes || matchContent;
        });
    };

    const openNotifications = () => {
        setUnreadCount(0);
        setIsNotifying(true);
    };

    const updateDailyReminder = async (updates) => {
        const defaults = { enabled: false, tasks: [{ text: 'Time for coding!', time: '12:00' }] };
        const newDailyReminder = { ...(user.user.dailyReminder || defaults), ...updates };
        setUser({ ...user, user: { ...user.user, dailyReminder: newDailyReminder } });
        try {
            await fetch(`${API_URL}/api/user/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ dailyReminder: newDailyReminder })
            });
        } catch (err) { }
    };

    const markDailyReminderDone = async () => {
        try {
            const res = await fetch(`${API_URL}/api/user/daily-reminder/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUser({ ...user, user: { ...user.user, dailyReminder: data.dailyReminder } });
            }
        } catch (err) { }
    };

    const isReminderDoneToday = () => {
        if (!user.user.dailyReminder?.lastCompletedDate) return false;
        const tz = user.user.timezone || 'UTC';
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
        const p = {};
        parts.forEach(part => p[part.type] = part.value);
        const todayStr = `${p.year}-${p.month}-${p.day}`;
        return user.user.dailyReminder.lastCompletedDate === todayStr;
    };

    const NavigationItems = () => (
        <>
            <button onClick={() => setCurrentView('Home')} className={`nav-item ${currentView === 'Home' ? 'active' : ''}`}>
                <Home size={22} /> <span>Overview</span>
            </button>
            <button onClick={() => setCurrentView('Calendar')} className={`nav-item ${currentView === 'Calendar' ? 'active' : ''}`}>
                <CalendarIcon size={22} /> <span>Calendar</span>
            </button>
            <button onClick={() => setCurrentView('Schedule')} className={`nav-item ${currentView === 'Schedule' ? 'active' : ''}`}>
                <Layout size={22} /> <span>Schedule</span>
            </button>
            <button onClick={() => setCurrentView('Notes')} className={`nav-item ${currentView === 'Notes' ? 'active' : ''}`}>
                <StickyNote size={22} /> <span>Notes</span>
            </button>
            <button onClick={() => setCurrentView('Profile')} className={`nav-item ${currentView === 'Profile' ? 'active' : ''}`}>
                <UserIcon size={22} /> <span>Profile</span>
            </button>
        </>
    );

    const renderOverview = () => {
        const pendingTasks = tasks.filter(t => !t.completed && !t.missed);
        const upcomingEvents = events.filter(e => !e.completed && !e.missed && new Date(e.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start));

        return (
            <div className="fade-in">
                <header className="dashboard-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            Hey {user.user.username}!
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.8rem, 3vw, 1rem)' }}>You have {pendingTasks.length} tasks and {upcomingEvents.length} events upcoming.</p>
                    </div>
                    <div onClick={() => setCurrentView('Profile')} style={{ cursor: 'pointer' }}>
                        <Avatar src={user.user.avatar} name={user.user.username} />
                    </div>
                </header>

                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Daily Reminder</h2>
                    </div>
                    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--glass-border)', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, marginRight: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>My Daily Plan</h3>
                                    <button
                                        onClick={() => {
                                            const tasks = user.user.dailyReminder?.tasks || [];
                                            // Normalize legacy string tasks to object format
                                            const normalized = tasks.map(t => typeof t === 'object' ? t : { text: t, time: '12:00' });
                                            setPlanTasks(normalized);
                                            setIsEditingPlan(true);
                                        }}
                                        style={{ background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.3rem 0.6rem', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}
                                    >
                                        <Edit3 size={14} /> Edit Plan
                                    </button>
                                </div>
                                {(user.user.dailyReminder?.tasks || []).length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', margin: 0 }}>No reminders set. Edit to add daily habits.</p>
                                ) : (
                                    <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {user.user.dailyReminder.tasks.map((t, idx) => {
                                            const taskText = typeof t === 'object' ? t.text : t;
                                            const taskTime = typeof t === 'object' ? t.time : (user.user.dailyReminder?.time || '12:00');
                                            return (
                                                <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                                    <Circle size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                                                    <span style={{ lineHeight: '1.4', flex: 1 }}>{taskText}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, background: 'rgba(242,109,91,0.1)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>{taskTime}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                            <label className="switch" style={{ transform: 'scale(0.9)', flexShrink: 0 }}>
                                <input type="checkbox" checked={user.user.dailyReminder?.enabled || false} onChange={(e) => updateDailyReminder({ enabled: e.target.checked })} />
                                <span className="slider"></span>
                            </label>
                        </div>

                        {user.user.dailyReminder?.enabled && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                {isReminderDoneToday() ? (
                                    <button
                                        onClick={() => updateDailyReminder({ lastCompletedDate: null })}
                                        style={{ color: 'var(--retro-teal)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, padding: '0.5rem 1rem', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '10px', border: '1px solid rgba(46, 204, 113, 0.3)', cursor: 'pointer' }}
                                    >
                                        <CheckCircle size={20} /> Done for today (Undo)
                                    </button>
                                ) : (
                                    <button
                                        onClick={markDailyReminderDone}
                                        style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px var(--primary-glow)' }}
                                    >
                                        <CheckCircle size={18} /> Mark as Done
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Your Week</h2>
                        <button onClick={() => setCurrentView('Calendar')} style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>View Full</button>
                    </div>
                    <MiniCalendar
                        items={[...tasks, ...events]}
                        onDateSelect={(date) => {
                            setCurrentView('Calendar');
                        }}
                    />
                </div>

                <div className="dashboard-columns">
                    <div>
                        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Next on your list</h2>
                        {isLoading ? (
                            <>
                                <TaskSkeleton />
                                <TaskSkeleton />
                                <TaskSkeleton />
                            </>
                        ) : pendingTasks.length === 0 ? (
                            <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>All done for now! 🚀</div>
                        ) : (
                            pendingTasks.slice(0, 3).map(task => {
                                const timeLeft = getTimeLeft(task.deadline, false, task.completed, task.missed);
                                return (
                                    <div key={task.id} className="task-item task" style={{ cursor: 'pointer' }} onClick={() => openDetail({ ...task, type: 'task' })}>
                                        <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                            <Circle size={24} color="#d1d5db" />
                                        </button>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600 }}>{task.title}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDeadline(task.deadline, user.user.timezone)}</p>
                                            {task.notes && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{task.notes}</p>}
                                        </div>
                                        {timeLeft && (
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem',
                                                borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0,
                                                background: timeLeft === 'overdue' ? 'rgba(231,76,60,0.15)' : timeLeft.endsWith('m') ? 'rgba(242,109,91,0.15)' : 'rgba(var(--primary-rgb, 242,109,91),0.1)',
                                                color: timeLeft === 'overdue' ? '#e74c3c' : timeLeft.endsWith('m') ? 'var(--primary)' : 'var(--text-muted)'
                                            }}>{timeLeft}</span>
                                        )}
                                        {task.priority === 'High' && <Zap size={16} color="var(--primary)" />}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div>
                        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Upcoming Events</h2>
                        {isLoading ? (
                            <>
                                <EventSkeleton />
                                <EventSkeleton />
                                <EventSkeleton />
                            </>
                        ) : upcomingEvents.length === 0 ? (
                            <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No events scheduled.</div>
                        ) : (
                            upcomingEvents.slice(0, 3).map(event => {
                                const timeLeft = getTimeLeft(event.start, true, event.completed, event.missed);
                                return (
                                    <div key={event.id} className="task-item event" style={{ cursor: 'pointer' }} onClick={() => openDetail({ ...event, type: 'event' })}>
                                        <CalendarIcon size={24} color="var(--event-color)" />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600 }}>{event.title}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDeadline(event.start, user.user.timezone)}</p>
                                            {event.notes && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{event.notes}</p>}
                                        </div>
                                        {timeLeft && (
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem',
                                                borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0,
                                                background: 'rgba(130,100,255,0.12)',
                                                color: timeLeft.endsWith('m') ? 'var(--primary)' : 'var(--event-color)'
                                            }}>{timeLeft}</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSchedule = () => (
        <div className="fade-in">
            <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Detailed Schedule</h2>
            {isLoading ? (
                <>
                    <TaskSkeleton />
                    <EventSkeleton />
                    <TaskSkeleton />
                    <EventSkeleton />
                </>
            ) : filteredItems().map(item => (
                <div
                    key={item.id}
                    className={`task-item ${item.type} ${item.type !== 'note' && (item.missed || (isOverdue(item.deadline || item.start, item.completed) && !item.completed)) ? 'missed' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                        if (item.type === 'note') {
                            setCurrentView('Notes');
                        } else {
                            openDetail(item);
                        }
                    }}
                >
                    {item.type === 'task' ? (
                        <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(item); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.completed ? (
                                <CheckCircle size={28} color="var(--retro-teal)" />
                            ) : item.missed ? (
                                <div style={{ color: '#e74c3c', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={24} />
                                </div>
                            ) : (
                                <Circle size={28} color="#d1d5db" />
                            )}
                        </button>
                    ) : item.type === 'note' ? (
                        <StickyNote size={28} color={item.color && item.color !== 'var(--glass)' ? item.color : 'var(--primary)'} />
                    ) : (
                        <CalendarIcon size={28} color={item.missed ? '#e74c3c' : 'var(--event-color)'} />
                    )}

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                            {item.priority && <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: item.priority === 'High' ? 'var(--primary)' : 'var(--text-muted)' }}>{item.priority}</span>}
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{item.priority ? '• ' : ''}{item.type}</span>
                            {item.missed && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.05rem 0.35rem', borderRadius: '4px', background: 'rgba(231,76,60,0.1)', color: '#e74c3c' }}>MISSED</span>}
                        </div>
                        <h3 style={{ fontSize: '1.1rem', textDecoration: item.completed || item.missed ? 'line-through' : 'none', opacity: item.completed || item.missed ? 0.6 : 1 }}>{item.title}</h3>
                        {item.type !== 'note' && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDeadline(item.deadline || item.start, user.user.timezone)}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.type !== 'note' && !item.completed && !item.missed && new Date(item.deadline || item.start) < new Date() ? (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleReviewItem(item, 'completed'); }}
                                    style={{
                                        background: 'rgba(22, 160, 133, 0.1)',
                                        color: 'var(--retro-teal)',
                                        border: '1px solid rgba(22, 160, 133, 0.2)',
                                        borderRadius: '8px',
                                        padding: '0.35rem 0.7rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.2s'
                                    }}
                                    className="toast-btn"
                                >
                                    <CheckCircle size={14} /> Complete
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleReviewItem(item, 'missed'); }}
                                    style={{
                                        background: 'rgba(231, 76, 60, 0.1)',
                                        color: '#e74c3c',
                                        border: '1px solid rgba(231, 76, 60, 0.2)',
                                        borderRadius: '8px',
                                        padding: '0.35rem 0.7rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        transition: 'all 0.2s'
                                    }}
                                    className="toast-btn"
                                >
                                    <X size={14} /> Missed
                                </button>
                            </>
                        ) : (
                            item.type !== 'note' && (() => {
                                const tl = getTimeLeft(item.deadline || item.start, item.type === 'event', item.completed, item.missed);
                                return tl ? (
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem',
                                        borderRadius: '8px', whiteSpace: 'nowrap',
                                        background: tl === 'overdue' ? 'rgba(231,76,60,0.15)' : 'rgba(0,0,0,0.06)',
                                        color: tl === 'overdue' ? '#e74c3c' : tl.endsWith('m') ? 'var(--primary)' : 'var(--text-muted)'
                                    }}>{tl}</span>
                                ) : null;
                            })()
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id, item.type); }}
                            style={{ color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderProfile = () => {
        const updateSetting = async (key, value) => {
            try {
                const response = await fetch(`${API_URL}/api/user/settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                    body: JSON.stringify({ [key]: value })
                });
                if (response.ok) {
                    const updated = await response.json();
                    setUser({ ...user, user: { ...user.user, ...updated } });
                }
            } catch (err) { }
        };

        // Calculate statistics
        const completedTasksCount = tasks.filter(t => t.completed).length;
        const missedTasksCount = tasks.filter(t => t.missed).length;
        const pendingTasksCount = tasks.filter(t => !t.completed && !t.missed).length;

        const completedEventsCount = events.filter(e => e.completed).length;
        const missedEventsCount = events.filter(e => e.missed).length;
        const pendingEventsCount = events.filter(e => !e.completed && !e.missed).length;

        const totalCompleted = completedTasksCount + completedEventsCount;
        const totalMissed = missedTasksCount + missedEventsCount;
        const totalPending = pendingTasksCount + pendingEventsCount;
        const totalResolved = totalCompleted + totalMissed;

        const completionRate = totalResolved > 0 
            ? Math.round((totalCompleted / totalResolved) * 100) 
            : 0;

        return (
            <div className="fade-in">
                <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Profile</h2>

                {/* Profile Header Card */}
                <div className="profile-section" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    padding: '2rem',
                    background: 'var(--glass)',
                    borderRadius: '24px',
                    border: '1px solid var(--glass-border)',
                    marginBottom: '2rem',
                    flexWrap: 'wrap'
                }}>
                    <Avatar src={user.user.avatar} name={user.user.username} size="large" />
                    <div className="profile-info" style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{user.user.username}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.2rem' }}>{user.user.email}</p>
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Performance Dashboard</h3>
                    
                    <div className="dashboard-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Completed Stat */}
                        <div className="glass-card" style={{ 
                            background: 'rgba(22, 160, 133, 0.08)', 
                            border: '1px solid rgba(22, 160, 133, 0.2)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>COMPLETED</span>
                                <div style={{ background: 'rgba(22, 160, 133, 0.15)', color: 'var(--retro-teal)', padding: '0.4rem', borderRadius: '10px' }}>
                                    <CheckCircle size={18} />
                                </div>
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalCompleted}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {completedTasksCount} tasks • {completedEventsCount} events
                            </span>
                        </div>

                        {/* Missed Stat */}
                        <div className="glass-card" style={{ 
                            background: 'rgba(231, 76, 60, 0.08)', 
                            border: '1px solid rgba(231, 76, 60, 0.2)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>MISSED</span>
                                <div style={{ background: 'rgba(231, 76, 60, 0.15)', color: '#e74c3c', padding: '0.4rem', borderRadius: '10px' }}>
                                    <Trash2 size={18} />
                                </div>
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{totalMissed}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {missedTasksCount} tasks • {missedEventsCount} events
                            </span>
                        </div>

                        {/* Completion Rate Card */}
                        <div className="glass-card" style={{ 
                            background: 'rgba(242, 109, 91, 0.08)', 
                            border: '1px solid rgba(242, 109, 91, 0.2)',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>COMPLETION RATE</span>
                                <div style={{ background: 'rgba(242, 109, 91, 0.15)', color: 'var(--primary)', padding: '0.4rem', borderRadius: '10px' }}>
                                    <Zap size={18} />
                                </div>
                            </div>
                            <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-main)' }}>{completionRate}%</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {totalPending} active items remaining
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar Chart */}
                    {totalResolved > 0 ? (
                        <div className="glass-card" style={{ padding: '1.5rem', background: 'var(--glass)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                <span>Completed vs Missed Ratio</span>
                                <span style={{ color: 'var(--primary)' }}>{totalCompleted} of {totalResolved} resolved</span>
                            </div>
                            
                            {/* Horizontal Progress Bar */}
                            <div style={{
                                width: '100%',
                                height: '14px',
                                background: '#e0dfdb',
                                borderRadius: '7px',
                                overflow: 'hidden',
                                display: 'flex'
                            }}>
                                <div style={{
                                    width: `${(totalCompleted / totalResolved) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #16a085, #2ecc71)',
                                    borderRadius: totalMissed === 0 ? '7px' : '7px 0 0 7px',
                                    transition: 'width 0.6s ease'
                                }} />
                                <div style={{
                                    width: `${(totalMissed / totalResolved) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
                                    borderRadius: totalCompleted === 0 ? '7px' : '0 7px 7px 0',
                                    transition: 'width 0.6s ease'
                                }} />
                            </div>

                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a085' }} />
                                    <span>Completed ({Math.round((totalCompleted / totalResolved) * 100)}%)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#e74c3c' }} />
                                    <span>Missed ({Math.round((totalMissed / totalResolved) * 100)}%)</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No tasks or events resolved yet. Complete or mark overdue items as missed to see stats!
                        </div>
                    )}
                </div>

                {/* Configurations & Settings */}
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Configurations</h3>
                <div className="settings-grid">
                    <div className="setting-item">
                        <div>
                            <h3 style={{ fontWeight: 600 }}>Night Mode</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Switch to a darker theme</p>
                        </div>
                        <label className="switch">
                            <input type="checkbox" checked={user.user.nightMode} onChange={(e) => updateSetting('nightMode', e.target.checked)} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div>
                            <h3 style={{ fontWeight: 600 }}>Timezone</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set your preferred timezone</p>
                        </div>
                        <select
                            value={user.user.timezone}
                            onChange={(e) => updateSetting('timezone', e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                        >
                            <option value="Asia/Kolkata">Indian Standard Time (IST)</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="Europe/London">London (GMT/BST)</option>
                        </select>
                    </div>

                    <div className="setting-item" style={{ marginTop: '1rem', border: '1px solid var(--primary-glow)', background: 'rgba(242, 109, 91, 0.05)' }}>
                        <div>
                            <h3 style={{ fontWeight: 600, color: 'var(--primary)' }}>Notifications</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>View your recent alerts</p>
                        </div>
                        <button
                            onClick={openNotifications}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '10px',
                                border: 'none',
                                background: 'var(--primary)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px var(--primary-glow)',
                                position: 'relative'
                            }}
                        >
                            <Bell size={18} /> Alerts
                            {unreadCount > 0 && (
                                <span className="notification-badge" style={{ top: '-8px', left: '-8px', border: '2px solid white' }}>{unreadCount}</span>
                            )}
                        </button>
                    </div>

                    <div className="setting-item" style={{ border: '1px solid var(--primary-glow)', background: 'rgba(242, 109, 91, 0.05)' }}>
                        <div>
                            <h3 style={{ fontWeight: 600, color: 'var(--primary)' }}>Notification Status</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {Notification.permission === 'granted' ? '✅ Permissions Granted' :
                                    Notification.permission === 'denied' ? '❌ Permissions Blocked' :
                                        '⚠️ Setup Required'}
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                const success = await registerPushNotifications();
                                if (success) alert('Notifications enabled successfully!');
                                else if (Notification.permission === 'denied') alert('Permissions are blocked. Please enable them in your browser settings.');
                                else alert('Failed to register notifications.');
                            }}
                            className="btn-primary"
                            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                        >
                            {Notification.permission === 'granted' ? 'Repair Setup' : 'Enable Now'}
                        </button>
                    </div>

                    <div className="setting-item">
                        <div>
                            <h3 style={{ fontWeight: 600 }}>Test Notifications</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verify your push notifications</p>
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch(`${API_URL}/api/test-push`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${user.token}` }
                                    });
                                    if (res.ok) alert('Test notification sent!');
                                    else alert('Failed to send test notification. Make sure you enabled them above.');
                                } catch (err) {
                                    alert('Error: ' + err.message);
                                }
                            }}
                            className="btn-primary"
                            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Test Push
                        </button>
                    </div>

                    <div className="setting-item" style={{ marginTop: '1rem', border: '1px solid rgba(231, 76, 60, 0.2)', background: 'rgba(231, 76, 60, 0.05)' }}>
                        <div>
                            <h3 style={{ fontWeight: 600, color: '#e74c3c' }}>Account</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sign out of your account</p>
                        </div>
                        <button
                            onClick={() => setUser(null)}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '10px',
                                border: 'none',
                                background: '#e74c3c',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
                            }}
                        >
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>

                <div className="settings-footer" style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>Planory v1.2</p>
                    <a
                        href="https://github.com/owsam22"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                        }}
                    >
                        <Github size={18} /> Developed by @owsam22
                    </a>
                </div>
                {/* Spacer to prevent bottom nav overlap on mobile */}
                <div style={{ height: '2rem' }} className="mobile-only-spacer" />
            </div>
        );
    };

    const renderSearchResults = () => {
        const results = filteredItems();
        return (
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.75rem' }}>Search Results</h2>
                    <button
                        onClick={() => setSearchQuery('')}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        Clear Search
                    </button>
                </div>

                {results.length > 0 ? (
                    results.map(item => (
                        <div key={item.id} className={`task-item ${item.type} ${item.type !== 'note' && isOverdue(item.deadline || item.start, item.completed) ? 'missed' : ''}`}>
                            {item.type === 'task' ? (
                                <button onClick={() => toggleTaskComplete(item)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    {item.completed ? <CheckCircle size={28} color="var(--retro-teal)" /> : <Circle size={28} color="#d1d5db" />}
                                </button>
                            ) : item.type === 'event' ? (
                                <CalendarIcon size={28} color="var(--event-color)" />
                            ) : (
                                <StickyNote size={28} color={item.color && item.color !== 'var(--glass)' ? item.color : 'var(--primary)'} />
                            )}

                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                                if (item.type === 'note') {
                                    setCurrentView('Notes');
                                    setSearchQuery('');
                                } else {
                                    openDetail(item);
                                }
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    {item.priority && <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: item.priority === 'High' ? 'var(--primary)' : 'var(--text-muted)' }}>{item.priority}</span>}
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{item.priority ? '• ' : ''}{item.type}</span>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>{item.title || (item.type === 'note' ? 'Untitled Note' : '')}</h3>
                                {item.type !== 'note' && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDeadline(item.deadline || item.start, user.user.timezone)}</p>}
                                {item.type === 'note' && item.content && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{item.content}</p>}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Search size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No results found for "{searchQuery}"</p>
                    </div>
                )}
            </div>
        );
    };


    return (
        <>
            <aside className="side-nav">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                    <div style={{ width: '42px', height: '42px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px var(--primary-glow)' }}>
                        <Zap size={24} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Planory</h1>
                </div>

                <NavigationItems />

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={openNotifications} className="nav-item" style={{ position: 'relative' }}>
                        <Bell size={22} /> <span>Alerts</span>
                        {unreadCount > 0 && (
                            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                    <button onClick={() => setUser(null)} className="nav-item" style={{ color: '#e74c3c' }}>
                        <LogOut size={22} /> <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <div className="container">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="search-container" style={{ flex: 1, marginBottom: 0 }}>
                        <IoSearchCircleSharp
                            size={32}
                            className="search-icon"
                            style={{
                                left: '0.6rem',
                                color: 'var(--primary)',
                                opacity: 1,
                                zIndex: 10,
                                pointerEvents: 'none'
                            }}
                        />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search Tasks , Events , Notes..."
                            style={{ paddingLeft: '3.5rem' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(0,0,0,0.05)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={openNotifications}
                        className="mobile-alerts-btn"
                        style={{
                            position: 'relative',
                            width: '48px',
                            height: '48px',
                            borderRadius: '16px',
                            background: 'var(--glass)',
                            border: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            boxShadow: 'var(--shadow)'
                        }}
                    >
                        <Bell size={22} fill={unreadCount > 0 ? "var(--primary)" : "none"} />
                        {unreadCount > 0 && (
                            <span className="notification-badge" style={{
                                top: '-4px',
                                right: '-4px',
                                left: 'auto',
                                background: '#e74c3c',
                                border: '2px solid white'
                            }}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                {searchQuery ? renderSearchResults() : (
                    <>
                        {currentView === 'Home' && renderOverview()}
                        {currentView === 'Calendar' && <Calendar items={[...tasks, ...events]} isLoading={isLoading} onAddClick={(date) => {
                            setDraftItem(prev => ({ ...prev, deadline: date.toISOString().slice(0, 16) }));
                            setIsAdding(true);
                        }} onEditClick={openDetail} />}
                        {currentView === 'Schedule' && renderSchedule()}
                        {currentView === 'Notes' && <Notes user={user} notes={notes} setNotes={setNotes} isLoading={isLoading} />}
                        {currentView === 'Profile' && renderProfile()}
                    </>
                )}

                <Footer />

                {currentView !== 'Notes' && (
                    <button className="main-fab" onClick={() => setIsAdding(true)}>
                        <Plus size={32} />
                    </button>
                )}

                <div className="bottom-nav">
                    <button onClick={() => setCurrentView('Home')} className={`nav-item ${currentView === 'Home' ? 'active' : ''}`}>
                        <Home size={22} /> <span>Home</span>
                    </button>
                    <button onClick={() => setCurrentView('Calendar')} className={`nav-item ${currentView === 'Calendar' ? 'active' : ''}`}>
                        <CalendarIcon size={22} /> <span>Calendar</span>
                    </button>
                    <button onClick={() => setCurrentView('Schedule')} className={`nav-item ${currentView === 'Schedule' ? 'active' : ''}`}>
                        <Layout size={22} /> <span>Schedule</span>
                    </button>
                    <button onClick={() => setCurrentView('Notes')} className={`nav-item ${currentView === 'Notes' ? 'active' : ''}`}>
                        <StickyNote size={22} /> <span>Notes</span>
                    </button>
                    <button onClick={() => setCurrentView('Profile')} className={`nav-item ${currentView === 'Profile' ? 'active' : ''}`} style={{ position: 'relative' }}>
                        <UserIcon size={22} /> <span>Profile</span>
                        {unreadCount > 0 && (
                            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                </div>

                {/* Overdue Review Modal */}
                {(() => {
                    const overdueReviewItems = [
                        ...tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && !t.completed && !t.missed && !skippedReviewIds.includes(t.id)).map(t => ({ ...t, type: 'task' })),
                        ...events.filter(e => e.start && new Date(e.start) < new Date() && !e.completed && !e.missed && !skippedReviewIds.includes(e.id)).map(e => ({ ...e, type: 'event' }))
                    ];

                    if (overdueReviewItems.length === 0) return null;
                    const currentItem = overdueReviewItems[0];
                    return (
                        <div className="overlay fade-in" style={{ zIndex: 3000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div className="glass-card" style={{ 
                                width: '90%', 
                                maxWidth: '420px', 
                                background: 'var(--bg-main)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '28px', 
                                padding: '2rem', 
                                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                position: 'relative'
                            }}>
                                <button 
                                    onClick={() => skipReviewItem(currentItem.id)}
                                    style={{ 
                                        position: 'absolute', 
                                        right: '1.5rem', 
                                        top: '1.5rem', 
                                        background: 'rgba(0,0,0,0.05)', 
                                        border: 'none', 
                                        borderRadius: '50%', 
                                        width: '32px', 
                                        height: '32px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        cursor: 'pointer', 
                                        color: 'var(--text-muted)' 
                                    }}
                                >
                                    <X size={16} />
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                    <div style={{ 
                                        width: '56px', 
                                        height: '56px', 
                                        borderRadius: '18px', 
                                        background: 'rgba(242, 109, 91, 0.1)', 
                                        color: 'var(--primary)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        margin: '0 auto 1rem auto' 
                                    }}>
                                        <Zap size={28} />
                                    </div>
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Did you complete this?</h2>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        This {currentItem.type} was due past its scheduled time.
                                    </p>
                                </div>

                                <div className="glass-card" style={{ 
                                    padding: '1.25rem', 
                                    background: 'var(--glass)', 
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: currentItem.type === 'task' ? 'var(--task-color)' : 'var(--event-color)' }}>
                                        {currentItem.type}
                                    </div>
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{currentItem.title}</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                        Scheduled: {formatDeadline(currentItem.deadline || currentItem.start, user.user.timezone)}
                                    </p>
                                    {currentItem.notes && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            "{currentItem.notes}"
                                        </p>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <button 
                                        onClick={() => handleReviewItem(currentItem, 'completed')}
                                        style={{ 
                                            width: '100%', 
                                            background: 'linear-gradient(90deg, #16a085, #2ecc71)', 
                                            color: 'white', 
                                            padding: '1rem', 
                                            borderRadius: '16px', 
                                            border: 'none', 
                                            fontWeight: 700, 
                                            fontSize: '1rem', 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            boxShadow: '0 4px 15px rgba(22, 160, 133, 0.2)'
                                        }}
                                    >
                                        <CheckCircle size={18} /> Yes, Marked as Completed
                                    </button>
                                    <button 
                                        onClick={() => handleReviewItem(currentItem, 'missed')}
                                        style={{ 
                                            width: '100%', 
                                            background: 'rgba(231, 76, 60, 0.1)', 
                                            color: '#e74c3c', 
                                            padding: '1rem', 
                                            borderRadius: '16px', 
                                            border: '1px solid rgba(231, 76, 60, 0.2)', 
                                            fontWeight: 700, 
                                            fontSize: '1rem', 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <X size={18} /> No, Marked as Missed
                                    </button>
                                    <button 
                                        onClick={() => skipReviewItem(currentItem.id)}
                                        style={{ 
                                            background: 'none', 
                                            border: 'none', 
                                            color: 'var(--text-muted)', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 600, 
                                            cursor: 'pointer', 
                                            textAlign: 'center',
                                            marginTop: '0.25rem'
                                        }}
                                    >
                                        Decide Later
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {isAdding && (
                    <div className="overlay fade-in">
                        <div className="overlay-content">
                            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.5rem' }}>{editingId ? 'Edit' : 'New'} {draftItem.type}</h2>
                                <button onClick={closeForm} className="close-btn" style={{ border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}><X size={24} /></button>
                            </header>

                            {!editingId && (
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Meeting tomorrow at 3pm..."
                                    value={quickInput}
                                    onChange={(e) => setQuickInput(e.target.value)}
                                    style={{ fontSize: '1.1rem', width: '100%', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}
                                    className="quick-add-input"
                                />
                            )}

                            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <button
                                            onClick={() => {
                                                setDraftItem(prev => ({ ...prev, type: 'task' }));
                                                setHasManuallyChangedType(true);
                                            }}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: draftItem.type === 'task' ? 'var(--task-color)' : 'rgba(0,0,0,0.05)', color: draftItem.type === 'task' ? 'white' : 'inherit', cursor: 'pointer' }}
                                        >Task</button>
                                        <button
                                            onClick={() => {
                                                setDraftItem(prev => ({ ...prev, type: 'event' }));
                                                setHasManuallyChangedType(true);
                                            }}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: draftItem.type === 'event' ? 'var(--event-color)' : 'rgba(0,0,0,0.05)', color: draftItem.type === 'event' ? 'white' : 'inherit', cursor: 'pointer' }}
                                        >Event</button>
                                    </div>
                                    <input type="text" value={draftItem.title} onChange={(e) => setDraftItem({ ...draftItem, title: e.target.value })} placeholder="Title" style={{ padding: '0.8rem', borderRadius: '12px' }} />
                                    <div className="responsive-grid">
                                        <input
                                            type="datetime-local"
                                            value={toLocalISOString(draftItem.deadline || draftItem.start, user.user.timezone)}
                                            onChange={(e) => setDraftItem({ ...draftItem, deadline: e.target.value, start: e.target.value })}
                                            style={{ padding: '0.8rem', borderRadius: '12px' }}
                                        />
                                        <select value={draftItem.priority} onChange={(e) => setDraftItem({ ...draftItem, priority: e.target.value })} style={{ padding: '0.8rem', borderRadius: '12px' }}>
                                            <option>Low</option><option>Medium</option><option>High</option>
                                        </select>
                                    </div>
                                    <textarea placeholder="Notes (optional)" rows="2" value={draftItem.notes} onChange={(e) => setDraftItem({ ...draftItem, notes: e.target.value })} style={{ resize: 'none', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee' }} />
                                </div>
                            </div>
                            <button onClick={saveItem} style={{ width: '100%', background: draftItem.type === 'task' ? 'var(--task-color)' : 'var(--event-color)', color: 'white', padding: '1.1rem', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>{editingId ? 'Update' : 'Create'} {draftItem.type}</button>
                        </div>
                    </div>
                )}

                {isNotifying && <NotificationCenter notifications={notifications} onClose={() => setIsNotifying(false)} onClear={() => setNotifications([])} />}

                {/* Item Detail Overlay */}
                {viewingItem && (
                    <ItemDetailOverlay
                        item={viewingItem}
                        user={user}
                        onClose={() => setViewingItem(null)}
                        onEdit={(item) => { setViewingItem(null); startEdit(item); }}
                        onDelete={(id, type) => { setViewingItem(null); deleteItem(id, type); }}
                        onToggleComplete={(task) => { toggleTaskComplete(task); }}
                    />
                )}

                {/* Daily Plan Editor Overlay */}
                {isEditingPlan && (
                    <div className="overlay-container fade-in" style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }} onClick={() => setIsEditingPlan(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', padding: 'clamp(1rem, 5vw, 2rem)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Edit Daily Plan</h2>
                                <button onClick={() => setIsEditingPlan(false)} style={{ background: 'var(--bg-main)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
                            </div>

                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Add up to 5 daily reminders, each with its own custom time.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                {planTasks.map((t, idx) => {
                                    const taskText = typeof t === 'object' ? t.text : t;
                                    const taskTime = typeof t === 'object' ? t.time : '12:00';
                                    return (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                value={taskText}
                                                placeholder="Habit or task..."
                                                onChange={(e) => {
                                                    const nt = [...planTasks];
                                                    nt[idx] = { text: e.target.value, time: taskTime };
                                                    setPlanTasks(nt);
                                                }}
                                                style={{ flex: '1 1 150px', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem' }}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-main)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.5rem 0.6rem', flex: '0 0 auto' }}>
                                                <Bell size={14} color="var(--primary)" />
                                                <input
                                                    type="time"
                                                    value={taskTime}
                                                    onChange={(e) => {
                                                        const nt = [...planTasks];
                                                        nt[idx] = { text: taskText, time: e.target.value };
                                                        setPlanTasks(nt);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '0.85rem', fontWeight: 700, width: '80px' }}
                                                />
                                            </div>
                                            <button onClick={() => setPlanTasks(planTasks.filter((_, i) => i !== idx))} style={{ flex: '0 0 auto', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: 'none', borderRadius: '10px', padding: '0.6rem 0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {planTasks.length < 5 && (
                                <button
                                    onClick={() => setPlanTasks([...planTasks, { text: '', time: '12:00' }])}
                                    style={{ background: 'var(--bg-main)', color: 'var(--primary)', border: '1px dashed var(--primary)', padding: '0.8rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Plus size={18} /> Add Reminder
                                </button>
                            )}

                            <div style={{ marginTop: '1rem' }}>
                                <button
                                    onClick={() => {
                                        const cleanTasks = planTasks
                                            .map(t => typeof t === 'object' ? { text: t.text.trim(), time: t.time || '12:00' } : { text: t.trim(), time: '12:00' })
                                            .filter(t => t.text.length > 0);
                                        updateDailyReminder({ tasks: cleanTasks });
                                        setIsEditingPlan(false);
                                    }}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
                                >
                                    Save Plan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Dashboard;
