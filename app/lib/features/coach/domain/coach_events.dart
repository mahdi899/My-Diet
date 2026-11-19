import 'dart:math';

import 'coach_message.dart';

/// RFC-4122 UUID. The coach API rejects any other `clientMessageId`.
String newCoachClientId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

bool isCoachUuid(Object? value) {
  if (value is! String) return false;
  return RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  ).hasMatch(value);
}

/// Body of `POST /v1/me/coach/messages` or `/actions`, before wire encoding.
class CoachSendRequest {
  CoachSendRequest({
    required this.kind,
    String? clientMessageId,
    this.text,
    this.action,
    this.data = const {},
  }) : clientMessageId = clientMessageId ?? newCoachClientId();

  factory CoachSendRequest.text(String text) =>
      CoachSendRequest(kind: 'text', text: text);

  factory CoachSendRequest.photo(String path) =>
      CoachSendRequest(kind: 'photo', text: 'عکس وعده', data: {'path': path});

  factory CoachSendRequest.action(
    String action,
    Map<String, dynamic> data, {
    String? label,
  }) => CoachSendRequest(
    kind: 'card_action',
    action: action,
    data: data,
    text: label ?? action,
  );

  final String kind;
  final String clientMessageId;
  final String? text;
  final String? action;
  final Map<String, dynamic> data;

  String get displayText => switch (kind) {
    'photo' => (text ?? '').trim().isEmpty ? 'عکس وعده' : text!.trim(),
    _ => (text ?? '').trim(),
  };
}

/// How a failed turn should feel in the chat. Never a stack trace.
enum CoachProblem { message, offline, budget, safety, expired }

/// SSE events from `POST /v1/me/coach/messages`.
sealed class CoachEvent {
  const CoachEvent();
}

class CoachDelta extends CoachEvent {
  const CoachDelta({
    required this.streamId,
    required this.text,
    this.segment = 0,
  });

  final String streamId;

  /// One chunk of the current segment. A new [segment] replaces the draft.
  final String text;
  final int segment;
}

class CoachUserMessage extends CoachEvent {
  const CoachUserMessage(this.message);
  final CoachMessage message;
}

class CoachToolEvent extends CoachEvent {
  const CoachToolEvent({required this.name, required this.status});
  final String name;
  final String status;
}

class CoachMessageEvent extends CoachEvent {
  const CoachMessageEvent(this.message);
  final CoachMessage message;
}

class CoachDone extends CoachEvent {
  const CoachDone({
    this.userMessage,
    this.suggestions = const [],
    this.replayed = false,
    this.userMessageId,
    this.messageIds = const [],
  });

  final CoachMessage? userMessage;
  final List<String> suggestions;
  final bool replayed;
  final String? userMessageId;
  final List<String> messageIds;
}

class CoachErrorEvent extends CoachEvent {
  const CoachErrorEvent({
    required this.code,
    required this.message,
    this.retryable = false,
    this.problem = CoachProblem.message,
  });

  final String code;
  final String message;
  final bool retryable;
  final CoachProblem problem;
}

class CoachThreadPage {
  const CoachThreadPage({
    this.messages = const [],
    this.cursor,
    this.hasMore = false,
    this.suggestions = const [],
    this.threadId,
    this.dayBriefDate,
  });

  /// Oldest first.
  final List<CoachMessage> messages;

  /// `nextCursor`: pass back as `before` to load older messages.
  final String? cursor;
  final bool hasMore;
  final List<String> suggestions;
  final String? threadId;
  final String? dayBriefDate;
}

class CoachDayBrief {
  const CoachDayBrief({required this.message, required this.created});
  final CoachMessage message;
  final bool created;
}

class CoachTransportException implements Exception {
  const CoachTransportException(
    this.message, {
    this.code,
    this.problem = CoachProblem.message,
    this.retryable = false,
  });

  final String message;
  final String? code;
  final CoachProblem problem;
  final bool retryable;

  @override
  String toString() => message;
}
