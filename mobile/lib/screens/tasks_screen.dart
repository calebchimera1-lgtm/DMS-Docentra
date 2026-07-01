import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../models/models.dart';

/// Combines mobile approvals and e-signature tasks under one "Tasks" tab
/// so field/mobile users have a single place to clear their queue.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  List<ApprovalTask> _approvals = [];
  List<SignatureTask> _signatures = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/workflows/my-approvals'),
        ApiClient.instance.get('/signatures/my-pending'),
      ]);
      setState(() {
        _approvals = (results[0] as List).map((a) => ApprovalTask.fromJson(a)).toList();
        _signatures = (results[1] as List).map((s) => SignatureTask.fromJson(s)).toList();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _actOnApproval(ApprovalTask task, String action) async {
    await ApiClient.instance.post(
      '/workflows/instances/${task.workflowInstanceId}/steps/${task.id}/action',
      body: {'action': action},
    );
    _load();
  }

  Future<void> _sign(SignatureTask task) async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign document'),
        content: TextField(controller: controller, decoration: const InputDecoration(hintText: 'Type your full name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Sign')),
        ],
      ),
    );
    if (name == null || name.trim().isEmpty) return;
    await ApiClient.instance.post('/signatures/${task.id}/sign', body: {'typedName': name.trim()});
    _load();
  }

  Future<void> _decline(SignatureTask task) async {
    await ApiClient.instance.post('/signatures/${task.id}/decline');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks'),
        bottom: TabBar(controller: _tabController, tabs: const [Tab(text: 'Approvals'), Tab(text: 'Signatures')]),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                RefreshIndicator(
                  onRefresh: _load,
                  child: _approvals.isEmpty
                      ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No pending approvals')))])
                      : ListView.builder(
                          itemCount: _approvals.length,
                          itemBuilder: (ctx, i) {
                            final task = _approvals[i];
                            return ListTile(
                              title: Text(task.documentName),
                              subtitle: Text(task.stepName),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(icon: const Icon(Icons.check_circle, color: Colors.green), onPressed: () => _actOnApproval(task, 'APPROVE')),
                                  IconButton(icon: const Icon(Icons.cancel, color: Colors.red), onPressed: () => _actOnApproval(task, 'REJECT')),
                                ],
                              ),
                            );
                          },
                        ),
                ),
                RefreshIndicator(
                  onRefresh: _load,
                  child: _signatures.isEmpty
                      ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No pending signatures')))])
                      : ListView.builder(
                          itemCount: _signatures.length,
                          itemBuilder: (ctx, i) {
                            final task = _signatures[i];
                            return ListTile(
                              title: Text(task.documentName),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextButton(onPressed: () => _sign(task), child: const Text('Sign')),
                                  TextButton(onPressed: () => _decline(task), child: const Text('Decline')),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
