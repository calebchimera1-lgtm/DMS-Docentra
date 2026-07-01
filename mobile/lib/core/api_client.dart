import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'session.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// Thin REST client used by every screen. Centralizes auth-header injection,
/// JSON envelope unwrapping (`{ success, data }`), and one-shot access-token
/// refresh on a 401 so callers never have to think about token lifecycle.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('${AppConfig.apiBaseUrl}$normalized').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, v?.toString())),
    );
  }

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    if (Session.instance.accessToken != null) {
      headers['Authorization'] = 'Bearer ${Session.instance.accessToken}';
    }
    return headers;
  }

  Future<dynamic> _unwrap(http.Response response) async {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      body = {};
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body['data'];
    }
    throw ApiException(response.statusCode, body['message']?.toString() ?? 'Request failed (${response.statusCode})');
  }

  Future<bool> _tryRefresh() async {
    if (Session.instance.refreshToken == null) return false;
    try {
      final res = await http.post(
        _uri('/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': Session.instance.refreshToken}),
      );
      if (res.statusCode == 200) {
        final data = (jsonDecode(res.body) as Map<String, dynamic>)['data'];
        await Session.instance.save(access: data['accessToken'], refresh: data['refreshToken']);
        return true;
      }
    } catch (_) {
      // fall through to false
    }
    return false;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    var res = await http.get(_uri(path, query), headers: _headers());
    if (res.statusCode == 401 && await _tryRefresh()) {
      res = await http.get(_uri(path, query), headers: _headers());
    }
    return _unwrap(res);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    var res = await http.post(_uri(path), headers: _headers(), body: body != null ? jsonEncode(body) : null);
    if (res.statusCode == 401 && await _tryRefresh()) {
      res = await http.post(_uri(path), headers: _headers(), body: body != null ? jsonEncode(body) : null);
    }
    return _unwrap(res);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    var res = await http.patch(_uri(path), headers: _headers(), body: body != null ? jsonEncode(body) : null);
    if (res.statusCode == 401 && await _tryRefresh()) {
      res = await http.patch(_uri(path), headers: _headers(), body: body != null ? jsonEncode(body) : null);
    }
    return _unwrap(res);
  }

  Future<dynamic> delete(String path) async {
    var res = await http.delete(_uri(path), headers: _headers());
    if (res.statusCode == 401 && await _tryRefresh()) {
      res = await http.delete(_uri(path), headers: _headers());
    }
    return _unwrap(res);
  }

  /// Uploads a file as multipart/form-data (used for document upload and new versions).
  Future<dynamic> uploadFile(String path, File file, {Map<String, String>? fields}) async {
    Future<http.StreamedResponse> send() async {
      final request = http.MultipartRequest('POST', _uri(path));
      request.headers.addAll(_headers(json: false));
      fields?.forEach((key, value) => request.fields[key] = value);
      request.files.add(await http.MultipartFile.fromPath('file', file.path));
      return request.send();
    }

    var streamed = await send();
    if (streamed.statusCode == 401 && await _tryRefresh()) {
      streamed = await send();
    }
    final res = await http.Response.fromStream(streamed);
    return _unwrap(res);
  }

  /// Downloads a document's bytes for local viewing/saving.
  Future<List<int>> downloadBytes(String path) async {
    var res = await http.get(_uri(path), headers: _headers(json: false));
    if (res.statusCode == 401 && await _tryRefresh()) {
      res = await http.get(_uri(path), headers: _headers(json: false));
    }
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, 'Download failed');
    }
    return res.bodyBytes;
  }
}
