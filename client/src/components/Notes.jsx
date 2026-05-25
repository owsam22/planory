import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Palette, Trash2, Check, StickyNote } from 'lucide-react';
import { NoteSkeleton } from './Skeleton';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COLORS = [
    'var(--glass)',
    'rgba(242, 109, 91, 0.2)',
    'rgba(244, 208, 63, 0.2)',
    'rgba(88, 214, 141, 0.2)',
    'rgba(93, 173, 226, 0.2)',
    'rgba(175, 122, 197, 0.2)',
    'rgba(158, 197, 122, 0.2)',
    'rgba(242, 155, 44, 0.2)',
];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const getContrastColor = (bgColor) => {
    if (!bgColor) return 'var(--text-main)';
    if (bgColor.startsWith('var(')) return 'var(--text-main)';
    if (bgColor.startsWith('rgba')) return 'var(--text-main)';
    
    if (bgColor.startsWith('#')) {
        let hex = bgColor.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }
    return 'var(--text-main)';
};

const getContrastMutedColor = (bgColor) => {
    if (!bgColor) return 'var(--text-muted)';
    if (bgColor.startsWith('var(')) return 'var(--text-muted)';
    if (bgColor.startsWith('rgba')) return 'var(--text-muted)';
    
    if (bgColor.startsWith('#')) {
        let hex = bgColor.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
    }
    return 'var(--text-muted)';
};

// ─────────────────────────────────────────
// Full-screen note editor overlay
// ─────────────────────────────────────────
const NoteEditorOverlay = ({ note, onClose, onSave, onDelete }) => {
    const isNew = !note;
    const [title, setTitle] = useState(note?.title || '');
    const [content, setContent] = useState(note?.content || '');
    const [color, setColor] = useState(note?.color || COLORS[0]);
    const [showPalette, setShowPalette] = useState(false);
    const textareaRef = useRef(null);
    const backdropRef = useRef(null);

    // Auto-grow textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Focus textarea on open
    useEffect(() => {
        if (!isNew && textareaRef.current) {
            textareaRef.current.focus();
            const len = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(len, len);
        }
    }, []);

    // Escape key closes
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') handleSave(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [title, content, color]);

    const handleSave = () => {
        onSave({ title, content, color });
    };

    const handleBackdropClick = (e) => {
        if (e.target === backdropRef.current) handleSave();
    };

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const textColor = getContrastColor(color);
    const textMutedColor = getContrastMutedColor(color);

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'transparent',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 3000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                animation: 'fadeIn 0.2s ease',
            }}
        >
            <div
                className="note-editor-overlay"
                style={{
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 'clamp(0px, 4vw, 28px)',
                    overflow: 'hidden',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                    background: color === 'var(--glass)' ? 'var(--bg-main)' : `linear-gradient(0deg, ${color}, ${color}), var(--bg-main)`,
                    animation: 'noteOverlayIn 0.3s cubic-bezier(0.16,1,0.3,1)',
                }}
            >
                {/* Top bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.1rem',
                    borderBottom: '1px solid rgba(0,0,0,0.07)',
                    flexShrink: 0,
                }}>
                    {/* Left: palette + delete */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowPalette(p => !p)}
                                style={noteIconBtn}
                                title="Change color"
                            >
                                <Palette size={18} />
                            </button>
                            {showPalette && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    left: 0,
                                    background: 'white',
                                    borderRadius: '16px',
                                    padding: '0.75rem',
                                    boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    zIndex: 10,
                                    display: 'flex',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    maxWidth: '180px',
                                }}>
                                    {COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => { setColor(c); setShowPalette(false); }}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: c === 'var(--glass)' ? '#f0ede6' : c,
                                                border: color === c ? '3px solid var(--primary)' : '2px solid rgba(0,0,0,0.1)',
                                                cursor: 'pointer',
                                                transition: 'transform 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        />
                                    ))}
                                    <div style={{ position: 'relative', width: '28px', height: '28px', cursor: 'pointer' }} title="Custom Color">
                                        <input
                                            type="color"
                                            value={color.startsWith('#') ? color : '#ffffff'}
                                            onChange={(e) => setColor(e.target.value)}
                                            style={{
                                                opacity: 0,
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                cursor: 'pointer',
                                                padding: 0,
                                                margin: 0,
                                                border: 'none',
                                            }}
                                        />
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                                            border: (!COLORS.includes(color) && color.startsWith('#')) ? '3px solid var(--primary)' : '2px solid rgba(0,0,0,0.1)',
                                            pointerEvents: 'none'
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isNew && onDelete && (
                            <button
                                onClick={onDelete}
                                style={{ ...noteIconBtn, color: '#e74c3c' }}
                                title="Delete note"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {/* Right: Save + Close */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                padding: '0.45rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(242,109,91,0.3)',
                            }}
                        >
                            <Check size={15} />
                            {isNew ? 'Save' : 'Done'}
                        </button>
                        <button
                            onClick={handleSave}
                            style={noteIconBtn}
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Editor body — scrollable */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                }}>
                    <input
                        autoFocus={isNew}
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            color: textColor,
                            letterSpacing: '-0.02em',
                        }}
                    />
                    <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                    <textarea
                        ref={textareaRef}
                        placeholder={`Write your note here...\n\nYou can jot down ideas, reminders, or anything important.`}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            resize: 'none',
                            fontSize: '1rem',
                            lineHeight: 1.7,
                            fontFamily: 'inherit',
                            color: textColor,
                            minHeight: '220px',
                            overflow: 'hidden',
                        }}
                    />
                </div>

                {/* Footer */}
                <div style={{
                    padding: '0.65rem 1.5rem',
                    borderTop: '1px solid rgba(0,0,0,0.07)',
                    fontSize: '0.73rem',
                    color: textMutedColor,
                    display: 'flex',
                    gap: '0.5rem',
                    flexShrink: 0,
                }}>
                    <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                    <span>·</span>
                    <span>{content.length} chars</span>
                </div>
            </div>

            <style>{`
                @keyframes noteOverlayIn {
                    from { opacity: 0; transform: scale(0.96) translateY(12px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @media (max-width: 480px) {
                    .note-overlay-inner {
                        border-radius: 0 !important;
                        max-height: 100% !important;
                        height: 100% !important;
                    }
                }
            `}</style>
        </div>
    );
};

