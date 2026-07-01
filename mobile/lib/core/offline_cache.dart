import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Minimal offline cache: the last successful document/folder listing per
/// folder is stashed to disk so the Documents screen still shows something
/// useful (clearly marked as cached) when the device has no connectivity.
class OfflineCache {
  static String _key(String folderId) => 'cache_documents_$folderId';

  static Future<void> saveDocumentListing(String folderId, List<dynamic> documents, List<dynamic> folders) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key(folderId), jsonEncode({'documents': documents, 'folders': folders, 'cachedAt': DateTime.now().toIso8601String()}));
  }

  static Future<Map<String, dynamic>?> loadDocumentListing(String folderId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(folderId));
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }
}
