const express = require('express');
require('dotenv').config();
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { User, Task, Event, Note, Subscription, Config } = require('./models');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
app.use((req, res, next) => {
    // Permissive COOP for Google Auth popups
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
});

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
            { label: '30 min', ms: 30 * 60 * 1000 },
            { label: '20 min', ms: 20 * 60 * 1000 },
            { label: '10 min', ms: 10 * 60 * 1000 },
            { label: '5 min', ms: 5 * 60 * 1000 },
            { label: '1 min', ms: 1 * 60 * 1000 },
            { label: 'due', ms: 0 }
        ];
        intervals.forEach(int => {
            const time = new Date(target.getTime() - int.ms);
            // Allow scheduling if it's in the future OR within the last minute (to catch current)
            if (time > new Date(Date.now() - 30000)) notifications.push({ time, label: int.label });
        });
    } else {
        const days = [9, 7, 5, 3, 2, 1];
        const intervals = [
            { label: '1 hr', ms: 1 * 60 * 60 * 1000 },
            { label: '30 min', ms: 30 * 60 * 1000 },
            { label: '10 min', ms: 10 * 60 * 1000 },
            { label: '1 min', ms: 1 * 60 * 1000 },
            { label: 'starting now', ms: 0 }
        ];
        days.forEach(d => {
            const time = new Date(target.getTime() - d * 24 * 60 * 60 * 1000);
            if (time > new Date()) notifications.push({ time, label: `${d} day` });
        });
        intervals.forEach(int => {
            const time = new Date(target.getTime() - int.ms);
            if (time > new Date(Date.now() - 30000)) notifications.push({ time, label: int.label });
        });
    }
    return notifications;
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        // Drop old unique indexes that might conflict with multi-device support
        try {
            const admin = mongoose.connection.db.admin();
            const collections = await mongoose.connection.db.listCollections({ name: 'subscriptions' }).toArray();
            if (collections.length > 0) {
                const SubscriptionColl = mongoose.connection.db.collection('subscriptions');
                // We drop these because our logic now handles uniqueness and we want to allow multiple devices (userId)
                // and avoid E11000 crashes on endpoint (we delete old ones manually now)
                await SubscriptionColl.dropIndex('userId_1').catch(() => {});
                await SubscriptionColl.dropIndex('subscription.endpoint_1').catch(() => {});
                console.log('Stale subscription indexes cleared');
            }
        } catch (err) {
            console.log('Index cleanup skipped or not needed');
        }
    })
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
        process.env.VAPID_EMAIL || 'mailto:support@planory.app',
        publicKey,
        privateKey
    );
    console.log('VAPID keys set');
}
initVapid();

// --- Auth Endpoints ---
app.post('/api/google-login', async (req, res) => {
    try {
        const { credential } = req.body;
        const clientId = process.env.GOOGLE_CLIENT_ID;

        if (!clientId) {
            throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: clientId
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        
        // Ensure avatar URL is set to high-res and supports animation if it's a Google hosted image
        let finalAvatar = picture;
        if (picture && picture.includes('googleusercontent.com')) {
            // Use =s0-rp to get the original raw photo, which is more reliable for GIF animations
            finalAvatar = picture.split('=')[0] + '=s0-rp'; 
        }
        console.log(`Final avatar URL for ${name}: ${finalAvatar}`);

        if (!user) {
            user = await User.create({
                googleId,
                email,
                username: name,
                avatar: finalAvatar
            });
        } else {
            // Update existing user details from Google to ensure sync
            let needsSave = false;
            if (user.googleId !== googleId) {
                user.googleId = googleId;
                needsSave = true;
            }
            if (user.avatar !== finalAvatar) {
                user.avatar = finalAvatar;
                needsSave = true;
            }
            // If the user's email changed (rare for Google but possible), update it
            if (user.email !== email) {
                user.email = email;
                needsSave = true;
            }
            
            if (needsSave) {
                try {
                    await user.save();
                } catch (saveErr) {
                    // If save fails due to duplicate (e.g. another user has this googleId now)
                    // we should probably just use the existing user object as is or handle it
                    console.error('Error saving user updates:', saveErr);
                }
            }
        }

        const token = jwt.sign({ userId: user._id }, SECRET_KEY);
        res.json({ token, user: { id: user._id, username: user.username, email: user.email, timezone: user.timezone, avatar: user.avatar } });
    } catch (err) {
        console.error('Detailed Google login error:', err);
        res.status(500).json({ error: 'Authentication failed: ' + err.message });
    }
});

// app.post('/api/signup', async (req, res) => { ... });
// app.post('/api/login', async (req, res) => { ... });

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

app.post('/api/tasks/:id/snooze', auth, async (req, res) => {
    const snoozeTime = new Date(Date.now() + 10 * 60000); // Snooze for 10 minutes
    const task = await Task.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { snoozeUntil: snoozeTime },
        { returnDocument: 'after' }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, snoozeUntil: snoozeTime });
});

