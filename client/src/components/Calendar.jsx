import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatDeadline } from '../utils/parser';

const Calendar = ({ items, onAddClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const [selectedDate, setSelectedDate] = useState(null);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const renderDayItems = () => {
        if (!selectedDate) return null;
        const dateStr = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : null;
        const dayItems = items.filter(item => {
            const itemDate = new Date(item.deadline || item.start);
            const iy = itemDate.getFullYear();
            const im = String(itemDate.getMonth() + 1).padStart(2, '0');
            const id = String(itemDate.getDate()).padStart(2, '0');
            const itemDateStr = `${iy}-${im}-${id}`;
            return itemDateStr === dateStr;
        });

        return (
            <div className="calendar-day-details fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}</h3>
                    <button 
                        onClick={() => onAddClick(selectedDate)}
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Add New
                    </button>
                </div>
                {dayItems.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No items for this day.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {dayItems.map(item => (
                            <div key={item.id} className={`task-item ${item.type}`} style={{ padding: '0.75rem', marginBottom: 0, fontSize: '0.9rem' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600 }}>{item.title}</p>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDeadline(item.deadline || item.start)}</p>
                                </div>
                                {item.priority === 'High' && <div className="dot urgent" style={{ width: '8px', height: '8px' }}></div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Fill empty slots for previous month
    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day other-month"></div>);
    }

    // Fill current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const dayItems = items.filter(item => {
            const itemDate = new Date(item.deadline || item.start);
            const iy = itemDate.getFullYear();
            const im = String(itemDate.getMonth() + 1).padStart(2, '0');
            const id = String(itemDate.getDate()).padStart(2, '0');
            const itemDateStr = `${iy}-${im}-${id}`;
            return itemDateStr === dateStr;
        });

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const isToday = todayStr === dateStr;
        const isSelected = selectedDate && `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` === dateStr;

        days.push(
            <div 
                key={day} 
                className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`} 
                onClick={() => setSelectedDate(date)}
            >
                <span className="calendar-day-number">{day}</span>
                <div className="calendar-dots">
                    {dayItems.slice(0, 3).map((item, idx) => (
                        <div key={idx} className={`dot ${item.type || 'task'} ${item.priority === 'High' ? 'urgent' : ''}`} title={item.title}></div>
                    ))}
                    {dayItems.length > 3 && <span className="dot-more">+{dayItems.length - 3}</span>}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card fade-in">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>{monthNames[month]} {year}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={prevMonth} className="nav-item" style={{ padding: '0.5rem', width: 'auto', marginBottom: 0 }}><ChevronLeft size={20} /></button>
                        <button onClick={nextMonth} className="nav-item" style={{ padding: '0.5rem', width: 'auto', marginBottom: 0 }}><ChevronRight size={20} /></button>
                    </div>
                </header>

                <div className="calendar-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '0.5rem' }}>{d}</div>
                    ))}
                    {days}
                </div>
            </div>
            {renderDayItems()}
        </div>
    );
};

export default Calendar;
