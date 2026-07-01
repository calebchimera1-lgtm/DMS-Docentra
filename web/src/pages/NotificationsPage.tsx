import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NotificationItem } from '../types';
import { formatDate } from '../utils/format';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  async function load() {
    const res = await api.get('/notifications');
    setNotifications(res.data.data.notifications);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`);
    load();
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    load();
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Notifications</h2>
        <button className="btn" onClick={markAllRead}>Mark all as read</button>
      </div>
      <div className="card">
        {notifications.map((n) => (
          <div key={n.id} className="mb-16" style={{ opacity: n.isRead ? 0.6 : 1, cursor: 'pointer' }} onClick={() => !n.isRead && markRead(n.id)}>
            <div className="flex-between">
              <strong>{n.title}</strong>
              <span className="muted">{formatDate(n.createdAt)}</span>
            </div>
            <p style={{ margin: '4px 0' }}>{n.message}</p>
          </div>
        ))}
        {notifications.length === 0 && <p className="muted">No notifications</p>}
      </div>
    </div>
  );
}
