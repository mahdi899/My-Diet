import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/messaging.dart';
import 'package:sabzine_flutter/presentation/screens/messaging.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';

class Tokens implements AuthTokenStorage {
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

void main() {
  test(
    'failed publication retains request state and emits no success message',
    () async {
      final repo = DemoMessaging();
      final change = repo.submit('v1', [repo.reasons.first], 'شام ساده‌تر');
      repo.startReview(change);
      await expectLater(
        repo.publishReplacement(change, () async => throw StateError('failed')),
        throwsStateError,
      );
      expect(change.status, ChangeStatus.underReview);
      expect(repo.messages('user-main'), isEmpty);
      await repo.publishReplacement(change, () async {});
      expect(change.status, ChangeStatus.approved);
      expect(
        repo.messages('user-main').single.body,
        'برنامه جدید در پنل شما قرار گرفت.',
      );
    },
  );
  test(
    'clarification preserves main state and blocks publication until answered',
    () async {
      final repo = DemoMessaging();
      final change = repo.submit('v1', [repo.reasons.first], '');
      repo.startReview(change);
      repo.clarify(change, 'چقدر وقت داری؟');
      expect(change.status, ChangeStatus.underReview);
      await expectLater(
        repo.publishReplacement(change, () async {}),
        throwsStateError,
      );
      repo.answer(change, '۲۰ دقیقه');
      expect(change.awaitingCustomer, false);
      expect(change.history.last, contains('۲۰ دقیقه'));
    },
  );
  test('reject needs explanation and duplicate requests are rejected', () {
    final repo = DemoMessaging();
    expect(() => repo.submit('v1', [], ''), throwsStateError);
    expect(() => repo.submit('v1', ['unknown'], ''), throwsStateError);
    final change = repo.submit('v1', [repo.reasons.first], '');
    expect(() => repo.submit('v1', [repo.reasons.first], ''), throwsStateError);
    repo.startReview(change);
    expect(() => repo.reject(change, ' '), throwsStateError);
    repo.reject(change, 'برنامه فعلی مناسب است');
    expect(change.rejection, 'برنامه فعلی مناسب است');
    expect(change.status, ChangeStatus.rejected);
  });
  test(
    'media validation rejects unsupported, empty, oversized and long voice',
    () {
      expect(
        () => ChatAttachment('x.svg', 'image/svg+xml', Uint8List(2)).validate(),
        throwsStateError,
      );
      expect(
        () => ChatAttachment('x.png', 'image/png', Uint8List(0)).validate(),
        throwsStateError,
      );
      expect(
        () => ChatAttachment(
          'x.png',
          'image/png',
          Uint8List(10 * 1024 * 1024 + 1),
        ).validate(),
        throwsStateError,
      );
      expect(
        () => ChatAttachment(
          'voice.wav',
          'audio/wav',
          Uint8List(12),
          seconds: 121,
        ).validate(),
        throwsStateError,
      );
    },
  );
  test('cancel and retry never duplicates an outbox message', () async {
    final repo = DemoMessaging();
    final message = ConversationMessage(
      id: '1',
      body: 'hello',
      mine: true,
      createdAt: DateTime.now(),
    );
    final pending = repo.send('user-main', message);
    repo.cancel(message);
    await pending;
    expect(message.state, MessageState.failed);
    await repo.send('user-main', message);
    expect(repo.messages('user-main'), hasLength(1));
    expect(message.state, MessageState.sent);
    expect(message.state, isNot(MessageState.read));
    repo.reset();
    expect(repo.messages('user-main'), isEmpty);
  });
  test('PCM preview writes a playable mono WAV header', () {
    final wave = pcmWave(Uint8List(32000));
    expect(ascii.decode(wave.sublist(0, 4)), 'RIFF');
    expect(ascii.decode(wave.sublist(8, 12)), 'WAVE');
    expect(ByteData.sublistView(wave).getUint32(40, Endian.little), 32000);
  });
  test(
    'authenticated message transport refreshes and preserves post body',
    () async {
      final storage = Tokens();
      var requests = 0;
      final session = {
        'accessToken': 'token',
        'refreshToken': 'refresh',
        'role': 'user',
        'sessionExpiresAt': DateTime.now()
            .add(const Duration(days: 30))
            .toIso8601String(),
      };
      final auth = CustomerAuth(
        baseUrl: 'https://fixture.invalid',
        storage: storage,
        client: MockClient((request) async {
          if (request.url.path.endsWith('/messages')) {
            requests++;
            expect(jsonDecode(request.body), {'body': 'سلام'});
            return http.Response(
              requests == 1 ? '{}' : '{"id":"message"}',
              requests == 1 ? 401 : 200,
            );
          }
          return http.Response(jsonEncode(session), 200);
        }),
      );
      await auth.verify('09123456789', '123456');
      expect(
        (await auth.api(
          'conversations/id/messages',
          method: 'POST',
          body: {'body': 'سلام'},
        ))['id'],
        'message',
      );
      expect(requests, 2);
      auth.dispose();
    },
  );
  testWidgets(
    'customer can send a demo text and submit multiple change reasons',
    (t) async {
      t.view.physicalSize = const Size(430, 1000);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      final store = DemoStore()..loginDemoUser();
      store.approveActiveUserRequest();
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: appTheme(),
            home: const Directionality(
              textDirection: TextDirection.rtl,
              child: MessagingScreen(threadId: 'user-main'),
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const ValueKey('chat-input')),
        'پیام جدید من',
      );
      await t.tap(find.byTooltip('ارسال پیام'));
      await t.pumpAndSettle();
      expect(store.messaging.messages('user-main').last.body, 'پیام جدید من');
      expect(store.threadMessages('user-main').last.text, 'پیام جدید من');
      await t.tap(find.text('درخواست تغییر برنامه غذایی'));
      await t.pumpAndSettle();
      await t.tap(find.text(store.messaging.reasons[0]));
      await t.tap(find.text(store.messaging.reasons[1]));
      await t.pumpAndSettle();
      await t.tap(find.text('ارسال درخواست'));
      await t.pumpAndSettle();
      expect(store.messaging.changes.single.reasons, hasLength(2));
      expect(store.userRequest.revisionRequested, true);
      expect(store.userRequest.isPublished, true);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}
