import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'auth_http_client.dart';
import 'connection.dart';

class AuthFailure implements Exception {
  const AuthFailure(
    this.message, {
    this.expired = false,
    this.fault,
    this.code,
  });
  final String? code;
  final String message;
  final bool expired;
  final LinkFault? fault;
  @override
  String toString() => message;
}

class CustomerSession {
  CustomerSession.fromJson(Map<String, dynamic> data)
    : accessToken = data['accessToken'] as String,
      refreshToken = data['refreshToken'] as String?,
      expiresAt = DateTime.parse(data['sessionExpiresAt'] as String),
      role = data['role'] as String;
  final String accessToken, role;
  final String? refreshToken;
  final DateTime expiresAt;
}

abstract interface class AuthTokenStorage {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

/// Server-issued sessions only. Demo sessions stay in DemoStore's separate store.
class CustomerAuth {
  CustomerAuth({
    required this.baseUrl,
    required this.storage,
    http.Client? client,
  }) : _client = client ?? createAuthClient();
  final String baseUrl;
  final AuthTokenStorage storage;
  final http.Client _client;

  /// Authenticated feature transport. Refresh retries preserve the exact body.
  Future<dynamic> api(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String> headers = const {},
  }) async {
    if (session == null) {
      throw const AuthFailure('ابتدا وارد شو.', expired: true);
    }
    Future<http.Response> request() => _client
        .send(
          http.Request(
              method,
              Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/v1/$path'),
            )
            ..headers.addAll({
              'Content-Type': 'application/json',
              if (kIsWeb) 'x-sabzine-client': 'web',
              ...headers,
              'Authorization': 'Bearer ${session!.accessToken}',
            })
            ..body = body == null ? '' : jsonEncode(body),
        )
        .then(http.Response.fromStream)
        .timeout(const Duration(seconds: 20));
    try {
      var response = await request();
      if (response.statusCode == 401) {
        if (await restore() == null) {
          throw const AuthFailure(
            'نشست پایان یافته؛ دوباره وارد شو.',
            expired: true,
          );
        }
        response = await request();
      }
      // A handler that returns null (e.g. "no plan yet") sends an empty body.
      final text = utf8.decode(response.bodyBytes);
      final data = text.isEmpty ? null : jsonDecode(text);
      if (response.statusCode >= 400) {
        throw AuthFailure(
          data is Map
              ? (data['messageFa'] ?? data['detail']) as String? ??
                    'عملیات انجام نشد.'
              : 'عملیات انجام نشد.',
          code: data is Map ? data['code'] as String? : null,
          expired: response.statusCode == 401,
          fault: classifyLink(status: response.statusCode),
        );
      }
      return data;
    } on AuthFailure {
      rethrow;
    } on TimeoutException {
      throw const AuthFailure(
        'پاسخ سرور به‌موقع نرسید.',
        fault: LinkFault.timeout,
      );
    } catch (_) {
      throw const AuthFailure('ارتباط برقرار نیست.', fault: LinkFault.offline);
    }
  }

  CustomerSession? session;
  String? get userId {
    try {
      final payload = session!.accessToken.split('.')[1];
      return (jsonDecode(
                utf8.decode(base64Url.decode(base64Url.normalize(payload))),
              )
              as Map)['sub']
          as String?;
    } catch (_) {
      return null;
    }
  }

  Future<CustomerSession?>? _refreshing;

