import React, { useState } from 'react';
import {
    X, Trash2, Calendar, CheckCircle, Circle, Zap, Flag,
    Clock, FileText, Edit3, Check, AlertCircle
} from 'lucide-react';
import { formatDeadline, isOverdue } from '../utils/parser';
import { renderClickableLinks } from '../utils/linkify';

// ItemDetailOverlay: shows details of a task or event in a premium overlay.
// Props:
//   item: the task or event object
//   user: for timezone
//   onClose: () => void
//   onEdit: (item) => void  — triggers the editing form
//   onDelete: (id, type) => void
//   onToggleComplete: (task) => void  — only for tasks
const ItemDetailOverlay = ({ item, user, onClose, onEdit, onDelete, onToggleComplete }) => {
    const isTask = item.type === 'task';
    const overdue = !item.completed && !item.missed && (isTask ? isOverdue(item.deadline, item.completed) : isOverdue(item.start, false));
    const dateStr = formatDeadline(item.deadline || item.start, user?.user?.timezone);

    const accentColor = isTask ? 'var(--task-color)' : 'var(--event-color)';
    const badgeBg = isTask
        ? (item.missed || overdue ? 'rgba(231,76,60,0.12)' : 'rgba(52,152,219,0.12)')
        : (item.missed || overdue ? 'rgba(231,76,60,0.12)' : 'rgba(155,89,182,0.12)');

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="item-overlay-backdrop" onClick={handleBackdropClick}>
            <div className="item-overlay-panel fade-in">

                {/* Accent strip */}
                <div className="item-overlay-strip" style={{ background: item.missed || overdue ? 'var(--missed-color)' : accentColor }} />

                {/* Top bar */}
                <div className="item-overlay-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {item.missed ? (
                            <span className="item-overlay-type-badge" style={{ background: 'rgba(231,76,60,0.12)', color: 'var(--missed-color)' }}>
                                <AlertCircle size={12} />
                                Missed
                            </span>
                        ) : overdue ? (
                            <span className="item-overlay-type-badge" style={{ background: badgeBg, color: 'var(--missed-color)' }}>
                                <AlertCircle size={12} />
                                Overdue
                            </span>
                        ) : (
                            <span className="item-overlay-type-badge" style={{ background: badgeBg, color: accentColor }}>
                                {isTask ? <Flag size={12} /> : <Calendar size={12} />}
                                {isTask ? 'Task' : 'Event'}
                            </span>
                        )}
                        {item.priority && (
                            <span className="item-overlay-priority-badge" style={{
                                background: item.priority === 'High' ? 'rgba(243,156,18,0.15)' : item.priority === 'Low' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.06)',
                                color: item.priority === 'High' ? 'var(--urgent-color)' : 'var(--text-muted)'
                            }}>
                                {item.priority === 'High' && <Zap size={11} />}
                                {item.priority}
                            </span>
                        )}
                    </div>
                    <button className="item-overlay-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Main content */}
                <div className="item-overlay-body">
                    {/* Complete toggle for tasks */}
                    {isTask && (
                        <div className="item-overlay-complete-row">
                            <button
                                className="item-overlay-complete-btn"
                                onClick={() => { onToggleComplete(item); onClose(); }}
                                style={{ color: item.completed ? 'var(--retro-teal)' : '#d1d5db' }}
                            >
                                {item.completed
                                    ? <CheckCircle size={28} />
                                    : <Circle size={28} />
                                }
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: item.completed ? 'var(--retro-teal)' : 'var(--text-muted)' }}>
                                    {item.completed ? 'Completed' : 'Mark as done'}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Title */}
                    <h2 className="item-overlay-title" style={{
                        textDecoration: item.completed ? 'line-through' : 'none',
                        opacity: item.completed ? 0.6 : 1
                    }}>
                        {item.title}
                    </h2>

                    {/* Date/time row */}
                    {dateStr && (
                        <div className="item-overlay-meta-row">
                            <div className="item-overlay-meta-icon" style={{ background: overdue ? 'rgba(231,76,60,0.1)' : 'rgba(0,0,0,0.05)' }}>
                                <Clock size={16} style={{ color: overdue ? 'var(--missed-color)' : accentColor }} />
                            </div>
                            <div>
                                <p className="item-overlay-meta-label">{isTask ? 'Deadline' : 'Starts at'}</p>
                                <p className="item-overlay-meta-value" style={{ color: overdue ? 'var(--missed-color)' : 'var(--text-main)' }}>
                                    {dateStr}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {item.notes && (
                        <div className="item-overlay-notes-section">
                            <div className="item-overlay-meta-row" style={{ alignItems: 'flex-start' }}>
                                <div className="item-overlay-meta-icon" style={{ background: 'rgba(0,0,0,0.05)' }}>
                                    <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p className="item-overlay-meta-label">Notes</p>
                                    <p className="item-overlay-notes-text" style={{ whiteSpace: 'pre-wrap' }}>{renderClickableLinks(item.notes)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="item-overlay-footer">
                    <button
                        className="item-overlay-action-btn delete"
                        onClick={() => { onDelete(item.id, item.type); onClose(); }}
                    >
                        <Trash2 size={18} />
                        Delete
                    </button>
                    <button
                        className="item-overlay-action-btn edit"
                        style={{ background: accentColor }}
                        onClick={() => { onClose(); onEdit(item); }}
                    >
                        <Edit3 size={18} />
                        Edit {isTask ? 'Task' : 'Event'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ItemDetailOverlay;
