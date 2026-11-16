import '../domain/payload_values.dart';
export '../domain/payload_values.dart';

import 'dart:convert';

import '../domain/coach_events.dart';
import '../domain/coach_message.dart';

const coachMealTypeFa = <String, String>{
  'breakfast': 'صبحانه',
  'lunch': 'ناهار',
  'dinner': 'شام',
  'snack': 'میان‌وعده',
};

/// Persian meal label, or the original token when it is already a label.
String coachMealLabel(Object? type) {
  if (type is! String || type.trim().isEmpty) return '';
  return coachMealTypeFa[type.trim()] ?? type.trim();
}

/// Contract meal code (`breakfast` … `snack`), from a code or a Persian label.
String? coachMealCode(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  final text = value.trim();
  if (coachMealTypeFa.containsKey(text)) return text;
  for (final entry in coachMealTypeFa.entries) {
    if (entry.value == text) return entry.key;
  }
  return null;
}

/// All coach wire parsing. Callers should not read JSON envelopes themselves.
CoachMessage parseCoachMessage(Map<dynamic, dynamic> json) {
  final payloadRaw = json['payload'];
  final payload = payloadRaw is Map
      ? Map<String, dynamic>.from(payloadRaw)
      : <String, dynamic>{};
  final typeRaw = json['type'];
  final type = typeRaw is String && typeRaw.trim().isNotEmpty
      ? typeRaw.trim()
      : 'text';
  final fallback = [json['fallback_text'], json['fallbackText'], json['text']]
      .whereType<String>()
      .firstWhere((value) => value.trim().isNotEmpty, orElse: () => '');
  final client = json['client_message_id'] ?? json['clientMessageId'];
  final createdRaw = json['created_at'] ?? json['createdAt'];
  final created = createdRaw is String
      ? DateTime.tryParse(createdRaw)?.toLocal()
      : null;
  final idRaw = json['id'];
  final id = idRaw == null || '$idRaw'.isEmpty
      ? 'm-${DateTime.now().microsecondsSinceEpoch}'
      : '$idRaw';
  final roleRaw = json['role'];
  adaptCoachPayload(type, payload);
  return CoachMessage(
    id: id,
    role: roleRaw is String && roleRaw.isNotEmpty ? roleRaw : 'assistant',
    type: type,
    payload: payload,
    fallbackText: fallback,
    clientMessageId: client is String && client.isNotEmpty ? client : null,
    createdAt: created ?? DateTime.now(),
  );
}

/// Fills the fields the existing cards already read, without dropping contract keys.
///
/// Mock payloads already use those fields, so nothing is overwritten.
void adaptCoachPayload(String type, Map<String, dynamic> payload) {
  switch (type) {
    case 'meal_card':
      _adaptMeal(payload);
    case 'plan_meal':
      _adaptPlanMeal(payload);
    case 'calorie_ring':
      final calories = payload['calories'];
      if (calories is Map) {
        _fill(
          payload,
          'eaten',
          calories['consumed'] ?? payload['consumedKcal'],
        );
        _fill(payload, 'goal', calories['target'] ?? payload['targetKcal']);
      } else {
        _fill(payload, 'eaten', payload['consumedKcal']);
        _fill(payload, 'goal', payload['targetKcal']);
      }
      _fill(payload, 'title', 'کالری امروز');
    case 'weigh_in':
      _fill(payload, 'value', payload['kilograms']);
      _fill(payload, 'step', 0.1);
      _fill(payload, 'title', 'وزن امروز');
    case 'water':
      final ml = payload['ml'];
      if (ml is num) _fill(payload, 'glasses', (ml / 250).round());
      final target = payload['targetMl'];
      if (target is num) {
        final glasses = (target / 250).round();
        _fill(payload, 'goal', glasses <= 0 ? 8 : glasses);
      }
      _fill(payload, 'title', 'آب امروز');
    case 'day_brief':
      _adaptDayBrief(payload);
    case 'weekly_review':
      final percent = payload['adherencePercent'];
      if (percent is num) _fill(payload, 'adherence', percent / 100);
      if (payload.containsKey('weightChangeKg')) {
        _fill(payload, 'delta_kg', payload['weightChangeKg'] ?? 0);
      }
      _fill(payload, 'note', payload['focus']);
      _fill(payload, 'title', 'مرور هفته');
    case 'milestone':
      _fill(payload, 'subtitle', payload['body']);
    case 'quick_replies':
      _adaptQuickReplies(payload);
    case 'user_photo':
    case 'system_note':
    case 'text':
      break;
    default:
      break;
  }
}

