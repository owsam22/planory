self.addEventListener('push', event => {
    const data = event.data.json();
    const type = data.data?.type || 'reminder';
    const priority = data.data?.priority || 'Medium';
    const tag = data.data?.tag || `planory-${type}`;
    
    // Choose icon based on type
    let icon = 'https://cdn-icons-png.flaticon.com/512/2343/2343903.png'; // Default
    if (type === 'event') icon = 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png';
    if (type === 'missed') icon = 'https://cdn-icons-png.flaticon.com/512/564/564619.png';

    const isHigh = priority === 'High';

    const options = {
        body: data.body,
        icon: icon,
        badge: icon,
        vibrate: isHigh ? [500, 250, 500, 250, 500] : [200, 100, 200],
        tag: tag,
        renotify: true,
        requireInteraction: isHigh,
        data: { url: data.data?.url || '/', id: tag }
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
                    // Send to client for In-App Toast
                    windowClients[i].postMessage({
                        type: 'PUSH_NOTIFICATION',
                        payload: { title: data.title, ...options }
                    });
                    break;
                }
            }
            if (!isFocused) {
                return self.registration.showNotification(data.title, options);
            }
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'done' || event.action === 'snooze') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                if (windowClients.length > 0) {
                    windowClients[0].postMessage({
                        type: 'NOTIFICATION_ACTION',
                        action: event.action,
                        id: event.notification.data.id
                    });
                }
            })
        );
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