  /// Public routes such as the onboarding spec. No session is required.
  Future<Map<String, dynamic>> publicGet(String path) async {
    try {
      final response = await _client
          .get(
            Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/v1/$path'),
            headers: {
              'Accept': 'application/json',
              if (kIsWeb) 'x-sabzine-client': 'web',
            },
          )
          .timeout(const Duration(seconds: 15));
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      final data = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};
      if (response.statusCode >= 400) {
        throw AuthFailure(
          data['messageFa'] as String? ??
              data['detail'] as String? ??
              'بارگذاری پرسش‌نامه انجام نشد.',
          code: data['code'] as String?,
          fault: classifyLink(status: response.statusCode),
        );
      }
      return data;
    } on AuthFailure {
      rethrow;
    } on TimeoutException {
      throw const AuthFailure(
        'پاسخ سرور به‌موقع نرسید.',
        fault: LinkFault.timeout,
      );
    } catch (_) {
      throw const AuthFailure('ارتباط برقرار نیست.', fault: LinkFault.offline);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    String? accessToken,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/v1/$path'),
            headers: {
              'Content-Type': 'application/json',
              if (kIsWeb) 'x-sabzine-client': 'web',
              if (accessToken != null) 'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      final data = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};
      if (response.statusCode >= 400) {
        throw AuthFailure(
          data['messageFa'] as String? ??
              data['detail'] as String? ??
              'ورود انجام نشد؛ دوباره تلاش کن.',
          code: data['code'] as String?,
          expired: response.statusCode == 401,
          fault: classifyLink(status: response.statusCode),
        );
      }
      return data;
    } on AuthFailure {
      rethrow;
    } on TimeoutException {
      throw const AuthFailure(
        'پاسخ سرور به‌موقع نرسید.',
        fault: LinkFault.timeout,
      );
    } catch (_) {
      throw const AuthFailure('ارتباط برقرار نیست.', fault: LinkFault.offline);
    }
  }

  Future<void> requestCode(
    String phone, {
    bool existingAccountOnly = false,
  }) async {
    await _post('auth/otp/request', {
      'phone': phone,
      if (existingAccountOnly) 'existingAccountOnly': true,
    });
  }

  Future<CustomerSession> verify(String phone, String code) async {
    final data = await _post('auth/otp/verify', {
      'phone': phone,
      'code': code,
      'deviceLabel': 'رژیم من customer app',
      'platform': 'flutter',
    });
    if (data['totpRequired'] == true) {
      throw const AuthFailure(
        'این حساب ورود کارکنان دارد. از سامانه وب استفاده کنید.',
      );
    }
    return _accept(data);
  }

  Future<CustomerSession> _accept(Map<String, dynamic> data) async {
    final next = CustomerSession.fromJson(data);
    if (next.role != 'user') {
      // Do not retain a staff session accidentally opened in the customer client.
      try {
        await _post('auth/logout', {}, accessToken: next.accessToken);
      } catch (_) {}
      throw const AuthFailure('ورود متخصص و مدیر از سامانه وب انجام می‌شود.');
    }
    if (!DateTime.now().isBefore(next.expiresAt) ||
        (!kIsWeb && next.refreshToken == null)) {
      throw const AuthFailure(
        'نشست معتبر نیست. دوباره وارد شو.',
        expired: true,
      );
    }
    await storage.write(
      jsonEncode({
        if (!kIsWeb) 'refreshToken': next.refreshToken,
        'expiresAt': next.expiresAt.toUtc().toIso8601String(),
      }),
    );
    session = next;
    return next;
  }

  Future<CustomerSession?> restore() =>
      _refreshing ??= _restore().whenComplete(() => _refreshing = null);

  Future<CustomerSession?> _restore() async {
    final raw = await storage.read();
    if (raw == null) return null;
    Map<String, dynamic> saved;
    try {
      saved = jsonDecode(raw) as Map<String, dynamic>;
      if (!DateTime.now().isBefore(
        DateTime.parse(saved['expiresAt'] as String),
      )) {
        await clear();
        return null;
      }
    } catch (_) {
      await clear();
      return null;
    }
    try {
      return await _accept(
        await _post('auth/refresh', {
          if (!kIsWeb) 'refreshToken': saved['refreshToken'],
        }),
      );
    } on AuthFailure catch (error) {
      if (error.expired) {
        await clear();
        return null;
      }
      rethrow; // A network outage must not silently delete a valid saved session.
    }
  }

  Future<void> logout() async {
    var active = session;
    if (active != null) {
      try {
        await _post('auth/logout', {}, accessToken: active.accessToken);
      } on AuthFailure catch (failure) {
        if (!failure.expired) rethrow;
        active = await restore();
        if (active != null) {
          await _post('auth/logout', {}, accessToken: active.accessToken);
        }
      }
    }
    await clear();
  }

  Future<void> clear() async {
    session = null;
    await storage.clear();
  }

  void dispose() => _client.close();
}
