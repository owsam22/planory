import React from 'react';
import { X, Bell, AlertTriangle, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';

const NotificationCenter = ({ notifications, onClose, onClear }) => {
    return (
        <div className="overlay fade-in notification-overlay">
            <div className="overlay-content notification-panel">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Bell size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.5rem' }}>Notifications</h2>
                    </div>
                    <button onClick={onClose} className="nav-item" style={{ width: 'auto', padding: '0.5rem', marginBottom: 0 }}><X size={24} /></button>
                </header>

                <div className="notification-list">
                    {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                            <CheckCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>You're all caught up!</p>
                        </div>
                    ) : (
                        notifications.map((n, idx) => (
                            <div key={idx} className="task-item" style={{ background: 'rgba(255,255,255,0.8)', borderLeft: `4px solid ${n.type === 'missed' ? 'var(--missed-color)' : n.type === 'event' ? 'var(--event-color)' : 'var(--task-color)'}` }}>
                                <div style={{ background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '12px' }}>
                                    {n.type === 'missed' ? <AlertTriangle size={20} color="var(--missed-color)" /> : 
                                     n.type === 'event' ? <CalendarIcon size={20} color="var(--event-color)" /> : 
                                     <Bell size={20} color="var(--task-color)" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{n.title}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.body}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {notifications.length > 0 && (
                    <button 
                        onClick={onClear}
                        style={{ width: '100%', marginTop: 'auto', padding: '1rem', borderRadius: '16px', border: 'none', background: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Clear All
                    </button>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;
