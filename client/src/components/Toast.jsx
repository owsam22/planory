import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, Calendar as CalendarIcon, CheckCircle, Clock } from 'lucide-react';

const Toast = ({ title, body, type, itemId, isHighPriority, onDismiss, onAction }) => {
    useEffect(() => {
        if (!isHighPriority) {
            const timer = setTimeout(() => {
                onDismiss();
            }, 6000); // Slightly longer for readability
            return () => clearTimeout(timer);
        }
    }, [isHighPriority, onDismiss]);

    const getIcon = () => {
        switch (type) {
            case 'missed': return <AlertTriangle size={20} color="var(--missed-color)" />;
            case 'event': return <CalendarIcon size={20} color="var(--event-color)" />;
            default: return <Bell size={20} color="var(--task-color)" />;
        }
    };

    return (
        <div className="toast-container fade-in" style={{ 
            borderLeft: `6px solid ${type === 'missed' ? 'var(--missed-color)' : type === 'event' ? 'var(--event-color)' : 'var(--task-color)'}`
        }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--bg-main)', padding: '0.6rem', borderRadius: '12px', display: 'flex' }}>
                    {getIcon()}
                </div>
                
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h4>
                        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                            <X size={18} />
                        </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{body}</p>
                    
                    {isHighPriority && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.2rem' }}>
                            <button 
                                className="toast-btn primary"
                                onClick={() => onAction('done', itemId)}
                                style={{ 
                                    flex: 1, 
                                    padding: '0.6rem', 
                                    fontSize: '0.8rem', 
                                    borderRadius: '10px', 
                                    border: 'none', 
                                    background: 'var(--primary)', 
                                    color: 'white', 
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <CheckCircle size={14} /> Mark as Done
                            </button>
                            <button 
                                className="toast-btn secondary"
                                onClick={() => onAction('snooze', itemId)}
                                style={{ 
                                    flex: 1, 
                                    padding: '0.6rem', 
                                    fontSize: '0.8rem', 
                                    borderRadius: '10px', 
                                    border: '1px solid var(--glass-border)', 
                                    background: 'rgba(255,255,255,0.5)', 
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <Clock size={14} /> Snooze
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Toast;
