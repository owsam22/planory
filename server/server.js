const express = require('express');
require('dotenv').config();
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { User, Task, Event, Subscription, Config } = require('./models');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'super-secret-key-for-todo-app';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_todo';

app.use(cors());
app.use(bodyParser.json());

// --- Notification Helpers ---
const calculateNotifications = (item, type) => {
    const notifications = [];
    const target = new Date(type === 'task' ? item.deadline : item.start);
    if (!target || isNaN(target.getTime())) return [];

    if (type === 'task') {
        const intervals = [
            { label: '3 day', ms: 3 * 24 * 60 * 60 * 1000 },
            { label: '2 day', ms: 2 * 24 * 60 * 60 * 1000 },
            { label: '1.5 day', ms: 1.5 * 24 * 60 * 60 * 1000 },
            { label: '1 day', ms: 1 * 24 * 60 * 60 * 1000 },
            { label: '20 hr', ms: 20 * 60 * 60 * 1000 },
            { label: '10 hr', ms: 10 * 60 * 60 * 1000 },
            { label: '5 hr', ms: 5 * 60 * 60 * 1000 },
            { label: '2 hr', ms: 2 * 60 * 60 * 1000 },
            { label: '1 hr', ms: 1 * 60 * 60 * 1000 },
            { label: '45 min', ms: 45 * 60 * 1000 },
            { label: '20 min', ms: 20 * 60 * 1000 },
            { label: '10 min', ms: 10 * 60 * 1000 },
            { label: '5 min', ms: 5 * 60 * 1000 }
        ];
        intervals.forEach(int => {
            const time = new Date(target.getTime() - int.ms);
            if (time > new Date()) notifications.push({ time, label: int.label });
        });
    } else {
        const days = [9, 7, 5, 3, 2, 1];
        days.forEach(d => {
            const time = new Date(target.getTime() - d * 24 * 60 * 60 * 1000);
            if (time > new Date()) notifications.push({ time, label: `${d} day` });
        });
    }
    return notifications;
};

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Load or Generate VAPID Keys
async function initVapid() {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        let vapidKeys = await Config.findOne({ key: 'vapidKeys' });
        if (!vapidKeys) {
            const keys = webpush.generateVAPIDKeys();
            vapidKeys = await Config.create({ key: 'vapidKeys', value: keys });
        }
        publicKey = vapidKeys.value.publicKey;
        privateKey = vapidKeys.value.privateKey;
    }
    
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:example@yourdomain.org',
        publicKey,
        privateKey
    );
    console.log('VAPID keys set');
}
initVapid();

