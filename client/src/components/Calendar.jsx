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

    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Fill empty slots for previous month
    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day other-month"></div>);
    }

    // Fill current month days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = new Date(year, month, day).toISOString().split('T')[0];
        const dayItems = items.filter(item => {
            const itemDate = new Date(item.deadline || item.start).toISOString().split('T')[0];
            return itemDate === dateStr;
        });

        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        days.push(
            <div key={day} className={`calendar-day ${isToday ? 'today' : ''}`} onClick={() => onAddClick(new Date(year, month, day))}>
                <span className="calendar-day-number">{day}</span>
                <div className="calendar-dots">
                    {dayItems.map((item, idx) => (
                        <div key={idx} className={`dot ${item.type || 'task'} ${item.priority === 'High' ? 'urgent' : ''}`} title={item.title}></div>
                    ))}
                </div>
            </div>
        );
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
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
    );
};

export default Calendar;
