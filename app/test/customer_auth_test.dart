import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';

class TokenMemory implements AuthTokenStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String token) async {
    value = token;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

Map<String, dynamic> issued({String role = 'user', DateTime? expiry}) => {
  'accessToken': 'server-access',
  'refreshToken': 'server-refresh',
  'role': role,
  'sessionExpiresAt': (expiry ?? DateTime.now().add(const Duration(days: 12)))
      .toUtc()
      .toIso8601String(),
};

void main() {
  test(
    'server expiry and login phone survive restore without persisting the access token',
    () async {
      final memory = TokenMemory(),
          expiry = DateTime.now().add(const Duration(days: 8));
      final auth = CustomerAuth(
        baseUrl: 'https://example.test',
        storage: memory,
        client: MockClient(
          (_) async => http.Response(jsonEncode(issued(expiry: expiry)), 200),
        ),
      );
      await auth.verify('09123456789', '123456');
      expect(auth.session!.expiresAt, expiry.toUtc());
      expect(auth.session!.phone, '09123456789');
      expect(jsonDecode(memory.value!)['phone'], '09123456789');
      expect(memory.value, isNot(contains('server-access')));
      final restarted = CustomerAuth(
        baseUrl: 'https://example.test',
        storage: memory,
        client: MockClient((request) async {
          expect(request.url.path, '/v1/auth/refresh');
          expect(jsonDecode(request.body)['refreshToken'], 'server-refresh');
          return http.Response(jsonEncode(issued(expiry: expiry)), 200);
        }),
      );
      await restarted.restore();
      expect(restarted.session!.expiresAt, expiry.toUtc());
      expect(restarted.session!.phone, '09123456789');
      auth.dispose();
      restarted.dispose();
    },
  );

  test(
    'revoked refresh clears session but network failure retains saved session',
    () async {
      final memory = TokenMemory();
      final raw = jsonEncode({
        'refreshToken': 'saved',
        'expiresAt': DateTime.now()
            .add(const Duration(days: 1))
            .toIso8601String(),
      });
      memory.value = raw;
      var status = 503;
      final auth = CustomerAuth(
        baseUrl: 'https://example.test',
        storage: memory,
        client: MockClient((_) async => http.Response('{}', status)),
      );
      await expectLater(auth.restore(), throwsA(isA<AuthFailure>()));
      expect(memory.value, raw);
      status = 401;
      expect(await auth.restore(), isNull);
      expect(memory.value, isNull);
      expect(auth.session, isNull);
      auth.dispose();
    },
  );

  test('staff sessions never authenticate the customer app', () async {
    final memory = TokenMemory();
    final auth = CustomerAuth(
      baseUrl: 'https://example.test',
      storage: memory,
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(
            request.url.path.endsWith('logout')
                ? {'ok': true}
                : issued(role: 'specialist'),
          ),
          200,
        ),
      ),
    );
    await expectLater(
      auth.verify('09123456789', '123456'),
      throwsA(isA<AuthFailure>()),
    );
    expect(memory.value, isNull);
    expect(auth.session, isNull);
    auth.dispose();
  });

  test('concurrent restore rotates a refresh token only once', () async {
    final memory = TokenMemory()
      ..value = jsonEncode({
        'refreshToken': 'saved',
        'expiresAt': DateTime.now()
            .add(const Duration(days: 1))
            .toIso8601String(),
      });
    var count = 0;
    final auth = CustomerAuth(
      baseUrl: 'https://example.test',
      storage: memory,
      client: MockClient((_) async {
        count++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return http.Response(jsonEncode(issued()), 200);
      }),
    );
    await Future.wait([auth.restore(), auth.restore()]);
    expect(count, 1);
    auth.dispose();
  });
}
