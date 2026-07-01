import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../models/models.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/notifications');
      setState(() => _notifications = ((data as Map)['notifications'] as List).map((n) => NotificationItem.fromJson(n)).toList());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(NotificationItem item) async {
    if (item.isRead) return;
    await ApiClient.instance.post('/notifications/${item.id}/read');
    _load();
  }

  Future<void> _markAllRead() async {
    await ApiClient.instance.post('/notifications/read-all');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [IconButton(icon: const Icon(Icons.done_all), onPressed: _markAllRead)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _notifications.isEmpty
                  ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No notifications')))])
                  : ListView.builder(
                      itemCount: _notifications.length,
                      itemBuilder: (ctx, i) {
                        final n = _notifications[i];
                        return ListTile(
                          tileColor: n.isRead ? null : Colors.blue.withOpacity(0.05),
                          leading: Icon(n.isRead ? Icons.notifications_none : Icons.notifications_active, color: n.isRead ? Colors.grey : Colors.blue),
                          title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold)),
                          subtitle: Text(n.message),
                          onTap: () => _markRead(n),
                        );
                      },
                    ),
            ),
    );
  }
}