const noteIconBtn = {
    background: 'rgba(0,0,0,0.06)',
    border: 'none',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
};

// ─────────────────────────────────────────
// Main Notes component
// ─────────────────────────────────────────
const Notes = ({ user, notes, setNotes, isLoading }) => {
    const [activeNote, setActiveNote] = useState(null); // null | 'new' | noteObj
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // Create
    const handleCreate = async ({ title, content, color }) => {
        setActiveNote(null);
        if (!title.trim() && !content.trim()) return;
        try {
            const res = await fetch(`${API_URL}/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ title, content, color }),
            });
            if (res.ok) {
                const created = await res.json();
                setNotes(prev => {
                    if (prev.some(n => n.id === created.id)) return prev;
                    return [...prev, created].sort((a, b) => a.order - b.order);
                });
            }
        } catch (err) {}
    };

    // Update
    const handleUpdate = async (id, updates) => {
        setActiveNote(null);
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        try {
            await fetch(`${API_URL}/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(updates),
            });
        } catch (err) {}
    };

    // Delete
    const handleDelete = async (id) => {
        setActiveNote(null);
        setNotes(prev => prev.filter(n => n.id !== id));
        try {
            await fetch(`${API_URL}/api/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` },
            });
        } catch (err) {}
    };

    // Drag-and-drop reorder
    const handleSort = async () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        let _notes = [...notes];
        const dragged = _notes.splice(dragItem.current, 1)[0];
        _notes.splice(dragOverItem.current, 0, dragged);
        const updates = _notes.map((n, i) => ({ id: n.id, order: i * 1024 }));
        setNotes(_notes.map((n, i) => ({ ...n, order: updates[i].order })));
        dragItem.current = null;
        dragOverItem.current = null;
        try {
            await fetch(`${API_URL}/api/notes/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ updates }),
            });
        } catch (err) {}
    };

    return (
        <div className="fade-in notes-container" style={{ paddingBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Notes</h2>

            {/* "Take a note" trigger */}
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={() => setActiveNote('new')}
                    style={{
                        width: '100%',
                        maxWidth: '600px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.9rem 1.25rem',
                        background: 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '20px',
                        boxShadow: 'var(--shadow)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '1rem',
                        transition: 'all 0.25s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                >
                    <Plus size={20} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Take a note...</span>
                </button>
            </div>

            {/* Notes grid */}
            <div className="notes-grid">
                {isLoading ? (
                    <><NoteSkeleton /><NoteSkeleton /><NoteSkeleton /><NoteSkeleton /></>
                ) : (
                    notes.map((note, index) => {
                        const cardTextColor = getContrastColor(note.color);
                        const cardTextMutedColor = getContrastMutedColor(note.color);
                        return (
                        <div
                            key={note.id}
                            className="glass-card note-card"
                            draggable
                            onDragStart={e => { dragItem.current = index; e.currentTarget.style.opacity = '0.4'; }}
                            onDragEnter={() => { dragOverItem.current = index; }}
                            onDragEnd={e => { e.currentTarget.style.opacity = '1'; handleSort(); }}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => setActiveNote(note)}
                            style={{
                                background: note.color,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                position: 'relative',
                                minHeight: '120px',
                            }}
                        >
                            {note.title && (
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, color: cardTextColor }}>
                                    {note.title}
                                </h3>
                            )}
                            {note.content && (
                                <p style={{
                                    fontSize: '0.875rem',
                                    color: cardTextMutedColor,
                                    lineHeight: 1.55,
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 7,
                                    WebkitBoxOrient: 'vertical',
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {note.content}
                                </p>
                            )}
                            {!note.title && !note.content && (
                                <p style={{ color: cardTextMutedColor, fontSize: '0.85rem', fontStyle: 'italic' }}>
                                    Empty note
                                </p>
                            )}
                        </div>
                        );
                    })
                )}
            </div>

            {notes.length === 0 && !isLoading && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem', opacity: 0.5 }}>
                    <StickyNote size={48} style={{ marginBottom: '1rem' }} />
                    <p>Notes you add appear here</p>
                </div>
            )}

            {/* ── Overlay for new note ── */}
            {activeNote === 'new' && (
                <NoteEditorOverlay
                    note={null}
                    onClose={() => setActiveNote(null)}
                    onSave={handleCreate}
                />
            )}

            {/* ── Overlay for editing existing note ── */}
            {activeNote && activeNote !== 'new' && (
                <NoteEditorOverlay
                    note={activeNote}
                    onClose={() => setActiveNote(null)}
                    onSave={({ title, content, color }) => handleUpdate(activeNote.id, { title, content, color })}
                    onDelete={() => handleDelete(activeNote.id)}
                />
            )}
        </div>
    );
};

export default Notes;
