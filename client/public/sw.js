self.addEventListener('push', event => {
    const data = event.data.json();
    const type = data.data?.type || 'reminder';
    
    // Choose icon based on type
    let icon = 'https://cdn-icons-png.flaticon.com/512/2343/2343903.png'; // Default
    if (type === 'event') icon = 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png';
    if (type === 'missed') icon = 'https://cdn-icons-png.flaticon.com/512/564/564619.png';

    const options = {
        body: data.body,
        icon: icon,
        badge: icon,
        vibrate: [200, 100, 200],
        tag: `planory-${type}`,
        renotify: true,
        data: { url: data.data?.url || '/' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
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