// --- Auth Endpoints ---
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, timezone } = req.body;
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'User already exists' });
        
        const newUser = await User.create({ username, password, timezone });
        const token = jwt.sign({ userId: newUser._id }, SECRET_KEY);
        res.json({ token, user: { id: newUser._id, username, timezone: newUser.timezone } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ userId: user._id }, SECRET_KEY);
        res.json({ token, user: { id: user._id, username, timezone: user.timezone } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to verify token
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// --- Task Endpoints ---
app.get('/api/tasks', auth, async (req, res) => {
    const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(tasks.map(t => ({ ...t._doc, id: t._id })));
});

app.post('/api/tasks', auth, async (req, res) => {
    const scheduledNotifications = calculateNotifications(req.body, 'task');
    const newTask = await Task.create({ ...req.body, userId: req.userId, scheduledNotifications });
    sendNotification(req.userId, 'New Task Created ✨', `Successfully created: ${newTask.title}`, 'task', { priority: newTask.priority, tag: newTask._id.toString() });
    
    const taskData = { ...newTask._doc, id: newTask._id };
    io.to(req.userId).emit('taskCreated', taskData);
    res.json(taskData);
});

app.put('/api/tasks/:id', auth, async (req, res) => {
    const scheduledNotifications = calculateNotifications(req.body, 'task');
    const task = await Task.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { ...req.body, scheduledNotifications },
        { returnDocument: 'after' }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const taskData = { ...task._doc, id: task._id };
    io.to(req.userId).emit('taskUpdated', taskData);
    res.json(taskData);
});

app.delete('/api/tasks/:id', auth, async (req, res) => {
    await Task.deleteOne({ _id: req.params.id, userId: req.userId });
    io.to(req.userId).emit('taskDeleted', req.params.id);
    res.json({ success: true });
});

// --- Event Endpoints ---
app.get('/api/events', auth, async (req, res) => {
    const events = await Event.find({ userId: req.userId }).sort({ start: 1 });
    res.json(events.map(e => ({ ...e._doc, id: e._id })));
});

app.post('/api/events', auth, async (req, res) => {
    const scheduledNotifications = calculateNotifications(req.body, 'event');
    const newEvent = await Event.create({ ...req.body, userId: req.userId, scheduledNotifications });
    sendNotification(req.userId, 'New Event Created 📅', `Successfully created: ${newEvent.title}`, 'event', { priority: newEvent.priority, tag: newEvent._id.toString() });
    
    const eventData = { ...newEvent._doc, id: newEvent._id };
    io.to(req.userId).emit('eventCreated', eventData);
    res.json(eventData);
});

app.put('/api/events/:id', auth, async (req, res) => {
    const scheduledNotifications = calculateNotifications(req.body, 'event');
    const event = await Event.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { ...req.body, scheduledNotifications },
        { returnDocument: 'after' }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    const eventData = { ...event._doc, id: event._id };
    io.to(req.userId).emit('eventUpdated', eventData);
    res.json(eventData);
});

app.delete('/api/events/:id', auth, async (req, res) => {
    await Event.deleteOne({ _id: req.params.id, userId: req.userId });
    io.to(req.userId).emit('eventDeleted', req.params.id);
    res.json({ success: true });
});

// --- User Settings ---
app.put('/api/user/settings', auth, async (req, res) => {
    const { timezone, nightMode } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { timezone, nightMode }, { returnDocument: 'after' });
    res.json({ timezone: user.timezone, nightMode: user.nightMode });
});

// --- Subscription Endpoints ---
app.post('/api/subscribe', auth, async (req, res) => {
    const subscription = req.body;
    await Subscription.findOneAndUpdate(
        { userId: req.userId },
        { subscription },
        { upsert: true }
    );
    res.status(201).json({});
});

app.get('/api/vapid-public-key', async (req, res) => {
    const vapidKeys = await Config.findOne({ key: 'vapidKeys' });
    res.json({ publicKey: vapidKeys.value.publicKey });
});

// --- Push Notification Logic ---
async function sendNotification(userId, title, body, type = 'reminder', extra = {}) {
    const subObj = await Subscription.findOne({ userId });
    if (!subObj) return;

    const payload = JSON.stringify({ 
        title, 
        body,
        data: { 
            url: process.env.CLIENT_URL || 'http://localhost:5174/',
            type: type,
            priority: extra.priority || 'Medium',
            tag: extra.tag || `default-tag-${Date.now()}`
        } 
    });
    
    webpush.sendNotification(subObj.subscription, payload)
        .catch(err => console.error('Error sending notification:', err));
}

// --- Cron Job ---
// --- Cron Job (Every minute) ---
cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // 1. Process Scheduled Notifications
    const collections = [Task, Event];
    for (const Model of collections) {
        const items = await Model.find({ 
            completed: false, 
            'scheduledNotifications.time': { $lte: now },
            'scheduledNotifications.sent': false 
        });

        for (const item of items) {
            let skipDueToWorkHours = false;
            
            if (Model === Task && item.tags && item.tags.includes('Work')) {
                const user = await User.findById(item.userId);
                if (user && user.workHours) {
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    const startArr = user.workHours.start.split(':');
                    const endArr = user.workHours.end.split(':');
                    const startTime = parseInt(startArr[0]) * 60 + parseInt(startArr[1]);
                    const endTime = parseInt(endArr[0]) * 60 + parseInt(endArr[1]);
                    const currentTime = currentHour * 60 + currentMinute;
                    
                    if (currentTime < startTime || currentTime > endTime) {
                        skipDueToWorkHours = true;
                    }
                }
            }

            if (skipDueToWorkHours) continue;

            let updated = false;
            for (const sn of item.scheduledNotifications) {
                if (sn.time <= now && !sn.sent) {
                    const type = Model === Task ? 'task' : 'event';
                    const icon = type === 'task' ? '⚠️' : '📅';
                    const extra = { priority: item.priority, tag: item._id.toString() };
                    await sendNotification(item.userId, `${type.charAt(0).toUpperCase() + type.slice(1)} Reminder ${icon}`, `${item.title} in ${sn.label}`, type, extra);
                    sn.sent = true;
                    updated = true;
                }
            }
            if (updated) await item.save();
        }
    }

    // 2. Missed Tasks
    const missedTasks = await Task.find({
        deadline: { $lte: now },
        completed: false,
        'scheduledNotifications.label': { $ne: 'missed' }
    });

    for (const task of missedTasks) {
        await sendNotification(task.userId, 'Missed Task ❗', `Deadline passed: ${task.title}`, 'missed');
        task.scheduledNotifications.push({ time: now, label: 'missed', sent: true });
        await task.save();
    }
});

// --- Socket.io Auth Middleware ---
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.userId = decoded.userId;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`User connected to socket: ${socket.userId}`);
    // Join a room based on userId so we can emit directly to this user's devices
    socket.join(socket.userId);

    socket.on('disconnect', () => {
        console.log(`User disconnected from socket: ${socket.userId}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