void _adaptMeal(Map<String, dynamic> payload) {
  final totals = payload['totals'];
  if (totals is Map) {
    _fill(payload, 'calories', totals['kcal']);
    _fill(payload, 'protein_g', totals['proteinG']);
    _fill(payload, 'carbs_g', totals['carbsG']);
    _fill(payload, 'fat_g', totals['fatG']);
  }
  final label = coachMealLabel(payload['mealType']);
  if (label.isNotEmpty) {
    _fill(payload, 'meal_type_fa', label);
    _fill(payload, 'meal_name', label);
  }
  final hint = payload['photoHint'];
  if (hint is List && hint.isNotEmpty && hint.first is String) {
    _fill(payload, 'photo_title', hint.first);
  }
  _fill(payload, 'photo_title', payload['title']);
  final items = payload['items'];
  if (items is! List) return;
  payload['items'] = [
    for (final item in items)
      if (item is Map) _adaptFoodItem(Map<String, dynamic>.from(item)),
  ];
}

Map<String, dynamic> _adaptFoodItem(Map<String, dynamic> item) {
  _fill(item, 'quantity', item['servings']);
  _fill(item, 'calories', item['kcal']);
  _fill(item, 'protein_g', item['proteinG']);
  _fill(item, 'carbs_g', item['carbsG']);
  _fill(item, 'fat_g', item['fatG']);
  final label = item['servingLabel'];
  if (item['servings'] != null) {
    _fill(
      item,
      'unit',
      label is String && label.trim().isNotEmpty ? label : 'serving',
    );
  }
  return item;
}

void _adaptPlanMeal(Map<String, dynamic> payload) {
  final label = coachMealLabel(payload['mealType']);
  if (label.isNotEmpty) _fill(payload, 'meal_type_fa', label);
  _fill(payload, 'time', payload['suggestedTime']);
  _fill(payload, 'calories', payload['plannedKcal'] ?? payload['consumedKcal']);
  _fill(payload, 'photo_title', payload['title']);
}

void _adaptDayBrief(Map<String, dynamic> payload) {
  _fill(payload, 'title', payload['greeting'] ?? 'خلاصهٔ امروز');
  _fill(payload, 'note', payload['tip']);
  final meals = payload['meals'];
  if (meals is! List) return;
  payload['meals'] = [
    for (final item in meals)
      if (item is Map) _adaptBriefMeal(Map<String, dynamic>.from(item)),
  ];
}

Map<String, dynamic> _adaptBriefMeal(Map<String, dynamic> meal) {
  final label = coachMealLabel(meal['mealType']);
  if (label.isNotEmpty) _fill(meal, 'name', label);
  _fill(meal, 'calories', meal['plannedKcal']);
  _fill(meal, 'time', meal['suggestedTime']);
  return meal;
}

void _adaptQuickReplies(Map<String, dynamic> payload) {
  if (payload['options'] is List || payload['replies'] is! List) return;
  payload['options'] = [
    for (final item in payload['replies'] as List)
      if (item is Map)
        {
          'label': asString(item['label'], asString(item['text'])),
          'value': asString(
            item['label'],
            asString(item['value'], asString(item['text'])),
          ),
          if (item['id'] != null) 'id': item['id'],
          if (item['action'] != null) 'action': item['action'],
          if (item['args'] is Map)
            'args': Map<String, dynamic>.from(item['args'] as Map),
        },
  ];
}

void _fill(Map<String, dynamic> map, String key, Object? value) {
  if (value == null) return;
  final current = map[key];
  if (current == null || (current is String && current.trim().isEmpty)) {
    map[key] = value;
  }
}

CoachThreadPage parseThreadPage(Object? raw) {
  if (raw is List) {
    return CoachThreadPage(messages: _messagesFrom(raw));
  }
  if (raw is! Map) return const CoachThreadPage();
  final data = raw['data'] is Map ? raw['data'] as Map : raw;
  final list = data['messages'] ?? raw['messages'];
  final meta = data['meta'] ?? raw['meta'];
  final cursorRaw = meta is Map
      ? meta['next_cursor'] ?? meta['nextCursor'] ?? meta['cursor']
      : data['next_cursor'] ?? data['nextCursor'];
  final cursor = switch (cursorRaw) {
    final String value when value.isNotEmpty => value,
    final num value => value.toString(),
    _ => null,
  };
  final hasMore = meta is Map && meta.containsKey('has_more')
      ? meta['has_more'] == true
      : data.containsKey('has_more')
      ? data['has_more'] == true
      : cursor != null;
  final thread = data['thread'] ?? raw['thread'];
  return CoachThreadPage(
    messages: _messagesFrom(list),
    cursor: cursor,
    hasMore: hasMore,
    suggestions: parseSuggestions(data['suggestions'] ?? raw['suggestions']),
    threadId: thread is Map && thread['id'] != null ? '${thread['id']}' : null,
    dayBriefDate: thread is Map && thread['dayBriefDate'] is String
        ? thread['dayBriefDate'] as String
        : null,
  );
}

