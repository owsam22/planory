/**
 * Planory Smart Parser
 * Parses a natural language string into a structured task/event object.
 * Examples:
 *   "urgent meeting tomorrow at 3pm"
 *   "submit report by April 30"
 *   "call dentist next Monday morning"
 *   "gym in 2 hours"
 */

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const MONTHS = {
    january:0, jan:0, february:1, feb:1, march:2, mar:2,
    april:3, apr:3, may:4, june:5, jun:5, july:6, jul:6,
    august:7, aug:7, september:8, sep:8, october:9, oct:9,
    november:10, nov:10, december:11, dec:11
};

/** Return a new Date set to midnight (start of day) */
const startOfDay = (d) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
};

export const parseTaskString = (input) => {
    if (!input || !input.trim()) return { title: '', deadline: '', reminder: true, priority: 'Medium', notes: '', type: 'task' };

    const now = new Date();
    let title = input.trim();
    let deadline = null;
    let priority = 'Medium';
    let type = 'task';

    const lower = input.toLowerCase();

    // ── 1. PRIORITY detection ─────────────────────────────────────────────────
    if (/\b(urgent|asap|critical|immediately|high priority)\b/.test(lower)) {
        priority = 'High';
        title = title.replace(/\b(urgent|asap|critical|immediately|high priority)\b/gi, '').trim();
    } else if (/\b(low priority|whenever|someday|not urgent)\b/.test(lower)) {
        priority = 'Low';
        title = title.replace(/\b(low priority|whenever|someday|not urgent)\b/gi, '').trim();
    }

    // ── 2. EVENT TYPE detection ───────────────────────────────────────────────
    if (/\b(meeting|call|event|appointment|interview|standup|sync|review|demo|conference)\b/.test(lower)) {
        type = 'event';
    } else if (/\b(remind|reminder|don'?t forget|alert)\b/.test(lower)) {
        type = 'reminder';
    }

    // ── 3. RELATIVE DAY keywords ──────────────────────────────────────────────
    const relativeMap = { today: 0, tonight: 0, tomorrow: 1, 'day after tomorrow': 2, 'next week': 7 };
    for (const [kw, days] of Object.entries(relativeMap)) {
        if (lower.includes(kw)) {
            deadline = new Date(now);
            deadline.setDate(deadline.getDate() + days);
            title = title.replace(new RegExp(kw, 'gi'), '').trim();
            break;
        }
    }

    // ── 4. NEXT [weekday] ────────────────────────────────────────────────────
    const nextDayMatch = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (nextDayMatch && !deadline) {
        const targetDay = WEEKDAYS.indexOf(nextDayMatch[1].toLowerCase());
        const todayDay = now.getDay();
        let diff = targetDay - todayDay;
        if (diff <= 0) diff += 7;
        diff += 7; // always "next" week
        deadline = new Date(now);
        deadline.setDate(deadline.getDate() + diff);
        title = title.replace(nextDayMatch[0], '').trim();
    }

    // ── 5. THIS [weekday] ────────────────────────────────────────────────────
    const thisDayMatch = lower.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (thisDayMatch && !deadline) {
        const targetDay = WEEKDAYS.indexOf(thisDayMatch[1].toLowerCase());
        const todayDay = now.getDay();
        let diff = targetDay - todayDay;
        if (diff < 0) diff += 7;
        deadline = new Date(now);
        deadline.setDate(deadline.getDate() + diff);
        title = title.replace(thisDayMatch[0], '').trim();
    }

    // ── 6. IN X HOURS / DAYS ─────────────────────────────────────────────────
    const inHoursMatch = lower.match(/in\s+(\d+)\s+hours?/i);
    if (inHoursMatch && !deadline) {
        deadline = new Date(now);
        deadline.setHours(deadline.getHours() + parseInt(inHoursMatch[1]));
        title = title.replace(inHoursMatch[0], '').trim();
    }

    const inDaysMatch = lower.match(/in\s+(\d+)\s+days?/i);
    if (inDaysMatch && !deadline) {
        deadline = new Date(now);
        deadline.setDate(deadline.getDate() + parseInt(inDaysMatch[1]));
        title = title.replace(inDaysMatch[0], '').trim();
    }

    // ── 7. MONTH DAY (e.g. "April 30", "Dec 5", "30 April") ─────────────────
    if (!deadline) {
        const monthDayMatch = lower.match(
            /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b/i
        );
        const dayMonthMatch = lower.match(
            /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i
        );
        const match = monthDayMatch || dayMonthMatch;
        if (match) {
            const monthStr = monthDayMatch ? monthDayMatch[1] : dayMonthMatch[2];
            const dayStr = monthDayMatch ? monthDayMatch[2] : dayMonthMatch[1];
            const month = MONTHS[monthStr.toLowerCase()];
            const day = parseInt(dayStr);
            deadline = new Date(now.getFullYear(), month, day);
            if (deadline < now) deadline.setFullYear(deadline.getFullYear() + 1);
            title = title.replace(match[0], '').trim();
        }
    }

    // ── 8. TIME parsing (12hr: "3pm", "3:30pm", "10:00 am") ─────────────────
    const timeMatch12 = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (timeMatch12) {
        let hours = parseInt(timeMatch12[1]);
        const mins = timeMatch12[2] ? parseInt(timeMatch12[2]) : 0;
        const ampm = timeMatch12[3].toLowerCase();
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        if (!deadline) deadline = new Date(now);
        deadline.setHours(hours, mins, 0, 0);
        title = title.replace(timeMatch12[0], '').trim();
    }

    // ── 9. TIME parsing (24hr: "14:30", "09:00") ─────────────────────────────
    const timeMatch24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (timeMatch24 && !timeMatch12) {
        if (!deadline) deadline = new Date(now);
        deadline.setHours(parseInt(timeMatch24[1]), parseInt(timeMatch24[2]), 0, 0);
        title = title.replace(timeMatch24[0], '').trim();
    }

    // ── 10. TIME-OF-DAY words ────────────────────────────────────────────────
    if (!timeMatch12 && !timeMatch24) {
        if (lower.includes('morning')) {
            if (!deadline) { deadline = new Date(now); }
            deadline.setHours(9, 0, 0, 0);
            title = title.replace(/morning/gi, '').trim();
        } else if (lower.includes('afternoon')) {
            if (!deadline) { deadline = new Date(now); }
            deadline.setHours(14, 0, 0, 0);
            title = title.replace(/afternoon/gi, '').trim();
        } else if (lower.includes('evening')) {
            if (!deadline) { deadline = new Date(now); }
            deadline.setHours(18, 0, 0, 0);
            title = title.replace(/evening/gi, '').trim();
        } else if (lower.includes('night') || lower.includes('tonight')) {
            if (!deadline) { deadline = new Date(now); }
            deadline.setHours(21, 0, 0, 0);
            title = title.replace(/night|tonight/gi, '').trim();
        } else if (lower.includes('midnight')) {
            if (!deadline) { deadline = new Date(now); }
            deadline.setHours(23, 59, 0, 0);
            title = title.replace(/midnight/gi, '').trim();
        }
    }

    // ── 11. Clean up title ───────────────────────────────────────────────────
    // Remove leading prepositions and filler words
    title = title
        .replace(/\b(by|at|on|for|the|a|an|to)\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Remove trailing punctuation
    title = title.replace(/[.,;:!?]+$/, '').trim();

    // Capitalize first letter
    if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // If title is empty after cleanup, restore original (minus known keywords)
    if (!title.trim()) {
        title = input.replace(/\b(tomorrow|today|tonight|next week|morning|evening|afternoon|night|midnight|urgent|asap|by|at|on)\b/gi, '').trim();
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    return {
        title: title || input,
        deadline: deadline ? deadline.toISOString().slice(0, 16) : '',
        reminder: !!deadline,
        priority,
        notes: '',
        type,
    };
};

/** Format a deadline string for display */
export const formatDeadline = (deadlineStr, timezone = 'Asia/Kolkata') => {
    if (!deadlineStr) return null;
    const d = new Date(deadlineStr);
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    today.setHours(0,0,0,0);
    
    const target = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
    target.setHours(0,0,0,0);
    
    const diffDays = Math.round((target - today) / 86400000);

    let dateLabel;
    if (diffDays === 0) dateLabel = 'Today';
    else if (diffDays === 1) dateLabel = 'Tomorrow';
    else if (diffDays === -1) dateLabel = 'Yesterday';
    else if (diffDays < 0) dateLabel = `${Math.abs(diffDays)}d ago`;
    else dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });

    const timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
    return `${dateLabel}, ${timeLabel}`;
};

/** Check if a deadline is overdue */
export const isOverdue = (deadlineStr, completed) => {
    if (!deadlineStr || completed) return false;
    return new Date(deadlineStr) < new Date();
};
