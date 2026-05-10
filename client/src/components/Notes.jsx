import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Palette, Trash2, Check } from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const COLORS = [
    'var(--glass)',          // Default
    'rgba(242, 109, 91, 0.2)', // Red/Orange
    'rgba(244, 208, 63, 0.2)', // Yellow
    'rgba(88, 214, 141, 0.2)', // Green
    'rgba(93, 173, 226, 0.2)', // Blue
    'rgba(175, 122, 197, 0.2)', // Purple
    'rgba(158, 197, 122, 0.2)', // Light Green
    'rgba(242, 155, 44, 0.2)' // Light golden
];

const Notes = ({ user, notes, setNotes }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newNote, setNewNote] = useState({ title: '', content: '', color: COLORS[0] });
    
    // Drag and drop state
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleCreate = async () => {
        if (!newNote.title.trim() && !newNote.content.trim()) {
            setIsCreating(false);
            return;
        }

        const noteToCreate = { ...newNote };
        setNewNote({ title: '', content: '', color: COLORS[0] });
        setIsCreating(false);

        try {
            const res = await fetch(`${API_URL}/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(noteToCreate)
            });
            if (res.ok) {
                const created = await res.json();
                setNotes(prev => {
                    if (prev.some(n => n.id === created.id)) return prev;
                    return [...prev, created].sort((a, b) => a.order - b.order);
                });
            }
        } catch (err) { }
    };

    const handleDelete = async (id) => {
        try {
            await fetch(`${API_URL}/api/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (err) { }
    };

    const handleUpdate = async (id, updates) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        try {
            await fetch(`${API_URL}/api/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify(updates)
            });
        } catch (err) { }
    };

    const handleSort = async () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        
        let _notes = [...notes];
        const draggedItemContent = _notes.splice(dragItem.current, 1)[0];
        _notes.splice(dragOverItem.current, 0, draggedItemContent);
        
        // Re-calculate orders based on new positions
        // We'll just evenly space them based on index to keep it simple, or assign order = index * 1024
        const updates = _notes.map((n, idx) => ({ id: n.id, order: idx * 1024 }));
        
        // Optimistic UI update
        const sortedNotes = _notes.map((n, idx) => ({ ...n, order: updates[idx].order }));
        setNotes(sortedNotes);
        
        dragItem.current = null;
        dragOverItem.current = null;

        try {
            await fetch(`${API_URL}/api/notes/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
                body: JSON.stringify({ updates })
            });
        } catch (err) { }
    };

    return (
        <div className="fade-in notes-container" style={{ paddingBottom: '4rem' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Notes</h2>

            {/* Create Note Section */}
            <div className="note-create-wrapper" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'center' }}>
                <div 
                    className="glass-card new-note-card" 
                    style={{ 
                        width: '100%', 
                        maxWidth: '600px', 
                        background: newNote.color,
                        padding: isCreating ? '1rem' : '0.8rem 1rem',
                        cursor: isCreating ? 'default' : 'text',
                        transition: 'all 0.3s ease'
                    }}
                    onClick={() => !isCreating && setIsCreating(true)}
                >
                    {isCreating ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Title" 
                                value={newNote.title}
                                onChange={e => setNewNote({...newNote, title: e.target.value})}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', outline: 'none', color: 'var(--text-main)' }}
                            />
                            <textarea 
                                placeholder="Take a note..." 
                                value={newNote.content}
                                onChange={e => setNewNote({...newNote, content: e.target.value})}
                                rows={3}
                                style={{ background: 'transparent', border: 'none', resize: 'none', outline: 'none', color: 'var(--text-main)', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {COLORS.map(c => (
                                        <div 
                                            key={c}
                                            onClick={(e) => { e.stopPropagation(); setNewNote({...newNote, color: c}); }}
                                            style={{ 
                                                width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer',
                                                border: newNote.color === c ? '2px solid var(--text-main)' : '1px solid var(--glass-border)'
                                            }}
                                        />
                                    ))}
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                                    style={{ background: 'none', border: 'none', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                            <span style={{ flex: 1, fontWeight: 500 }}>Take a note...</span>
                            <Plus size={20} />
                        </div>
                    )}
                </div>
            </div>

            {/* Notes Grid */}
            <div className="notes-grid">
                {notes.map((note, index) => (
                    <NoteCard 
                        key={note.id} 
                        note={note} 
                        index={index}
                        onUpdate={(updates) => handleUpdate(note.id, updates)}
                        onDelete={() => handleDelete(note.id)}
                        dragItem={dragItem}
                        dragOverItem={dragOverItem}
                        handleSort={handleSort}
                    />
                ))}
            </div>
            {notes.length === 0 && !isCreating && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4rem', opacity: 0.5 }}>
                    <Palette size={48} style={{ marginBottom: '1rem' }} />
                    <p>Notes you add appear here</p>
                </div>
            )}
        </div>
    );
};

const NoteCard = ({ note, index, onUpdate, onDelete, dragItem, dragOverItem, handleSort }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ title: note.title, content: note.content, color: note.color });
    const [showPalette, setShowPalette] = useState(false);

    const handleSave = () => {
        setIsEditing(false);
        if (editData.title !== note.title || editData.content !== note.content || editData.color !== note.color) {
            onUpdate(editData);
        }
    };

    return (
        <div 
            className="glass-card note-card"
            draggable
            onDragStart={(e) => { dragItem.current = index; e.currentTarget.style.opacity = '0.4'; }}
            onDragEnter={(e) => { dragOverItem.current = index; }}
            onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; handleSort(); }}
            onDragOver={(e) => e.preventDefault()}
            style={{ 
                background: note.color, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.8rem',
                cursor: isEditing ? 'default' : 'grab',
                position: 'relative'
            }}
            onClick={() => !isEditing && setIsEditing(true)}
        >
            {isEditing ? (
                <>
                    <input 
                        autoFocus
                        type="text" 
                        value={editData.title}
                        onChange={e => setEditData({...editData, title: e.target.value})}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', outline: 'none', color: 'var(--text-main)' }}
                    />
                    <textarea 
                        value={editData.content}
                        onChange={e => setEditData({...editData, content: e.target.value})}
                        rows={5}
                        style={{ background: 'transparent', border: 'none', resize: 'none', outline: 'none', color: 'var(--text-main)', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowPalette(!showPalette); }}
                                className="note-action-btn"
                            >
                                <Palette size={16} />
                            </button>
                            {showPalette && (
                                <div className="color-palette-popup" style={{ display: 'flex', gap: '0.3rem', position: 'absolute', bottom: '100%', left: 0, background: 'var(--glass)', padding: '0.5rem', borderRadius: '8px', boxShadow: 'var(--shadow)', zIndex: 10 }}>
                                    {COLORS.map(c => (
                                        <div 
                                            key={c}
                                            onClick={(e) => { e.stopPropagation(); setEditData({...editData, color: c}); setShowPalette(false); onUpdate({ color: c }); }}
                                            style={{ 
                                                width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer',
                                                border: editData.color === c ? '2px solid var(--text-main)' : '1px solid var(--glass-border)'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="note-action-btn delete-btn">
                                <Trash2 size={16} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="note-action-btn save-btn">
                                <Check size={16} />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {note.title && <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{note.title}</h3>}
                    {note.content && <p style={{ whiteSpace: 'pre-wrap', flex: 1, overflow: 'hidden' }}>{note.content}</p>}
                </>
            )}
        </div>
    );
};

export default Notes;
