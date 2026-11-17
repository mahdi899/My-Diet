import '../domain/coach_events.dart';
import 'coach_parse.dart';

/// Actions the coach API runs with no model. Anything else is sent as text.
const kCoachServerActions = <String>{
  'confirm_meal',
  'dismiss',
  'confirm_swap',
  'log_as_planned',
  'log_water',
  'log_weight',
  'mood',
  'undo_meal',
  'show_ring',
};

/// Strict JSON for `POST /v1/me/coach/messages`. Unknown keys are rejected.
Map<String, dynamic> coachMessageBody(CoachSendRequest request) {
  final id = request.clientMessageId;
  final action = request.action;
  if ((request.kind == 'card_action' || request.kind == 'quick_reply') &&
      action != null &&
      kCoachServerActions.contains(action)) {
    return coachActionBody(request);
  }
  if (request.kind == 'photo') {
    final media = request.data['mediaId'];
    final caption = request.text?.trim() ?? '';
    return {
      'clientMessageId': id,
      'kind': 'photo',
      if (media is String && isCoachUuid(media)) 'mediaId': media,
      if (caption.isNotEmpty && caption != 'عکس وعده')
        'caption': _clip(caption, 300),
      if (coachMealCode(request.data['mealType']) != null)
        'mealType': coachMealCode(request.data['mealType']),
    };
  }
  final text = _clip((request.text ?? request.displayText).trim(), 8000);
  return {'clientMessageId': id, 'kind': 'text', 'text': text};
}

/// Strict JSON for `POST /v1/me/coach/actions`.
Map<String, dynamic> coachActionBody(CoachSendRequest request) {
  final action = request.action ?? '';
  final source = request.data['sourceMessageId'];
  final label = _clip((request.text ?? '').trim(), 80);
  final args = coachActionArgs(action, request.data);
  return {
    'clientMessageId': request.clientMessageId,
    'action': action,
    if (args.isNotEmpty) 'args': args,
    if (label.isNotEmpty && label != action) 'label': label,
    if (isCoachUuid(source)) 'sourceMessageId': source,
  };
}

/// `args` for a local action. Glasses become millilitres; the scale value becomes kilograms.
Map<String, dynamic> coachActionArgs(
  String action,
  Map<String, dynamic> data,
) {
  switch (action) {
    case 'log_water':
      final raw = data['ml'] ?? (asInt(data['glasses'], 1) * 250);
      final ml = raw is num ? raw.round() : int.tryParse('$raw') ?? 250;
      return {'ml': ml.clamp(50, 1500)};
    case 'log_weight':
      final kg = data['kilograms'] ?? data['value'];
      if (kg is! num) return const {};
      return {
        'kilograms': kg,
        if (data['confirm'] == true) 'confirm': true,
      };
    case 'confirm_meal':
      final meal = coachMealCode(data['mealType'] ?? data['meal_name']);
      final entry = data['entryId'] ?? data['meal_id'] ?? data['id'];
      return {
        'entryId': ?entry,
        if (data['title'] != null) 'title': data['title'],
        'mealType': ?meal,
        if (data['items'] != null) 'items': data['items'],
        if (data['planMealUid'] != null) 'planMealUid': data['planMealUid'],
      };
    case 'show_ring':
    case 'dismiss':
      return const {};
    default:
      final copy = Map<String, dynamic>.from(data)..remove('sourceMessageId');
      return copy;
  }
}

Map<String, dynamic> coachPhotoBody({
  required String clientMessageId,
  required String base64,
  required String mime,
  String? caption,
  String? mealType,
}) {
  final note = caption?.trim() ?? '';
  final meal = coachMealCode(mealType);
  return {
    'clientMessageId': clientMessageId,
    'image': 'data:$mime;base64,$base64',
    'mime': mime,
    if (note.isNotEmpty && note != 'عکس وعده') 'caption': _clip(note, 300),
    'mealType': ?meal,
  };
}

String _clip(String value, int max) =>
    value.length <= max ? value : value.substring(0, max);
