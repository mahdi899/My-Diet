import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/features/coach/application/coach_session.dart';
import 'package:sabzine_flutter/features/coach/data/coach_parse.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';

class _AcknowledgingCoach extends MockCoachRepository {
  final acknowledged = Completer<void>();
  late String timestamp;
  List<Map<String, dynamic>> saved = [];

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async =>
      CoachThreadPage(messages: saved.map(parseCoachMessage).toList());

  @override
  Future<void> persist(List<CoachMessage> messages) async {
    saved = messages.map((message) => message.toJson()).toList();
  }

  @override
  Stream<CoachEvent> send(
    CoachSendRequest request, {
    List<int>? photoBytes,
  }) async* {
    await acknowledged.future;
    yield CoachUserMessage(
      parseCoachMessage({
        'id': 'saved-message',
        'role': 'user',
        'type': 'text',
        'text': request.text,
        'client_message_id': request.clientMessageId,
        'created_at': timestamp,
      }),
    );
    yield const CoachDone();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final timestamp in [
    '2026-11-21 20:45:32.123456',
    '2026-11-21T20:45:32.123456',
    '2026-11-21T20:45:32.123456Z',
    '2026-11-22T00:15:32.123456+03:30',
    '2026-11-21T15:45:32.123456-05:00',
  ]) {
    test('message timestamp keeps the correct instant: $timestamp', () {
      final expected = DateTime.utc(2026, 11, 21, 20, 45, 32, 123, 456);
      final message = parseCoachMessage({
        'id': 'message',
        'created_at': timestamp,
      });
      expect(message.createdAt.toUtc(), expected);
      expect(message.createdAt, expected.toLocal());
      expect(parseCoachMessage(message.toJson()).createdAt, message.createdAt);
    });
  }

  test(
    'a pending message keeps its send time after acknowledgment and reopening',
    () async {
      final repository = _AcknowledgingCoach();
      final session = CoachSession(repository: repository);
      addTearDown(session.close);
      await session.start();
      final sending = session.sendText('سلام');
      final pending = session.messages.single;
      expect(pending.pending, isTrue);
      repository.timestamp = pending.createdAt
          .toUtc()
          .toIso8601String()
          .replaceFirst('T', ' ')
          .replaceFirst('Z', '');
      repository.acknowledged.complete();
      await sending;
      expect(session.messages.single.createdAt, pending.createdAt);
      expect(session.messages.single.pending, isFalse);
      final reopened = CoachSession(repository: repository);
      addTearDown(reopened.close);
      await reopened.start();
      expect(reopened.messages.single.createdAt, pending.createdAt);
    },
  );
}
