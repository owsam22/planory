import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const App = () => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('todo_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [activeToast, setActiveToast] = useState(null);

    useEffect(() => {
        if (user) {
            localStorage.setItem('todo_user', JSON.stringify(user));
            registerPushNotifications();
        } else {
            localStorage.removeItem('todo_user');
        }
    }, [user]);

    useEffect(() => {
        const handleServiceWorkerMessage = (event) => {
            if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
                const payload = event.data.payload;
                setActiveToast({
                    id: Date.now(),
                    title: payload.title,
                    body: payload.body,
                    type: payload.data?.type || 'task',
                    isHighPriority: payload.requireInteraction
                });
            } else if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                console.log('Action received:', event.data.action, event.data.id);
                // Call API here in the future to mark as done/snooze based on action
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }
        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            }
        };
    }, []);

    const registerPushNotifications = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW Registered');

            let subscription = await registration.pushManager.getSubscription();
            
            // Fetch public key from server
            const response = await fetch(`${API_URL}/api/vapid-public-key`);
            const { publicKey } = await response.json();

            // Check if we need to force a resubscription due to VAPID key change
            const savedKey = localStorage.getItem('vapidPublicKey');
            if (subscription && savedKey !== publicKey) {
                console.log('VAPID key changed, unsubscribing old subscription...');
                await subscription.unsubscribe();
                subscription = null;
            }

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey
                });
                localStorage.setItem('vapidPublicKey', publicKey);
            }

            // Send subscription to backend
            await fetch(`${API_URL}/api/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(subscription)
            });
        } catch (err) {
            console.error('Push notification registration failed:', err);
        }
    };

    return (
        <>
            <Router>
                <Routes>
                    <Route path="/login" element={user ? <Navigate to="/" /> : <Auth setUser={setUser} />} />
                    <Route path="/" element={user ? <Dashboard user={user} setUser={setUser} registerPushNotifications={registerPushNotifications} /> : <Navigate to="/login" />} />
                </Routes>
            </Router>
            {activeToast && (
                <Toast 
                    title={activeToast.title}
                    body={activeToast.body}
                    type={activeToast.type}
                    isHighPriority={activeToast.isHighPriority}
                    onDismiss={() => setActiveToast(null)}
                />
            )}
        </>
    );
};

export default App;