CoachMessage? parseOptionalMessage(Object? raw) {
  if (raw is! Map) return null;
  final nested = raw['message'];
  if (nested is Map) return parseCoachMessage(nested);
  if (raw['type'] != null ||
      raw['fallback_text'] != null ||
      raw['fallbackText'] != null ||
      raw['text'] is String) {
    return parseCoachMessage(raw);
  }
  final data = raw['data'];
  if (data is Map) return parseOptionalMessage(data);
  return null;
}

List<String> parseSuggestions(Object? raw) {
  if (raw is! List) return const [];
  final out = <String>[];
  for (final item in raw) {
    if (item is String && item.trim().isNotEmpty) {
      out.add(item.trim());
    } else if (item is Map) {
      final label = item['label'] ?? item['text'] ?? item['value'];
      if (label is String && label.trim().isNotEmpty) out.add(label.trim());
    }
  }
  return out;
}

({String? code, String? message, bool? retryable}) parseProblemBody(
  String body,
) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map) {
      final direct =
          decoded['messageFa'] ?? decoded['message'] ?? decoded['detail'];
      final error = decoded['error'];
      final nested = error is Map
          ? error['messageFa'] ?? error['message']
          : null;
      final text = direct is String && direct.trim().isNotEmpty
          ? direct.trim()
          : nested is String && nested.trim().isNotEmpty
          ? nested.trim()
          : null;
      final code = decoded['code'] ?? (error is Map ? error['code'] : null);
      return (
        code: code is String ? code : null,
        message: text,
        retryable: decoded['retryable'] is bool
            ? decoded['retryable'] as bool
            : null,
      );
    }
  } on FormatException {
    return (code: null, message: null, retryable: null);
  }
  return (code: null, message: null, retryable: null);
}

String parseErrorText(String body) {
  final parsed = parseProblemBody(body);
  final text = parsed.message;
  if (text != null && text.isNotEmpty) return text;
  return 'ارتباط با مربی برقرار نشد.';
}

CoachProblem classifyCoachProblem({int? status, String? code}) {
  if (status == 401 || code == 'unauthorized') return CoachProblem.expired;
  if (status == 402 ||
      status == 429 ||
      code == 'ai_budget_exceeded' ||
      code == 'coach_daily_limit' ||
      code == 'quota_exceeded' ||
      code == 'vision_quota_exceeded' ||
      code == 'budget' ||
      code == 'insufficient_funds') {
    return CoachProblem.budget;
  }
  if (status == 422 ||
      code == 'safety' ||
      code == 'safety_block' ||
      code == 'blocked') {
    return CoachProblem.safety;
  }
  if ((status == null || status == 0) && (code == null || code.isEmpty)) {
    return CoachProblem.offline;
  }
  return CoachProblem.message;
}

String coachProblemText(CoachProblem problem, String? serverText) {
  final server = serverText?.trim() ?? '';
  return switch (problem) {
    CoachProblem.budget => server.isNotEmpty ? server : 'سهمیه پیام‌های مربی پر شده است. می‌توانید یک بسته اضافی خریداری کنید.',
    CoachProblem.expired => 'نشست پایان یافته؛ دوباره وارد شو.',
    CoachProblem.offline => 'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.',
    CoachProblem.safety =>
      server.isNotEmpty ? server : 'این را نمی‌توانم ادامه بدهم.',
    CoachProblem.message =>
      server.isNotEmpty ? server : 'مشکلی پیش آمد. دوباره امتحان کن.',
  };
}

bool coachRetryable({
  required CoachProblem problem,
  int? status,
  String? code,
  bool? serverFlag,
}) {
  if (problem == CoachProblem.budget ||
      problem == CoachProblem.safety ||
      problem == CoachProblem.expired) {
    return false;
  }
  if (problem == CoachProblem.offline) return true;
  const terminal = {
    'validation',
    'forbidden',
    'no_profile',
    'no_consent',
    'not_found',
    'image_too_large',
    'invalid_image',
  };
  if (code != null && terminal.contains(code)) return false;
  if (serverFlag != null) return serverFlag;
  return status == 429 || (status != null && status >= 500);
}

