import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

const App = () => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('todo_user');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('todo_user', JSON.stringify(user));
            registerPushNotifications();
        } else {
            localStorage.removeItem('todo_user');
        }
    }, [user]);

    const registerPushNotifications = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW Registered');

            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Fetch public key from server
                const response = await fetch('http://localhost:5000/api/vapid-public-key');
                const { publicKey } = await response.json();

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey
                });
            }

            // Send subscription to backend
            await fetch('http://localhost:5000/api/subscribe', {
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
        <Router>
            <Routes>
                <Route path="/login" element={user ? <Navigate to="/" /> : <Auth setUser={setUser} />} />
                <Route path="/" element={user ? <Dashboard user={user} setUser={setUser} registerPushNotifications={registerPushNotifications} /> : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default App;
