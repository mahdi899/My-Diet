/// Wire envelope for one coach turn.
///
/// Parsing lives in `data/coach_parse.dart`. Unknown `type` values are kept
/// so the UI can fall back to [fallbackText].
class CoachMessage {
  const CoachMessage({
    required this.id,
    required this.role,
    required this.type,
    required this.payload,
    required this.fallbackText,
    required this.createdAt,
    this.clientMessageId,
    this.pending = false,
    this.failed = false,
  });

  final String id;
  final String role;
  final String type;
  final Map<String, dynamic> payload;
  final String fallbackText;
  final String? clientMessageId;
  final DateTime createdAt;
  final bool pending;
  final bool failed;

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  /// Text the bubble should show when the type has no richer layout.
  String get text {
    final raw = payload['text'];
    if (raw is String && raw.trim().isNotEmpty) return raw;
    return fallbackText;
  }

  CoachMessage copyWith({
    String? id,
    String? clientMessageId,
    bool? pending,
    bool? failed,
    Map<String, dynamic>? payload,
  }) => CoachMessage(
    id: id ?? this.id,
    role: role,
    type: type,
    payload: payload ?? this.payload,
    fallbackText: fallbackText,
    clientMessageId: clientMessageId ?? this.clientMessageId,
    createdAt: createdAt,
    pending: pending ?? this.pending,
    failed: failed ?? this.failed,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'role': role,
    'type': type,
    'payload': payload,
    'fallback_text': fallbackText,
    if (clientMessageId != null) 'client_message_id': clientMessageId,
    'created_at': createdAt.toUtc().toIso8601String(),
  };
}

/// Types the coach UI knows how to draw. Anything else uses [CoachMessage.fallbackText].
const kKnownCoachTypes = <String>{
  'text',
  'quick_replies',
  'meal_card',
  'plan_meal',
  'swap_options',
  'fact_card',
  'calorie_ring',
  'weigh_in',
  'water',
  'day_brief',
  'weekly_review',
  'milestone',
  'user_photo',
  'system_note',
};

bool isKnownCoachType(String type) => kKnownCoachTypes.contains(type);
