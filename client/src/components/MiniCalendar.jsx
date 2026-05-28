import React from 'react';

const MiniCalendar = ({ selectedDate, onDateSelect, items }) => {
    const today = new Date();
    const days = [];

    // Generate a week around the selected date or today
    const startDate = new Date(selectedDate || today);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const isSelected = selectedDate && `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` === dateStr;
        const isToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` === dateStr;

        const dayItems = items.filter(item => {
            const itemDate = new Date(item.deadline || item.start);
            const iy = itemDate.getFullYear();
            const im = String(itemDate.getMonth() + 1).padStart(2, '0');
            const id = String(itemDate.getDate()).padStart(2, '0');
            const itemDateStr = `${iy}-${im}-${id}`;
            return itemDateStr === dateStr;
        });

        days.push(
            <div
                key={i}
                className={`mini-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => onDateSelect(date)}
            >
                <span className="mini-day-name">{dayNames[i]}</span>
                <span className="mini-day-number">{date.getDate()}</span>
                {dayItems.length > 0 && <div className="mini-day-dot"></div>}
            </div>
        );
    }

    return (
        <div className="mini-calendar-wrapper">
            <div className="mini-calendar-scroll">
                {days}
            </div>
        </div>
    );
};

export default MiniCalendar;
