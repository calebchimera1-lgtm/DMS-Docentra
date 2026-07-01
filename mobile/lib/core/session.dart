import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Holds the current auth session in memory and persists it to disk so the
/// app can restore a logged-in state (and its last-known role/permissions
/// for offline UI decisions) after a restart.
class Session {
  Session._();
  static final Session instance = Session._();

  String? accessToken;
  String? refreshToken;
  Map<String, dynamic>? user;

  bool get isLoggedIn => accessToken != null;

  List<String> get permissions => user?['permissions'] != null ? List<String>.from(user!['permissions']) : [];

  bool hasPermission(String key) => permissions.contains(key);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    accessToken = prefs.getString('access_token');
    refreshToken = prefs.getString('refresh_token');
    final userJson = prefs.getString('user');
    if (userJson != null) {
      user = jsonDecode(userJson) as Map<String, dynamic>;
    }
  }

  Future<void> save({required String access, required String refresh, Map<String, dynamic>? userData}) async {
    accessToken = access;
    refreshToken = refresh;
    if (userData != null) user = userData;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', access);
    await prefs.setString('refresh_token', refresh);
    if (userData != null) await prefs.setString('user', jsonEncode(userData));
  }

  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user');
  }
}
