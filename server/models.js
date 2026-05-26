const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    username: { type: String, required: true },
    password: { type: String },
    avatar: { type: String },
    timezone: { type: String, default: 'Asia/Kolkata' },
    nightMode: { type: Boolean, default: false },
    workHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' }
    },
    dailyReminder: {
        enabled: { type: Boolean, default: false },
        time: { type: String, default: '12:00' },
        text: { type: String, default: 'Time for coding!' },
        lastSentTime: { type: Date },
        lastCompletedDate: { type: String }
    }
});

const taskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    notes: { type: String },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    deadline: { type: Date },
    reminder: { type: Date },
    completed: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
    sentNotifications: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    scheduledNotifications: [{
        time: Date,
        label: String,
        sent: { type: Boolean, default: false }
    }],
    snoozeUntil: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    notes: { type: String },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    start: { type: Date, required: true },
    end: { type: Date },
    reminder: { type: Date },
    completed: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
    sentNotifications: { type: [String], default: [] },
    scheduledNotifications: [{
        time: Date,
        label: String,
        sent: { type: Boolean, default: false }
    }],
    snoozeUntil: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: { type: Object, required: true }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: { type: Object }
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Event = mongoose.model('Event', eventSchema);
const Note = mongoose.model('Note', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    color: { type: String, default: 'var(--glass)' },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}));
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Config = mongoose.model('Config', configSchema);

module.exports = { User, Task, Event, Note, Subscription, Config };

