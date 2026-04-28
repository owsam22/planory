import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';

const Toast = ({ title, body, type, isHighPriority, onDismiss }) => {
    useEffect(() => {
        if (!isHighPriority) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isHighPriority, onDismiss]);

    return (
        <div className={`task-item fade-in toast-container`} style={{ 
            borderLeft: `4px solid ${type === 'missed' ? 'var(--missed-color)' : type === 'event' ? 'var(--event-color)' : 'var(--task-color)'}`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--bg-main)', padding: '0.4rem', borderRadius: '8px' }}>
                        {type === 'missed' ? <AlertTriangle size={16} color="var(--missed-color)" /> : 
                         type === 'event' ? <CalendarIcon size={16} color="var(--event-color)" /> : 
                         <Bell size={16} color="var(--task-color)" />}
                    </div>
                    <strong style={{ fontSize: '0.9rem' }}>{title}</strong>
                </div>
                <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={16} />
                </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '2.5rem' }}>{body}</p>
            {isHighPriority && (
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '2.5rem', marginTop: '0.8rem' }}>
                    <button style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer' }} onClick={() => { onDismiss(); }}>Mark as Done</button>
                    <button style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }} onClick={() => { onDismiss(); }}>Snooze</button>
                </div>
            )}
        </div>
    );
};

export default Toast;
