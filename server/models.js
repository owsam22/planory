const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    nightMode: { type: Boolean, default: false }
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
    scheduledNotifications: [{
        time: Date,
        label: String,
        sent: { type: Boolean, default: false }
    }],
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
    createdAt: { type: Date, default: Date.now }
});

const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    subscription: { type: Object, required: true }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: { type: Object }
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Event = mongoose.model('Event', eventSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);
const Config = mongoose.model('Config', configSchema);

module.exports = { User, Task, Event, Subscription, Config };

