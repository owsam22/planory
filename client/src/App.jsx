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
                    itemId: payload.data?.tag || null, // Extract real item ID
                    title: payload.title,
                    body: payload.body,
                    type: payload.data?.type || 'task',
                    isHighPriority: payload.requireInteraction
                });
            } else if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                const { action, id } = event.data;
                handleNotificationAction(action, id);
            }
        };

        // Handle actions from URL parameters (if opened from SW)
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            const action = urlParams.get('action');
            const id = urlParams.get('id');
            if (action && id) {
                handleNotificationAction(action, id);
                // Clean up URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            }
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }
        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            }
        };
    }, [user]);

    useEffect(() => {
        if (user && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'STORE_TOKEN',
                token: user.token
            });
        }
    }, [user]);

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const registerPushNotifications = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return;
        }

        try {
            // Explicitly request permission if it hasn't been granted yet
            if (Notification.permission === 'default') {
                console.log('Requesting notification permission...');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log('Notification permission denied');
                    return;
                }
            } else if (Notification.permission === 'denied') {
                console.log('Notification permission already denied');
                return;
            }

            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered with scope:', registration.scope);

            let subscription = await registration.pushManager.getSubscription();
            
            // Fetch public key from server
            const response = await fetch(`${API_URL}/api/vapid-public-key`);
            if (!response.ok) throw new Error('Failed to fetch VAPID key');
            const { publicKey } = await response.json();

            // Check if we need to force a resubscription due to VAPID key change
            const savedKey = localStorage.getItem('vapidPublicKey');
            if (subscription && savedKey !== publicKey) {
                console.log('VAPID key changed, unsubscribing old subscription...');
                await subscription.unsubscribe();
                subscription = null;
            }

            if (!subscription) {
                console.log('Subscribing to push notifications...');
                const convertedKey = urlBase64ToUint8Array(publicKey);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey
                });
                localStorage.setItem('vapidPublicKey', publicKey);
            }

            console.log('Push subscription successful:', subscription);

            // Send subscription to backend
            const subResponse = await fetch(`${API_URL}/api/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(subscription.toJSON ? subscription.toJSON() : subscription)
            });
            
            if (subResponse.ok) {
                console.log('Subscription sent to server successfully');
                return true;
            } else {
                console.error('Failed to send subscription to server');
                return false;
            }
        } catch (err) {
            console.error('Push notification registration failed:', err);
            return false;
        }
    };

    const handleNotificationAction = (action, id) => {
        if (!id) return;

        if (action === 'done') {
            fetch(`${API_URL}/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${user.token}` 
                },
                body: JSON.stringify({ completed: true })
            })
            .then(res => {
                if (res.ok) {
                    setActiveToast({
                        id: Date.now(),
                        title: 'Task Completed ✅',
                        body: 'The task has been marked as done.',
                        type: 'task'
                    });
                    
                    // Signal to Dashboard to remove this notification
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CLEAR_NOTIFICATION',
                            itemId: id
                        });
                    }
                }
            })
            .catch(err => console.error('Failed to update task:', err));
        } else if (action === 'snooze') {
            const endpoint = type === 'event' ? 'events' : 'tasks';
            fetch(`${API_URL}/api/${endpoint}/${id}/snooze`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${user.token}` 
                }
            })
            .then(res => {
                if (res.ok) {
                    setActiveToast({
                        id: Date.now(),
                        title: 'Task Snoozed ⏰',
                        body: 'We\'ll remind you again in 10 minutes.',
                        type: 'reminder'
                    });
                    
                    // Signal to Dashboard to remove this notification
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CLEAR_NOTIFICATION',
                            itemId: id
                        });
                    }
                }
            })
            .catch(err => console.error('Failed to snooze:', err));
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
                    itemId={activeToast.itemId}
                    isHighPriority={activeToast.isHighPriority}
                    onDismiss={() => setActiveToast(null)}
                    onAction={(action, id) => {
                        handleNotificationAction(action, id);
                        setActiveToast(null);
                    }}
                />
            )}
        </>
    );
};

export default App;
