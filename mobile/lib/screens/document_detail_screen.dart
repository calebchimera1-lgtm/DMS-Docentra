import 'dart:io';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import '../core/api_client.dart';

class DocumentDetailScreen extends StatefulWidget {
  final String documentId;
  const DocumentDetailScreen({super.key, required this.documentId});

  @override
  State<DocumentDetailScreen> createState() => _DocumentDetailScreenState();
}

class _DocumentDetailScreenState extends State<DocumentDetailScreen> {
  Map<String, dynamic>? _doc;
  bool _loading = true;
  bool _downloading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/documents/${widget.documentId}');
      setState(() => _doc = data as Map<String, dynamic>);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleFavorite() async {
    final current = _doc?['isFavorite'] == true;
    await ApiClient.instance.post('/documents/${widget.documentId}/favorite', body: {'favorite': !current});
    _load();
  }

  Future<void> _downloadAndOpen() async {
    setState(() => _downloading = true);
    try {
      final bytes = await ApiClient.instance.downloadBytes('/documents/${widget.documentId}/download');
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/${_doc?['name'] ?? 'document'}');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Download failed: $e')));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _checkOutOrIn() async {
    final isLocked = _doc?['isLocked'] == true;
    await ApiClient.instance.post('/documents/${widget.documentId}/${isLocked ? 'check-in' : 'check-out'}');
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_doc == null) {
      return const Scaffold(body: Center(child: Text('Document not found')));
    }

    final isLocked = _doc?['isLocked'] == true;
    final isFavorite = _doc?['isFavorite'] == true;

    return Scaffold(
      appBar: AppBar(title: Text(_doc!['name'] ?? 'Document')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(_doc!['name'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Type: ${_doc!['fileType']} · Version ${_doc!['currentVersion']} · Status: ${_doc!['status']}'),
          if (isLocked) const Padding(padding: EdgeInsets.only(top: 8), child: Text('Checked out', style: TextStyle(color: Colors.red))),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _actionButton(icon: isFavorite ? Icons.star : Icons.star_border, label: 'Favorite', onTap: _toggleFavorite),
              _actionButton(
                icon: Icons.download,
                label: _downloading ? 'Downloading...' : 'Download',
                onTap: _downloading ? null : _downloadAndOpen,
              ),
              _actionButton(icon: isLocked ? Icons.lock_open : Icons.lock, label: isLocked ? 'Check in' : 'Check out', onTap: _checkOutOrIn),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionButton({required IconData icon, required String label, required VoidCallback? onTap}) {
    return Column(
      children: [
        IconButton(icon: Icon(icon), onPressed: onTap),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}