app.post('/api/events/:id/snooze', auth, async (req, res) => {
    const snoozeTime = new Date(Date.now() + 10 * 60000); // Snooze for 10 minutes
    const event = await Event.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { snoozeUntil: snoozeTime },
        { returnDocument: 'after' }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, snoozeUntil: snoozeTime });
});

// --- Note Endpoints ---
app.get('/api/notes', auth, async (req, res) => {
    const notes = await Note.find({ userId: req.userId }).sort({ order: 1, createdAt: -1 });
    res.json(notes.map(n => ({ ...n._doc, id: n._id })));
});

app.post('/api/notes', auth, async (req, res) => {
    // Generate a new order value to put it at the top or bottom. We'll default to top (0) and shift others, or just use timestamp as an initial order if needed.
    // Let's just find the max order or default to a very low number, or shift existing.
    // Better yet, just insert with order: Date.now() / 1000 so it naturally sorts, and drag-drop updates explicitly.
    // We'll set order to a simple increment or just use the current time.
    const highestNote = await Note.findOne({ userId: req.userId }).sort({ order: -1 });
    const nextOrder = highestNote ? highestNote.order + 1024 : 1024;

    const newNote = await Note.create({ ...req.body, userId: req.userId, order: nextOrder });
    const noteData = { ...newNote._doc, id: newNote._id };
    
    io.to(req.userId).emit('noteCreated', noteData);
    res.json(noteData);
});

app.put('/api/notes/reorder', auth, async (req, res) => {
    const { updates } = req.body; // Array of { id, order }
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid data' });
    
    for (const update of updates) {
        await Note.updateOne({ _id: update.id, userId: req.userId }, { order: update.order });
    }
    
    io.to(req.userId).emit('notesReordered', updates);
    res.json({ success: true });
});

app.put('/api/notes/:id', auth, async (req, res) => {
    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        { ...req.body },
        { returnDocument: 'after' }
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    const noteData = { ...note._doc, id: note._id };
    io.to(req.userId).emit('noteUpdated', noteData);
    res.json(noteData);
});

app.delete('/api/notes/:id', auth, async (req, res) => {
    await Note.deleteOne({ _id: req.params.id, userId: req.userId });
    io.to(req.userId).emit('noteDeleted', req.params.id);
    res.json({ success: true });
});

// --- User Settings ---
app.put('/api/user/settings', auth, async (req, res) => {
    const { timezone, nightMode, dailyReminder } = req.body;
    let updateFields = { timezone, nightMode };
    if (dailyReminder !== undefined) {
        updateFields.dailyReminder = dailyReminder;
    }
    const user = await User.findByIdAndUpdate(req.userId, updateFields, { returnDocument: 'after' });
    res.json({ timezone: user.timezone, nightMode: user.nightMode, dailyReminder: user.dailyReminder });
});

app.post('/api/user/daily-reminder/complete', auth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const now = new Date();
    const tz = user.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const p = {};
    parts.forEach(part => p[part.type] = part.value);
    const todayStr = `${p.year}-${p.month}-${p.day}`;

    if (!user.dailyReminder) user.dailyReminder = {};
    user.dailyReminder.lastCompletedDate = todayStr;
    await user.save();
    res.json({ success: true, dailyReminder: user.dailyReminder });
});

// --- Subscription Endpoints ---
app.post('/api/subscribe', auth, async (req, res) => {
    try {
        const subscription = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        // 1. Clear any existing records with this same endpoint
        // This prevents E11000 errors and ensures a device is only registered once
        try {
            await Subscription.deleteMany({ 'subscription.endpoint': subscription.endpoint });
        } catch (delErr) {
            console.warn('Cleanup of old subscription failed, but continuing...', delErr.message);
        }

        // 2. Create the new subscription
        await Subscription.create({
            userId: req.userId,
            subscription: subscription
        });

        console.log(`[Success] Subscription registered for user ${req.userId}`);
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Subscription error details:', {
            message: err.message,
            code: err.code,
            keyPattern: err.keyPattern
        });
        res.status(500).json({ error: 'Failed to save subscription', details: err.message });
    }
});

