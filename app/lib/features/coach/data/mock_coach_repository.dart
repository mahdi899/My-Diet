import 'dart:convert';
import 'dart:typed_data';

import 'package:shared_preferences/shared_preferences.dart';

import '../../../data/demo_store.dart';
import '../../../data/day.dart';
import '../../home/water_log.dart';
import '../../plan/goal_math.dart';
import '../domain/coach_events.dart';
import '../domain/coach_conversation.dart';
import '../domain/coach_message.dart';
import '../domain/coach_repository.dart';
import 'coach_parse.dart';

/// Local Persian coach used when there is no customer API.
class MockCoachRepository
    implements CoachRepository, CoachConversationRepository {
  MockCoachRepository({
    this.store,
    this.charDelay = const Duration(milliseconds: 12),
  }) : _glasses = store == null ? 0 : store.waterGlassesOn(store.today) ?? 0;

  final DemoStore? store;
  final Duration charDelay;

  @override
  void close() {}

  @override
  Future<Uint8List?> fetchMedia(String id) async => null;

  @override
  Future<CoachDayBrief?> ensureDayBrief() async => null;

  @override
  Future<Map<String, dynamic>?> quota() async => null;

  static const _prefsKey = 'rejime_man.coach.messages.v1';
  final _seen = <String>{};
  int _seq = 1;
  int _glasses;
  int _extraCalories = 0;

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async {
    final saved = await _read();
    if (saved.isNotEmpty) {
      return CoachThreadPage(
        threadId: _conversationId,
        messages: saved,
        suggestions: _followUps,
      );
    }
    final seeded = [_dayBrief()];
    await persist(seeded);
    return CoachThreadPage(messages: seeded, suggestions: _followUps);
  }

  @override
  Stream<CoachEvent> send(
    CoachSendRequest request, {
    List<int>? photoBytes,
  }) async* {
    if (!_seen.add(request.clientMessageId)) {
      yield const CoachDone();
      return;
    }
    if (request.kind == 'photo') {
      yield* _photo();
      return;
    }
    if (request.kind == 'card_action') {
      yield* _action(request);
      return;
    }
    yield* _reply(request.text ?? '');
  }

  String? _conversationId;
  bool _initialized = false;
  final _threads = <String, Map<String, dynamic>>{};
  String get _threadsKey =>
      'rejime_man.coach.threads.v2.${store?.sessionPhone ?? "demo"}';

  @override
  String? get conversationId => _conversationId;

  Future<void>? _initializing;
  Future<void> _initialize() {
    if (_initialized) return Future<void>.value();
    return _initializing ??= _initializeOnce().whenComplete(
      () => _initializing = null,
    );
  }

  Future<void> _initializeOnce() async {
    final prefs = await _prefs();
    final raw = prefs?.getString(_threadsKey);
    if (raw != null) {
      final data = asMap(jsonDecode(raw));
      for (final row in asMapList(data['threads'])) {
        _threads[row['id'] as String] = row;
      }
      final selected = data['selected'] as String?;
      _conversationId = _threads.containsKey(selected)
          ? selected
          : _threads.keys.firstOrNull;
    } else {
      final old = prefs?.getString(_prefsKey);
      if (old != null) {
        final items = asMapList(jsonDecode(old));
        if (items.any((m) => m['role'] == 'user')) {
          final id = CoachSendRequest.text('').clientMessageId;
          _conversationId = id;
          _threads[id] = {
            'id': id,
            'title':
                items.firstWhere((m) => m['role'] == 'user')['fallback_text'] ??
                'گفتگو',
            'createdAt': items.first['created_at'],
            'lastMessageAt': items.last['created_at'],
            'messages': items,
          };
        }
      }
    }
    _initialized = true;
    if (raw == null && _threads.isNotEmpty) {
      await _saveThreads();
      await prefs?.remove(_prefsKey);
    }
  }

  Future<void> _saveThreads() async {
    final value = jsonEncode({
      'selected': _conversationId,
      'threads': _threads.values.toList(),
    });
    final prefs = await _prefs();
    await prefs?.setString(_threadsKey, value);
  }

  @override
  Future<List<CoachConversation>> listConversations() async {
    await _initialize();
    final result = [
      for (final row in _threads.values)
        CoachConversation.fromJson({
          ...row,
          'preview':
              asMapList(row['messages']).lastOrNull?['fallback_text'] ?? '',
        }),
    ];
    result.sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt).compareTo(
        a.lastMessageAt ?? a.createdAt,
      ),
    );
    return result;
  }

  @override
  Future<void> selectConversation(String? id) async {
    await _initialize();
    if (id != null && !_threads.containsKey(id)) {
      throw const CoachTransportException('گفتگو پیدا نشد.');
    }
    _conversationId = id;
    await _saveThreads();
  }

  @override
  Future<void> renameConversation(String id, String title) async {
    await _initialize();
    _threads[id]?['title'] = title;
    await _saveThreads();
  }

  @override
  Future<void> deleteConversation(String id) async {
    await _initialize();
    _threads.remove(id);
    if (_conversationId == id) _conversationId = null;
    await _saveThreads();
  }

  @override
  Future<void> persist(List<CoachMessage> messages) async {
    await _initialize();
    final ready = messages.where((m) => !m.pending && !m.failed).toList();
    if (!ready.any((m) => m.isUser)) return;
    if (_conversationId == null) {
      if (_threads.length >= 10) {
        throw const CoachTransportException(
          '۱۰ گفتگو ذخیره داری. ابتدا یکی را حذف کن.',
        );
      }
      _conversationId = CoachSendRequest.text('').clientMessageId;
    }
    final id = _conversationId!;
    final first = ready.firstWhere((m) => m.isUser);
    _threads[id] = {
      'id': id,
      'title': _threads[id]?['title'] ?? first.text,
      'createdAt':
          _threads[id]?['createdAt'] ?? first.createdAt.toIso8601String(),
      'lastMessageAt': ready.last.createdAt.toIso8601String(),
      'messages': [for (final m in ready) m.toJson()],
    };
    await _saveThreads();
  }

  @override
  Future<Map<String, dynamic>> uploadFoodPhoto(
    List<int> bytes, {
    String filename = 'meal.jpg',
  }) async => {
    'id': 'local-photo',
    'filename': filename,
    'bytes': bytes.length,
  };

  @override
  Future<CoachMessage?> patchMeal(String id, Map<String, dynamic> body) async {
    await _logMeal(body);
    return _ringMessage();
  }

  @override
  Future<Map<String, dynamic>> today() async => {
    'date': dateKey(store?.today ?? DateTime.now()),
    'calories': {'consumed': _eaten, 'target': _goal},
    'water': {
      'ml': _glasses * 250,
      'targetMl': waterGoalFrom(store?.questionnaire.water ?? '') * 250,
    },
    'weight': {'latestKg': store?.latestWeight},
  };

  @override
  Future<CoachMessage?> postAction(
    String action,
    Map<String, dynamic> data,
  ) async {
    await _applyAction(action, data);
    return _m(type: 'text', text: 'انجام شد.');
  }

  Stream<CoachEvent> _reply(String text) async* {
    final intent = _intent(text);
    final spoken = switch (intent) {
      'weight' => 'وزن امروز را همین‌جا ثبت کن. هر ۰٫۱ کیلو هم مهم است.',
      'water' => 'آفرین. یک لیوان دیگر هم به حساب امروز اضافه شد.',
      'ring' => 'این حلقهٔ امروز توست. لازم نیست کامل باشد، فقط روشن بماند.',
      'weekly' => 'نگاه هفته را آوردم. روند مهم‌تر از یک روز است.',
      'milestone' => 'این را نگه دار. پیوستگی از شدت مهم‌تر است.',
      'mood' => 'حال امروز را شنیدم. وعده را با همین انرژی تنظیم می‌کنیم.',
      'plan' => 'وعدهٔ بعدی برنامه را آوردم. اگر خواستی عوضش می‌کنیم.',
      'meal' => 'این پیشنهاد با حال‌وهوای امروزت جور است.',
      _ => 'شنیدم. اگر بخواهی وعده، وزن یا آب را همین‌جا ثبت می‌کنیم.',
    };
    final cards = <CoachMessage>[];
    switch (intent) {
      case 'weight':
        cards.add(_weigh());
      case 'water':
        _glasses = (_glasses + 1).clamp(0, 20);
        cards.add(_water());
      case 'ring':
        cards.add(_ringMessage());
      case 'weekly':
        cards.add(_weekly());
      case 'milestone':
        cards.add(_milestone());
      case 'plan':
        cards.add(_planMeal());
      case 'meal':
        cards.add(_mealFromPlan());
      default:
        break;
    }
    yield* _speak(spoken, cards);
  }

  Stream<CoachEvent> _photo() async* {
    yield CoachMessageEvent(
      _m(
        type: 'system_note',
        text: 'دارم عکست رو نگاه می‌کنم…',
        payload: const {'analyzing': true},
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 420));
    final meal = _pickMeal(prefer: 'ناهار');
    yield CoachMessageEvent(_mealCard(meal, confidence: 0.86, source: 'photo'));
    yield const CoachDone(suggestions: ['بررسی و ثبت', 'یه پیشنهاد دیگه']);
  }

  Stream<CoachEvent> _action(CoachSendRequest request) async* {
    final action = request.action ?? '';
    final data = request.data;
    await _applyAction(action, data);
    switch (action) {
      case 'log_weight':
        final value = asDouble(
          data['kilograms'] ?? data['value'],
          store?.latestWeight ?? 0,
        );
        yield* _speak('وزن ${fa(value.toStringAsFixed(1))} ثبت شد.', const []);
      case 'log_water':
        yield* _speak('آب امروز به‌روز شد.', [_water()]);
      case 'confirm_meal':
        yield* _speak('ثبت شد و به حلقهٔ امروز اضافه شد.', [_ringMessage()]);
      case 'swap_meal':
        yield* _speak('یک پیشنهاد دیگر:', [_mealFromPlan(shift: 1)]);
      case 'mood':
        yield* _speak(
          'حال «${asString(data['mood'], 'خوب')}» را یادداشت کردم.',
          const [],
        );
      default:
        yield* _speak('باشه.', const []);
    }
  }

  Future<void> _applyAction(String action, Map<String, dynamic> data) async {
    switch (action) {
      case 'log_weight':
        final value = asDouble(data['kilograms'] ?? data['value']);
        if (value > 0) store?.addWeight(value);
      case 'log_water':
        _glasses = (_glasses + asInt(data['glasses'], 1)).clamp(0, 20);
      case 'confirm_meal':
        await _logMeal(data);
      default:
        break;
    }
  }

  Future<void> _logMeal(Map<String, dynamic> data) async {
    final calories = asInt(data['calories']);
    final current = store;
    if (current == null) {
      _extraCalories += calories;
      return;
    }
    try {
      final meals = current.mealsOn(current.today);
      if (meals.isEmpty) throw StateError('no plan meal');
      final wanted = asString(data['meal_name']);
      var index = meals.indexWhere((meal) => meal.name == wanted);
      if (index < 0) index = 0;
      await current.recordMeal(
        current.today,
        index,
        'adjusted',
        foodName: asString(data['title'], meals[index].title),
      );
    } catch (_) {
      _extraCalories += calories;
    }
  }

  Stream<CoachEvent> _speak(String text, List<CoachMessage> cards) async* {
    final streamId = 's$_seq';
    for (final rune in text.runes) {
      yield CoachDelta(streamId: streamId, text: String.fromCharCode(rune));
      if (charDelay > Duration.zero) {
        await Future<void>.delayed(charDelay);
      }
    }
    if (text.isNotEmpty) {
      yield CoachMessageEvent(_m(type: 'text', text: text));
    }
    for (final card in cards) {
      yield CoachMessageEvent(card);
    }
    yield CoachDone(suggestions: _followUps);
  }

  String _intent(String raw) {
    final text = raw.replaceAll('ي', 'ی').replaceAll('ك', 'ک');
    if (text.contains('وزن')) return 'weight';
    if (text.contains('آب') || text.contains('لیوان')) return 'water';
    if (text.contains('کالری') || text.contains('حلقه')) return 'ring';
    if (text.contains('هفته')) return 'weekly';
    if (text.contains('دستاورد') || text.contains('آفرین')) return 'milestone';
    if (text.contains('حال')) return 'mood';
    if (text.contains('وعده') || text.contains('برنامه')) return 'plan';
    if (text.contains('غذا') ||
        text.contains('پیشنهاد') ||
        text.contains('ناهار') ||
        text.contains('صبحانه') ||
        text.contains('شام')) {
      return 'meal';
    }
    return 'chat';
  }

  Meal _pickMeal({String? prefer, int shift = 0}) {
    final current = store;
    if (current != null && shift == 0) {
      final next = findNextMeal(current);
      if (next != null && (prefer == null || next.meal.name.contains(prefer))) {
        return next.meal;
      }
      final today = current.mealsOn(current.today);
      if (prefer != null) {
        for (final meal in today) {
          if (meal.name.contains(prefer)) return meal;
        }
      }
      if (today.isNotEmpty) return today.first;
    }
    final samples = sampleMeals(DateTime.now().weekday + shift);
    if (prefer != null) {
      for (final meal in samples) {
        if (meal.name.contains(prefer)) return meal;
      }
    }
    return samples[(1 + shift) % samples.length];
  }

  CoachMessage _mealFromPlan({int shift = 0}) =>
      _mealCard(_pickMeal(shift: shift));

  CoachMessage _mealCard(
    Meal meal, {
    double? confidence,
    String source = 'coach',
  }) {
    final macros = macrosFor(meal.calories, meal.name);
    return _m(
      type: 'meal_card',
      fallback: meal.title,
      payload: {
        'title': meal.title,
        'meal_type_fa': meal.name,
        'meal_name': meal.name,
        'photo_title': meal.title,
        'time': meal.time,
        'calories': meal.calories,
        if (meal.preparationMinutes != null)
          'preparation_minutes': meal.preparationMinutes,
        'protein_g': macros.protein,
        'carbs_g': macros.carbs,
        'fat_g': macros.fat,
        'confidence': ?confidence,
        'source': source,
        'status': 'suggested',
        'items': [
          {
            'name': meal.title,
            'quantity': 1,
            'unit': 'serving',
            'calories': meal.calories,
            'protein_g': macros.protein,
            'carbs_g': macros.carbs,
            'fat_g': macros.fat,
          },
        ],
      },
    );
  }

  CoachMessage _planMeal() {
    final meal = _pickMeal();
    return _m(
      type: 'plan_meal',
      fallback: meal.title,
      payload: {
        'title': meal.title,
        'meal_type_fa': meal.name,
        'meal_name': meal.name,
        'photo_title': meal.title,
        'time': meal.time,
        'calories': meal.calories,
        if (meal.preparationMinutes != null)
          'preparation_minutes': meal.preparationMinutes,
      },
    );
  }

  CoachMessage _ringMessage() => _m(
    type: 'calorie_ring',
    fallback: 'کالری امروز',
    payload: {'title': 'کالری امروز', 'eaten': _eaten, 'goal': _goal},
  );

  CoachMessage _weigh() => _m(
    type: 'weigh_in',
    fallback: 'وزن امروز',
    payload: {
      'title': 'وزن امروز',
      'value': store?.latestWeight ?? 72,
      'unit': 'kg',
      'step': 0.1,
    },
  );

  CoachMessage _water() => _m(
    type: 'water',
    fallback: 'آب امروز',
    payload: {'title': 'آب امروز', 'glasses': _glasses, 'goal': 8},
  );

  CoachMessage _dayBrief() {
    final current = store;
    final meals = current == null
        ? const <Meal>[]
        : current.mealsOn(current.today);
    final shown = meals.isEmpty ? sampleMeals(DateTime.now().weekday) : meals;
    return _m(
      type: 'day_brief',
      fallback: 'خلاصهٔ امروز',
      payload: {
        'title': 'خلاصهٔ امروز',
        'note': 'یک قدم کوچک برای امروز کافی است.',
        'calories_target': _goal,
        'meals': [
          for (final meal in shown)
            {
              'name': meal.name,
              'title': meal.title,
              'time': meal.time,
              'calories': meal.calories,
            },
        ],
      },
    );
  }

  CoachMessage _weekly() => _m(
    type: 'weekly_review',
    fallback: 'مرور هفته',
    payload: {
      'title': 'مرور هفته',
      'adherence': 0.75,
      'delta_kg': -0.4,
      'note': 'بیشتر وعده‌ها ثبت شده. همین ریتم را نگه دار.',
    },
  );

  CoachMessage _milestone() => _m(
    type: 'milestone',
    fallback: 'سه روز پیوسته',
    payload: {
      'title': 'سه روز پیوسته',
      'subtitle': 'بدن دارد به این ریتم عادت می‌کند.',
    },
  );

  CoachMessage _m({
    required String type,
    String text = '',
    String? fallback,
    Map<String, dynamic> payload = const {},
  }) => CoachMessage(
    id: 'm${_seq++}-${newCoachClientId()}',
    role: 'assistant',
    type: type,
    payload: {...payload, if (text.isNotEmpty) 'text': text},
    fallbackText: fallback ?? text,
    createdAt: store?.today ?? DateTime.now(),
  );

  int get _goal {
    final current = store;
    if (current == null) return 1800;
    final target = nutritionOn(current, current.today).targetKcal;
    return target > 0 ? target : 1800;
  }

  int get _eaten {
    final current = store;
    final base = current == null
        ? 0
        : current.localConsumedCalories(current.today);
    return base + _extraCalories;
  }

  Future<List<CoachMessage>> _read() async {
    await _initialize();
    return [
      for (final row in asMapList(_threads[_conversationId]?['messages']))
        parseCoachMessage(row),
    ];
  }

  Future<SharedPreferences?> _prefs() async {
    try {
      return await SharedPreferences.getInstance();
    } catch (_) {
      return null;
    }
  }
}

const _followUps = ['یه پیشنهاد دیگه', 'حلقهٔ کالری', 'وزن امروز'];