CoachTransportException coachTransportFrom({
  required int status,
  required String body,
}) {
  final parsed = parseProblemBody(body);
  final problem = classifyCoachProblem(status: status, code: parsed.code);
  return CoachTransportException(
    coachProblemText(problem, parsed.message ?? parseErrorText(body)),
    code: parsed.code,
    problem: problem,
    retryable: coachRetryable(
      problem: problem,
      status: status,
      code: parsed.code,
      serverFlag: parsed.retryable,
    ),
  );
}

/// Incremental SSE decoder. Comment pings and unknown events are skipped.
Stream<CoachEvent> parseSseStream(Stream<List<int>> bytes) async* {
  final buffer = StringBuffer();
  await for (final text in utf8.decoder.bind(bytes)) {
    buffer.write(text.replaceAll('\r\n', '\n'));
    final chunk = buffer.toString();
    final frames = chunk.split('\n\n');
    buffer.clear();
    if (!chunk.endsWith('\n\n')) buffer.write(frames.removeLast());
    for (final frame in frames) {
      final event = parseSseFrame(frame);
      if (event != null) yield event;
    }
  }
  final tail = buffer.toString().trim();
  if (tail.isNotEmpty) {
    final event = parseSseFrame(tail);
    if (event != null) yield event;
  }
}

CoachEvent? parseSseFrame(String frame) {
  String? name;
  final data = <String>[];
  for (final rawLine in frame.split('\n')) {
    final line = rawLine.trimRight();
    if (line.isEmpty || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      name = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      data.add(line.substring(5).trim());
    }
  }
  if (data.isEmpty) return null;
  Object? decoded;
  try {
    decoded = jsonDecode(data.join('\n'));
  } on FormatException {
    return null;
  }
  if (decoded is! Map) return null;
  final json = Map<String, dynamic>.from(decoded);
  final eventName = (name ?? json['event'] ?? '').toString();
  return coachEventFrom(eventName, json);
}

CoachEvent? coachEventFrom(String name, Map<String, dynamic> json) {
  switch (name) {
    case 'user_message':
      final message = parseOptionalMessage(json);
      if (message == null) return null;
      return CoachUserMessage(message);
    case 'delta':
      final text = json['text'];
      final segment = json['segment'];
      return CoachDelta(
        streamId: json['stream_id'] is String
            ? json['stream_id'] as String
            : 's${segment ?? ''}',
        text: text is String ? text : '',
        segment: segment is num ? segment.toInt() : 0,
      );
    case 'tool':
      return CoachToolEvent(
        name: asString(json['name']),
        status: asString(json['status'], 'running'),
      );
    case 'message':
      final message = parseOptionalMessage(json);
      if (message == null) return null;
      if (message.isUser) return CoachUserMessage(message);
      return CoachMessageEvent(message);
    case 'done':
      final user = json['user_message'] ?? json['userMessage'];
      return CoachDone(
        userMessage: user is Map ? parseCoachMessage(user) : null,
        suggestions: parseSuggestions(json['suggestions']),
        replayed: json['replayed'] == true || json['replay'] == true,
        userMessageId: json['userMessageId'] is String
            ? json['userMessageId'] as String
            : json['user_message_id'] is String
            ? json['user_message_id'] as String
            : null,
        messageIds: [
          for (final id
              in json['messageIds'] is List
                  ? json['messageIds'] as List
                  : const [])
            '$id',
        ],
      );
    case 'error':
      final server = json['messageFa'] ?? json['message'];
      final text = server is String && server.isNotEmpty
          ? server
          : 'مشکلی پیش آمد.';
      final code = json['code'] is String
          ? json['code'] as String
          : 'server_error';
      final problem = classifyCoachProblem(code: code);
      return CoachErrorEvent(
        code: code,
        message: coachProblemText(problem, text),
        retryable: coachRetryable(
          problem: problem,
          code: code,
          serverFlag: json['retryable'] == true,
        ),
        problem: problem,
      );
    case 'ping':
      return null;
    default:
      return null;
  }
}

List<CoachMessage> _messagesFrom(Object? raw) {
  if (raw is! List) return const [];
  final out = <CoachMessage>[];
  for (final item in raw) {
    if (item is Map) out.add(parseCoachMessage(item));
  }
  return out;
}