app.post('/api/test-push', auth, async (req, res) => {
    try {
        await sendNotification(req.userId, 'Test Notification 🚀', 'Your notifications are working correctly!', 'reminder', { priority: 'High' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vapid-public-key', async (req, res) => {
    try {
        if (process.env.VAPID_PUBLIC_KEY) {
            return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
        }
        const vapidKeys = await Config.findOne({ key: 'vapidKeys' });
        if (!vapidKeys) {
            return res.status(500).json({ error: 'VAPID keys not initialized' });
        }
        res.json({ publicKey: vapidKeys.value.publicKey });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Push Notification Logic ---
async function sendNotification(userId, title, body, type = 'reminder', extra = {}) {
    console.log(`Sending notification to ${userId}: "${title}" - "${body}"`);
    
    // Find all subscriptions for this user to support multi-device notifications
    const subscriptions = await Subscription.find({ userId });
    
    if (subscriptions.length === 0) {
        console.log(`No subscriptions found for user ${userId}`);
        return;
    }

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

    const results = await Promise.allSettled(subscriptions.map(subObj => {
        return webpush.sendNotification(subObj.subscription, payload)
            .then(() => {
                console.log(`Notification sent to a device for user ${userId}`);
            })
            .catch(async (err) => {
                // If subscription has expired or is no longer valid, delete it
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`Subscription for user ${userId} expired. Removing...`);
                    await Subscription.deleteOne({ _id: subObj._id });
                } else {
                    console.error(`Error sending notification to user ${userId}:`, err.statusCode, err.body);
                }
            });
    }));
    
    return results;
}

// --- Cron Job ---
// --- Cron Job (Every minute) ---
cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // --- Daily Reminder Logic ---
    const usersWithReminder = await User.find({ 'dailyReminder.enabled': true });
    for (const u of usersWithReminder) {
        if (!u.dailyReminder) continue;
        const tz = u.timezone || 'UTC';
        try {
            const options = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
            const p = {};
            parts.forEach(part => p[part.type] = part.value);
            const todayStr = `${p.year}-${p.month}-${p.day}`;
            const currentHourMinute = `${p.hour}:${p.minute}`;
            
            if (u.dailyReminder.lastCompletedDate !== todayStr) {
                const [targetHour, targetMinute] = (u.dailyReminder.time || '12:00').split(':').map(Number);
                const [currHour, currMinute] = currentHourMinute.split(':').map(Number);
                
                const currentTotalMins = currHour * 60 + currMinute;
                const targetTotalMins = targetHour * 60 + targetMinute;
                
                if (currentTotalMins >= targetTotalMins) {
                    let shouldSend = false;
                    
                    if (!u.dailyReminder.lastSentTime) {
                        shouldSend = true;
                    } else {
                        const lastSent = new Date(u.dailyReminder.lastSentTime);
                        const msSinceLastSent = now.getTime() - lastSent.getTime();
                        
                        let lastSentDateStr = '';
                        try {
                            const lsParts = new Intl.DateTimeFormat('en-US', options).formatToParts(lastSent);
                            const lsp = {};
                            lsParts.forEach(part => lsp[part.type] = part.value);
                            lastSentDateStr = `${lsp.year}-${lsp.month}-${lsp.day}`;
                        } catch (e) {}
                        
                        if (lastSentDateStr !== todayStr) {
                            shouldSend = true;
                        } else if (msSinceLastSent >= 5 * 60 * 60 * 1000) { // 5 hours
                            shouldSend = true;
                        }
                    }
                    
                    if (shouldSend) {
                        await sendNotification(u._id, 'Daily Reminder 📌', u.dailyReminder.text || 'Time for your daily task!', 'reminder', { priority: 'High' });
                        u.dailyReminder.lastSentTime = now;
                        await u.save();
                    }
                }
            }
        } catch (err) {
            console.error('Error in daily reminder cron for user', u._id, err);
        }
    }

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
                    const extra = { priority: item.priority, tag: item._id.toString() };
                    
                    let title, body;
                    if (type === 'task') {
                        title = `Task Reminder ⚠️`;
                        body = `You have a deadline for '${item.title}' by ${sn.label}`;
                        if (sn.label === '5 min' || sn.label === '10 min') {
                            body = `Quick! '${item.title}' is due in ${sn.label}!`;
                        }
                    } else {
                        title = `Event Reminder 📅`;
                        body = `'${item.title}' is starting in ${sn.label}`;
                        if (sn.label === '1 day') {
                            body = `Don't forget: Tomorrow is ${item.title}`;
                        } else if (sn.label.includes('day')) {
                            body = `${item.title} is coming up in ${sn.label}`;
                        }
                    }

                    await sendNotification(item.userId, title, body, type, extra);
                    sn.sent = true;
                    updated = true;
                }
            }
            if (updated) await item.save();

            // 3. Process Snoozed Notifications
            if (item.snoozeUntil && item.snoozeUntil <= now) {
                const type = Model === Task ? 'task' : 'event';
                const title = `${Model === Task ? 'Task' : 'Event'} Snooze Over ⏰`;
                const body = `Time to get back to: ${item.title}`;
                await sendNotification(item.userId, title, body, type, { priority: 'High', tag: item._id.toString() });
                
                item.snoozeUntil = null; // Clear snooze
                await item.save();
            }
        }
    }

    // 2. Missed Tasks
    const missedTasks = await Task.find({
        deadline: { $lte: now },
        completed: false,
        'scheduledNotifications.label': { $ne: 'missed' }
    });

    for (const task of missedTasks) {
        await sendNotification(task.userId, 'Task Overdue ❗', `Deadline passed for: ${task.title}`, 'missed', { priority: 'High' });
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

