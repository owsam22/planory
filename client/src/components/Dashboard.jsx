import React, { useState, useEffect } from 'react';
import { 
    Plus, Trash2, Bell, LogOut, CheckCircle, Circle, Calendar as CalendarIcon, X, 
    ChevronDown, ChevronUp, Flag, FileText, Home, Search, Settings, Zap, Layout, Github
} from 'lucide-react';
import Calendar from './Calendar';
import MiniCalendar from './MiniCalendar';
import NotificationCenter from './NotificationCenter';
import { parseTaskString, formatDeadline, isOverdue } from '../utils/parser';
import { io } from 'socket.io-client';
import Footer from './Footer';
import { IoSearchCircleSharp } from "react-icons/io5";
import { GiCharacter } from "react-icons/gi";

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

const Dashboard = ({ user, setUser }) => {
    const [tasks, setTasks] = useState([]);
    const [events, setEvents] = useState([]);
    const [currentView, setCurrentView] = useState('Home'); // Home, Calendar, Schedule, Settings
    const [isAdding, setIsAdding] = useState(false);
    const [isNotifying, setIsNotifying] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [quickInput, setQuickInput] = useState('');
    const [draftItem, setDraftItem] = useState({ title: '', type: 'task', deadline: '', start: '', priority: 'Medium', notes: '' });
    const [editingId, setEditingId] = useState(null);
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('planory_notifications');
        return saved ? JSON.parse(saved) : [];
    });
    const [unreadCount, setUnreadCount] = useState(() => {
        const saved = localStorage.getItem('planory_unread_count');
        return saved ? parseInt(saved) : 0;
    });

    useEffect(() => {
        localStorage.setItem('planory_notifications', JSON.stringify(notifications));
        localStorage.setItem('planory_unread_count', unreadCount.toString());
    }, [notifications, unreadCount]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            const handleMessage = (event) => {
                if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
                    const newNotify = {
                        title: event.data.payload.title,
                        body: event.data.payload.body,
                        type: event.data.payload.tag?.includes('event') ? 'event' : event.data.payload.tag?.includes('missed') ? 'missed' : 'task',
                        timestamp: new Date().toISOString()
                    };
                    setNotifications(prev => [newNotify, ...prev].slice(0, 50));
                    setUnreadCount(prev => prev + 1);
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
        const fetchData = async () => {
            try {
                const [tasksRes, eventsRes] = await Promise.all([
                    fetch(`${API_URL}/api/tasks`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/api/events`, { headers: { 'Authorization': `Bearer ${user.token}` } })
                ]);
                if (tasksRes.ok) setTasks(await tasksRes.json());
                if (eventsRes.ok) setEvents(await eventsRes.json());
            } catch (err) { console.error('Fetch failed', err); }
        };
        fetchData();
        
        // Setup Socket.io connection
        const socket = io(API_URL, {
            auth: { token: user.token }
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

        return () => {
            socket.disconnect();
        };
    }, [user.token]);

    // Update draftItem when quickInput changes using the parser
    useEffect(() => {
        if (quickInput && !editingId) {
            const parsed = parseTaskString(quickInput);
            setDraftItem(prev => ({
                ...prev,
                title: parsed.title,
                deadline: parsed.type === 'task' ? (parsed.deadline || prev.deadline) : '',
                start: parsed.type === 'event' ? (parsed.deadline || prev.start) : '',
                type: parsed.type,
                priority: parsed.priority
            }));
        }
    }, [quickInput, editingId]);

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
        setIsAdding(true);
    };

    const deleteItem = async (id, type) => {
        const endpoint = type === 'event' ? 'events' : 'tasks';
        try {
            const response = await fetch(`${API_URL}/api/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (response.ok) {
                if (type === 'event') setEvents(prev => prev.filter(e => e.id !== id));
                else setTasks(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) { }
    };

    const toggleTaskComplete = async (task) => {
        const updated = { ...task, completed: !task.completed };
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        try {
            await fetch(`${API_URL}/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ completed: updated.completed })
            });
        } catch (err) { }
    };

    const filteredItems = () => {
        const query = searchQuery.toLowerCase();
        const all = [
            ...tasks.map(t => ({ ...t, type: 'task' })),
            ...events.map(e => ({ ...e, type: 'event' }))
        ];
        return all.filter(item => 
            item.title.toLowerCase().includes(query) || 
            (item.notes && item.notes.toLowerCase().includes(query))
        );
    };

    const openNotifications = () => {
        setUnreadCount(0);
        setIsNotifying(true);
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
            <button onClick={() => setCurrentView('Settings')} className={`nav-item ${currentView === 'Settings' ? 'active' : ''}`}>
                <Settings size={22} /> <span>Settings</span>
            </button>
        </>
    );

    const renderOverview = () => {
        const pendingTasks = tasks.filter(t => !t.completed);
        const upcomingEvents = events.filter(e => new Date(e.start) >= new Date()).sort((a,b) => new Date(a.start) - new Date(b.start));
        
        return (
            <div className="fade-in">
                <header style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        Hey {user.user.username}! <GiCharacter color="var(--primary)" />
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>You have {pendingTasks.length} tasks and {upcomingEvents.length} events upcoming.</p>
                </header>

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
                        {pendingTasks.slice(0, 3).map(task => (
                            <div key={task.id} className="task-item task">
                                <button onClick={() => toggleTaskComplete(task)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <Circle size={24} color="#d1d5db" />
                                </button>
                                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit({ ...task, type: 'task' })}>
                                    <p style={{ fontWeight: 600 }}>{task.title}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDeadline(task.deadline, user.user.timezone)}</p>
                                    {task.notes && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{task.notes}</p>}
                                </div>
                                {task.priority === 'High' && <Zap size={16} color="var(--primary)" />}
                            </div>
                        ))}
                        {pendingTasks.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>All done for now! 🚀</div>}
                    </div>

                    <div>
                        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Upcoming Events</h2>
                        {upcomingEvents.slice(0, 3).map(event => (
                            <div key={event.id} className="task-item event">
                                <CalendarIcon size={24} color="var(--event-color)" />
                                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit({ ...event, type: 'event' })}>
                                    <p style={{ fontWeight: 600 }}>{event.title}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDeadline(event.start, user.user.timezone)}</p>
                                    {event.notes && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{event.notes}</p>}
                                </div>
                            </div>
                        ))}
                        {upcomingEvents.length === 0 && <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No events scheduled.</div>}
                    </div>
                </div>
            </div>
        );
    };

    const renderSchedule = () => (
        <div className="fade-in">
            <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Detailed Schedule</h2>
            {filteredItems().map(item => (
                <div key={item.id} className={`task-item ${item.type} ${isOverdue(item.deadline || item.start, item.completed) ? 'missed' : ''}`}>
                    {item.type === 'task' ? (
                        <button onClick={() => toggleTaskComplete(item)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            {item.completed ? <CheckCircle size={28} color="var(--retro-teal)" /> : <Circle size={28} color="#d1d5db" />}
                        </button>
                    ) : <CalendarIcon size={28} color="var(--event-color)" />}
                    
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(item)}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: item.priority === 'High' ? 'var(--primary)' : 'var(--text-muted)' }}>{item.priority}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>• {item.type}</span>
                        </div>
                        <h3 style={{ fontSize: '1.1rem', textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>{item.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDeadline(item.deadline || item.start, user.user.timezone)}</p>
                        {item.notes && <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>{item.notes}</p>}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => startEdit(item)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><FileText size={20} /></button>
                        <button onClick={() => deleteItem(item.id, item.type)} style={{ color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSettings = () => {
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
            } catch (err) {}
        };

        return (
            <div className="fade-in">
                <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Settings</h2>
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
                                    else alert('Failed to send test notification');
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
                        <div key={item.id} className={`task-item ${item.type} ${isOverdue(item.deadline || item.start, item.completed) ? 'missed' : ''}`}>
                            {item.type === 'task' ? (
                                <button onClick={() => toggleTaskComplete(item)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    {item.completed ? <CheckCircle size={28} color="var(--retro-teal)" /> : <Circle size={28} color="#d1d5db" />}
                                </button>
                            ) : <CalendarIcon size={28} color="var(--event-color)" />}
                            
                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(item)}>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: item.priority === 'High' ? 'var(--primary)' : 'var(--text-muted)' }}>{item.priority}</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>• {item.type}</span>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>{item.title}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDeadline(item.deadline || item.start, user.user.timezone)}</p>
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
                        {currentView === 'Calendar' && <Calendar items={[...tasks, ...events]} onAddClick={(date) => {
                            setDraftItem(prev => ({ ...prev, deadline: date.toISOString().slice(0, 16) }));
                            setIsAdding(true);
                        }} onEditClick={startEdit} />}
                        {currentView === 'Schedule' && renderSchedule()}
                        {currentView === 'Settings' && renderSettings()}
                    </>
                )}

                <Footer />
                
                <button className="main-fab" onClick={() => setIsAdding(true)}>
                    <Plus size={32} />
                </button>

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
                    <button onClick={() => setCurrentView('Settings')} className={`nav-item ${currentView === 'Settings' ? 'active' : ''}`} style={{ position: 'relative' }}>
                        <Settings size={22} /> <span>Settings</span>
                        {unreadCount > 0 && (
                            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>
                </div>

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
                                            onClick={() => setDraftItem({...draftItem, type: 'task'})}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: draftItem.type === 'task' ? 'var(--task-color)' : 'rgba(0,0,0,0.05)', color: draftItem.type === 'task' ? 'white' : 'inherit', cursor: 'pointer' }}
                                        >Task</button>
                                        <button 
                                            onClick={() => setDraftItem({...draftItem, type: 'event'})}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', background: draftItem.type === 'event' ? 'var(--event-color)' : 'rgba(0,0,0,0.05)', color: draftItem.type === 'event' ? 'white' : 'inherit', cursor: 'pointer' }}
                                        >Event</button>
                                    </div>
                                    <input type="text" value={draftItem.title} onChange={(e) => setDraftItem({...draftItem, title: e.target.value})} placeholder="Title" style={{ padding: '0.8rem', borderRadius: '12px' }} />
                                    <div className="responsive-grid">
                                        <input 
                                            type="datetime-local" 
                                            value={toLocalISOString(draftItem.deadline || draftItem.start, user.user.timezone)} 
                                            onChange={(e) => setDraftItem({...draftItem, deadline: e.target.value, start: e.target.value})} 
                                            style={{ padding: '0.8rem', borderRadius: '12px' }} 
                                        />
                                        <select value={draftItem.priority} onChange={(e) => setDraftItem({...draftItem, priority: e.target.value})} style={{ padding: '0.8rem', borderRadius: '12px' }}>
                                            <option>Low</option><option>Medium</option><option>High</option>
                                        </select>
                                    </div>
                                    <textarea placeholder="Notes (optional)" rows="2" value={draftItem.notes} onChange={(e) => setDraftItem({...draftItem, notes: e.target.value})} style={{ resize: 'none', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee' }} />
                                </div>
                            </div>
                            <button onClick={saveItem} style={{ width: '100%', background: draftItem.type === 'task' ? 'var(--task-color)' : 'var(--event-color)', color: 'white', padding: '1.1rem', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>{editingId ? 'Update' : 'Create'} {draftItem.type}</button>
                        </div>
                    </div>
                )}

                {isNotifying && <NotificationCenter notifications={notifications} onClose={() => setIsNotifying(false)} onClear={() => setNotifications([])} />}
            </div>
        </>
    );
};

export default Dashboard;
