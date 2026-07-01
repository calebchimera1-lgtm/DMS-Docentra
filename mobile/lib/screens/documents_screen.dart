import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_client.dart';
import '../core/offline_cache.dart';
import '../models/models.dart';
import 'document_detail_screen.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  final List<Map<String, String?>> _stack = [
    {'id': null, 'name': 'Root'}
  ];
  List<FolderItem> _folders = [];
  List<DocumentItem> _documents = [];
  bool _loading = true;
  bool _offline = false;
  bool _uploading = false;

  String? get _currentFolderId => _stack.last['id'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final folderKey = _currentFolderId ?? 'root';
    try {
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity.contains(ConnectivityResult.none)) throw Exception('offline');

      final results = await Future.wait([
        ApiClient.instance.get('/folders', query: {'parentId': folderKey}),
        ApiClient.instance.get('/documents', query: {'folderId': folderKey}),
      ]);

      final folders = (results[0] as List).map((f) => FolderItem.fromJson(f)).toList();
      final documents = ((results[1] as Map)['documents'] as List).map((d) => DocumentItem.fromJson(d)).toList();

      await OfflineCache.saveDocumentListing(folderKey, (results[1] as Map)['documents'], results[0] as List);

      setState(() {
        _folders = folders;
        _documents = documents;
        _offline = false;
      });
    } catch (_) {
      final cached = await OfflineCache.loadDocumentListing(folderKey);
      setState(() {
        _offline = true;
        _folders = (cached?['folders'] as List? ?? []).map((f) => FolderItem.fromJson(f)).toList();
        _documents = (cached?['documents'] as List? ?? []).map((d) => DocumentItem.fromJson(d)).toList();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openFolder(FolderItem folder) {
    setState(() => _stack.add({'id': folder.id, 'name': folder.name}));
    _load();
  }

  void _goBack() {
    if (_stack.length <= 1) return;
    setState(() => _stack.removeLast());
    _load();
  }

  Future<void> _uploadFromFile(File file) async {
    setState(() => _uploading = true);
    try {
      await ApiClient.instance.uploadFile(
        '/documents/upload',
        file,
        fields: _currentFolderId != null ? {'folderId': _currentFolderId!} : null,
      );
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _showUploadOptions() async {
    await showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Scan with camera'),
              onTap: () async {
                Navigator.pop(ctx);
                final picked = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 90);
                if (picked != null) await _uploadFromFile(File(picked.path));
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () async {
                Navigator.pop(ctx);
                final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
                if (picked != null) await _uploadFromFile(File(picked.path));
              },
            ),
            ListTile(
              leading: const Icon(Icons.attach_file),
              title: const Text('Choose a file'),
              onTap: () async {
                Navigator.pop(ctx);
                final result = await FilePicker.platform.pickFiles();
                if (result != null && result.files.single.path != null) {
                  await _uploadFromFile(File(result.files.single.path!));
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createFolder() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New folder'),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(hintText: 'Folder name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Create')),
        ],
      ),
    );
    if (name == null || name.trim().isEmpty) return;
    await ApiClient.instance.post('/folders', body: {'name': name.trim(), if (_currentFolderId != null) 'parentId': _currentFolderId});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_stack.last['name'] ?? 'Documents'),
        leading: _stack.length > 1 ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: _goBack) : null,
        actions: [IconButton(icon: const Icon(Icons.create_new_folder_outlined), onPressed: _createFolder)],
      ),
      body: Column(
        children: [
          if (_offline)
            Container(
              width: double.infinity,
              color: Colors.orange.shade100,
              padding: const EdgeInsets.all(8),
              child: const Text('Offline — showing cached documents', textAlign: TextAlign.center),
            ),
          if (_uploading) const LinearProgressIndicator(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      children: [
                        for (final folder in _folders)
                          ListTile(
                            leading: const Icon(Icons.folder, color: Colors.amber),
                            title: Text(folder.name),
                            onTap: () => _openFolder(folder),
                          ),
                        for (final doc in _documents)
                          ListTile(
                            leading: const Icon(Icons.description_outlined),
                            title: Text(doc.name),
                            subtitle: Text('${doc.fileType} · v${doc.currentVersion}'),
                            trailing: doc.isLocked ? const Icon(Icons.lock, size: 18) : null,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
                            ),
                          ),
                        if (_folders.isEmpty && _documents.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(child: Text('This folder is empty')),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _offline ? null : _showUploadOptions,
        child: const Icon(Icons.add),
      ),
    );
  }
}
