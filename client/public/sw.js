let cachedToken = null;

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'STORE_TOKEN') {
        cachedToken = event.data.token;
        console.log('Token sync to service worker');
    }
});

self.addEventListener('push', event => {
    let data = { title: 'Planory Update', body: 'You have a new notification.' };
    
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.error('Error parsing push data:', e);
        if (event.data) {
            data = { title: 'Planory Notification', body: event.data.text() };
        }
    }

    const type = data.data?.type || 'reminder';
    const priority = data.data?.priority || 'Medium';
    const itemId = data.data?.tag || `planory-${type}`; // Real ID from server
    
    let icon = 'https://cdn-icons-png.flaticon.com/512/2343/2343903.png';
    if (type === 'event') icon = 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png';
    if (type === 'missed') icon = 'https://cdn-icons-png.flaticon.com/512/564/564619.png';

    const isHigh = priority === 'High';

    const options = {
        body: data.body || 'Tap to view details',
        icon: icon,
        badge: icon,
        vibrate: isHigh ? [500, 250, 500, 250, 500] : [200, 100, 200],
        tag: itemId,
        renotify: true,
        requireInteraction: isHigh,
        data: { 
            url: data.data?.url || '/', 
            id: itemId,
            type: type
        }
    };

    if (isHigh) {
        options.actions = [
            { action: 'done', title: 'Mark as Done' },
            { action: 'snooze', title: 'Snooze 10m' }
        ];
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            let isFocused = false;
            for (let i = 0; i < windowClients.length; i++) {
                if (windowClients[i].focused) {
                    isFocused = true;
                    windowClients[i].postMessage({
                        type: 'PUSH_NOTIFICATION',
                        payload: { title: data.title, ...options }
                    });
                    break;
                }
            }
            return self.registration.showNotification(data.title || 'Planory Update', options);
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const action = event.action;
    const id = event.notification.data.id;
    const type = event.notification.data.type;
    const url = event.notification.data.url;

    if (action === 'done' || action === 'snooze') {
        event.waitUntil(
            Promise.resolve().then(async () => {
                // Try to perform action directly if we have a token
                if (cachedToken && id && !id.startsWith('planory-')) {
                    const API_URL = url.includes('localhost') ? 'http://localhost:5000' : 'https://planory.onrender.com';
                    const endpoint = type === 'event' ? 'events' : 'tasks';
                    const path = action === 'done' ? `api/${endpoint}/${id}` : `api/${endpoint}/${id}/snooze`;
                    const method = action === 'done' ? 'PUT' : 'POST';
                    const body = action === 'done' ? JSON.stringify({ completed: true }) : null;

                    try {
                        await fetch(`${API_URL}/${path}`, {
                            method: method,
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${cachedToken}`
                            },
                            body: body
                        });
                        console.log(`Action ${action} performed directly from SW`);
                    } catch (err) {
                        console.error('SW Direct Action failed:', err);
                    }
                }

                // Still focus/notify windows to update UI
                const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if ('focus' in client) {
                        await client.focus();
                        client.postMessage({ type: 'NOTIFICATION_ACTION', action, id });
                        return;
                    }
                }
                
                // If no window, open one with the result
                if (clients.openWindow) {
                    const urlToOpen = new URL(url, self.location.origin);
                    urlToOpen.searchParams.set('action', action);
                    urlToOpen.searchParams.set('id', id);
                    return clients.openWindow(urlToOpen.toString());
                }
            })
        );
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
