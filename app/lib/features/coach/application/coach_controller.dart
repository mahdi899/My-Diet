import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

import '../../../data/demo_store.dart';
import '../data/coach_parse.dart';
import '../data/http_coach_repository.dart';
import '../data/mock_coach_repository.dart';
import '../domain/coach_events.dart';
import '../domain/coach_message.dart';
import '../domain/coach_repository.dart';

/// Demo (no API) uses the scripted coach. A live [CustomerAuth] uses HTTP,
/// including before the access token has been restored.
CoachRepository createCoachRepository(DemoStore store) {
  final auth = store.customerAuth;
  if (auth == null) {
    return MockCoachRepository(store: store, charDelay: _charDelay());
  }
  return HttpCoachRepository(auth: auth);
}

Duration _charDelay() {
  final binding = SchedulerBinding.instance.runtimeType.toString();
  if (binding.contains('Test')) return Duration.zero;
  return const Duration(milliseconds: 16);
}

/// Optimistic send, streaming draft, suggestions and thread history.
class CoachController extends ChangeNotifier {
  CoachController({required this.repository});

  final CoachRepository repository;

  /// Fresh `GET /today`. [reloadPlan] is set when a meal was logged.
  void Function(Map<String, dynamic> today, {required bool reloadPlan})? onToday;

  List<CoachMessage> messages = const [];
  String? draftText;
  bool typing = false;
  bool loading = true;
  bool busy = false;
  bool historyFailed = false;
  bool hasMore = false;
  String? cursor;
  String? error;
  String? budgetNote;
  bool sessionExpired = false;
  bool canRetry = false;
  String? retryClientId;
  List<String> suggestions = const [];
  final fresh = <String>{};
  final answered = <String>{};
  final photos = <String, Uint8List>{};

  bool _disposed = false;
  int _local = 0;
  StreamSubscription<CoachEvent>? _sub;
  final _sent = <String, CoachSendRequest>{};
  final _bytes = <String, Uint8List>{};

  Future<void> start({String? autoSend}) async {
    await _load();
    await _brief();
    final text = autoSend?.trim();
    if (text != null && text.isNotEmpty) await sendText(text);
  }

  Future<void> retry() => _load();

  Future<void> refreshToday({bool reloadPlan = false}) async {
    try {
      final snapshot = await repository.today();
      if (_disposed) return;
      onToday?.call(snapshot, reloadPlan: reloadPlan);
    } catch (_) {
      // The thread stays. The ring keeps the last numbers it had.
    }
  }

  Future<void> _load({String? cursor, bool older = false}) async {
    if (!older) {
      loading = messages.isEmpty;
      historyFailed = false;
      _notify();
    }
    try {
      final page = await repository.loadThread(cursor: cursor);
      if (_disposed) return;
      messages = _dedupe(
        older ? [...page.messages, ...messages] : page.messages,
      );
      if (!older) {
        if (page.suggestions.isNotEmpty) {
          suggestions = page.suggestions;
        } else {
          final labels = _labelsFrom(page.messages);
          if (labels.isNotEmpty) suggestions = labels;
        }
      }
      hasMore = page.hasMore;
      this.cursor = page.cursor;
      loading = false;
      historyFailed = false;
      unawaited(_warmPhotos());
    } on CoachTransportException catch (error) {
      if (_disposed) return;
      loading = false;
      historyFailed = messages.isEmpty;
      _note(error.problem, error.message, retryable: false, clientId: null);
    } catch (_) {
      if (_disposed) return;
      loading = false;
      historyFailed = messages.isEmpty;
      error = messages.isEmpty
          ? 'گفتگو را نیاوردم. دوباره تلاش کن.'
          : 'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.';
    }
    _notify();
  }

  Future<void> _brief() async {
    try {
      final brief = await repository.ensureDayBrief();
      if (_disposed || brief == null) return;
      if (brief.created) {
        await _load();
        return;
      }
      _upsert(brief.message);
      _notify();
    } catch (_) {
      // A missing brief can arrive with the next open. The thread still works.
    }
  }

  Future<void> loadMore() async {
    if (!hasMore || cursor == null || busy) return;
    await _load(cursor: cursor, older: true);
  }

  Future<void> sendText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return Future<void>.value();
    return _send(CoachSendRequest.text(trimmed));
  }

  Future<void> sendPhoto(String path, Uint8List bytes) {
    return _send(CoachSendRequest.photo(path), photoBytes: bytes);
  }

  Future<void> sendAction(
    String action,
    Map<String, dynamic> data, {
    String? label,
    String? sourceId,
  }) {
    if (sourceId != null) answered.add(sourceId);
    final args = Map<String, dynamic>.from(data);
    if (isCoachUuid(sourceId)) args['sourceMessageId'] = sourceId;
    return _send(CoachSendRequest.action(action, args, label: label));
  }

  /// Confirms or edits a suggested photo meal, then refreshes today.
  Future<String?> confirmMeal({
    required String entryId,
    required String title,
    required String mealType,
    required List<Map<String, dynamic>> items,
    String? planMealUid,
    String? sourceId,
  }) async {
    if (sourceId != null) answered.add(sourceId);
    try {
      final message = await repository.patchMeal(entryId, {
        if (title.trim().isNotEmpty) 'title': title.trim(),
        'mealType': mealType,
        'items': items,
        if (planMealUid != null && planMealUid.isNotEmpty)
          'planMealUid': planMealUid,
      });
      if (_disposed) return null;
      if (message != null) _upsert(message);
      _notify();
      await refreshToday(reloadPlan: true);
      return null;
    } on CoachTransportException catch (error) {
      if (_disposed) return error.message;
      _note(error.problem, error.message, retryable: false, clientId: null);
      _notify();
      return error.message;
    } catch (_) {
      const text = 'ثبت وعده انجام نشد. دوباره تلاش کن.';
      if (!_disposed) {
        error = text;
        _notify();
      }
      return text;
    }
  }

  Future<void> retrySend(String? clientId) {
    final id = clientId ?? retryClientId;
    if (id == null || busy || _disposed) return Future<void>.value();
    final request = _sent[id];
    if (request == null) return Future<void>.value();
    return _send(request, photoBytes: _bytes[id], reuse: true);
  }

  Uint8List? photoFor(CoachMessage message) {
    final client = message.clientMessageId;
    if (client != null) {
      final bytes = photos[client];
      if (bytes != null) return bytes;
    }
    final media = message.payload['mediaId'];
    if (media is String) return photos[media];
    return null;
  }

  Future<void> _send(
    CoachSendRequest request, {
    List<int>? photoBytes,
    bool reuse = false,
  }) async {
    if (busy || _disposed) return;
    _sent[request.clientMessageId] = request;
    if (photoBytes != null && photoBytes.isNotEmpty) {
      final bytes = photoBytes is Uint8List
          ? photoBytes
          : Uint8List.fromList(photoBytes);
      photos[request.clientMessageId] = bytes;
      _bytes[request.clientMessageId] = bytes;
    }
    if (reuse) {
      messages = [
        for (final message in messages)
          if (message.clientMessageId == request.clientMessageId &&
              (message.pending || message.failed))
            message.copyWith(pending: true, failed: false)
          else
            message,
      ];
    } else {
      final optimistic = CoachMessage(
        id: 'local-${_local++}',
        role: 'user',
        type: request.kind == 'photo' ? 'user_photo' : 'text',
        payload: {
          'text': request.displayText,
          if (request.kind == 'photo') 'path': request.data['path'],
        },
        fallbackText: request.displayText,
        clientMessageId: request.clientMessageId,
        createdAt: DateTime.now(),
        pending: true,
      );
      messages = [...messages, optimistic];
      fresh.add(optimistic.id);
      draftText = null;
    }
    busy = true;
    typing = true;
    error = null;
    budgetNote = null;
    canRetry = false;
    _notify();

    final draft = StringBuffer();
    var segment = -1;
    var settled = false;
    var succeeded = false;
    var refresh = _logsToday(request.action);
    var reloadPlan =
        request.action == 'confirm_meal' || request.action == 'log_as_planned';
    CoachTransportException? failure;
    final done = Completer<void>();
    _sub = repository.send(request, photoBytes: photoBytes).listen(
      (event) {
        if (_disposed) return;
        switch (event) {
          case CoachDelta(text: final text, segment: final next):
            if (next != segment) {
              segment = next;
              draft.clear();
            }
            draft.write(text);
            draftText = draft.toString();
            typing = true;
          case CoachUserMessage(:final message):
            _replacePending(message);
            _sharePhoto(request.clientMessageId, message);
          case CoachToolEvent():
            typing = true;
          case CoachMessageEvent(:final message):
            if (message.payload['analyzing'] == true) {
              _upsert(message);
              break;
            }
            _dropAnalyzing();
            draft.clear();
            draftText = null;
            segment = -1;
            _sharePhoto(request.clientMessageId, message);
            if (message.type == 'quick_replies') {
              final labels = _labelsFrom([message]);
              if (labels.isNotEmpty) suggestions = labels;
            }
            if (message.type == 'meal_card' &&
                message.payload['status'] == 'logged') {
              refresh = true;
              reloadPlan = true;
            }
            if (message.type == 'calorie_ring' ||
                message.type == 'water' ||
                message.type == 'weigh_in') {
              refresh = true;
            }
            _upsert(message);
          case CoachDone(:final suggestions, :final userMessage):
            settled = true;
            succeeded = true;
            draft.clear();
            draftText = null;
            _dropAnalyzing();
            if (suggestions.isNotEmpty) this.suggestions = suggestions;
            if (userMessage != null) _replacePending(userMessage);
            _mark(request.clientMessageId, failed: false);
            canRetry = false;
            error = null;
          case CoachErrorEvent(:final message, :final problem, :final retryable):
            settled = true;
            failure = CoachTransportException(
              message,
              problem: problem,
              retryable: retryable,
            );
        }
        _notify();
      },
      onError: (Object error) {
        if (_disposed) return;
        settled = true;
        failure = error is CoachTransportException
            ? error
            : const CoachTransportException(
                'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.',
                problem: CoachProblem.offline,
                retryable: true,
              );
        _closeTurn(
          draft: draft,
          request: request,
          failure: failure,
          succeeded: false,
          refresh: false,
          reloadPlan: false,
        );
        if (!done.isCompleted) done.complete();
      },
      onDone: () {
        if (_disposed) return;
        if (!settled) {
          failure = const CoachTransportException(
            'ارتباط وسط جواب قطع شد. دوباره بفرست.',
            problem: CoachProblem.offline,
            retryable: true,
          );
        }
        _closeTurn(
          draft: draft,
          request: request,
          failure: failure,
          succeeded: succeeded,
          refresh: refresh,
          reloadPlan: reloadPlan,
        );
        if (!done.isCompleted) done.complete();
      },
      cancelOnError: true,
    );
    await done.future;
  }

  void _closeTurn({
    required StringBuffer draft,
    required CoachSendRequest request,
    required CoachTransportException? failure,
    required bool succeeded,
    required bool refresh,
    required bool reloadPlan,
  }) {
    typing = false;
    busy = false;
    _sub = null;
    if (failure != null) {
      _failTurn(failure, draft, request.clientMessageId);
    }
    if (succeeded && refresh) {
      unawaited(refreshToday(reloadPlan: reloadPlan));
    }
    unawaited(repository.persist(messages));
    _notify();
  }

  void _failTurn(
    CoachTransportException failure,
    StringBuffer draft,
    String clientId,
  ) {
    typing = false;
    busy = false;
    _dropAnalyzing();
    final partial = draft.toString();
    final keepDraft =
        failure.retryable &&
        failure.problem != CoachProblem.safety &&
        failure.problem != CoachProblem.budget &&
        (partial.isNotEmpty || (draftText != null && draftText!.isNotEmpty));
    if (partial.isNotEmpty) draftText = partial;
    if (!keepDraft) {
      draft.clear();
      if (failure.problem != CoachProblem.offline) draftText = null;
    }
    _note(
      failure.problem,
      failure.message,
      retryable: failure.retryable && keepDraft || _retryChip(failure),
      clientId: clientId,
    );
    if (failure.problem == CoachProblem.safety) {
      _upsert(
        CoachMessage(
          id: 'safety-${DateTime.now().microsecondsSinceEpoch}',
          role: 'assistant',
          type: 'text',
          payload: {'text': failure.message},
          fallbackText: failure.message,
          createdAt: DateTime.now(),
        ),
      );
      _mark(clientId, failed: false);
    } else if (failure.retryable &&
        failure.problem != CoachProblem.budget &&
        failure.problem != CoachProblem.expired) {
      _mark(clientId, failed: true);
    } else {
      _mark(clientId, failed: false);
    }
    _notify();
  }

  bool _retryChip(CoachTransportException failure) {
    if (failure.problem == CoachProblem.budget ||
        failure.problem == CoachProblem.safety ||
        failure.problem == CoachProblem.expired) {
      return false;
    }
    return failure.retryable;
  }

  void _note(
    CoachProblem problem,
    String message, {
    required bool retryable,
    required String? clientId,
  }) {
    switch (problem) {
      case CoachProblem.budget:
        budgetNote = message;
        error = null;
        canRetry = false;
      case CoachProblem.expired:
        sessionExpired = true;
        error = message;
        budgetNote = null;
        canRetry = false;
      case CoachProblem.safety:
        error = null;
        budgetNote = null;
        canRetry = false;
      case CoachProblem.offline:
      case CoachProblem.message:
        error = message;
        budgetNote = null;
        canRetry = retryable;
        if (retryable) retryClientId = clientId;
    }
  }

  bool _logsToday(String? action) =>
      action == 'confirm_meal' ||
      action == 'log_as_planned' ||
      action == 'log_water' ||
      action == 'log_weight' ||
      action == 'show_ring';

  void _replacePending(CoachMessage incoming) {
    final id = incoming.clientMessageId;
    if (id == null) {
      _upsert(incoming);
      return;
    }
    final index = messages.indexWhere(
      (message) =>
          message.clientMessageId == id && (message.pending || message.failed),
    );
    if (index < 0) {
      _upsert(incoming);
      return;
    }
    final next = [...messages];
    next[index] = incoming;
    messages = next;
    _sharePhoto(id, incoming);
  }

  void _sharePhoto(String clientId, CoachMessage message) {
    final media = message.payload['mediaId'];
    final bytes = photos[clientId];
    if (media is String && bytes != null) photos[media] = bytes;
  }

  void _upsert(CoachMessage message) {
    final index = messages.indexWhere((item) => item.id == message.id);
    if (index >= 0) {
      final next = [...messages];
      next[index] = message;
      messages = next;
      return;
    }
    messages = [...messages, message];
    fresh.add(message.id);
  }

  void _dropAnalyzing() {
    messages = [
      for (final message in messages)
        if (message.payload['analyzing'] != true) message,
    ];
  }

  void _mark(String clientId, {required bool failed}) {
    messages = [
      for (final message in messages)
        if (message.clientMessageId == clientId &&
            (message.pending || message.failed))
          message.copyWith(pending: false, failed: failed)
        else
          message,
    ];
  }

  List<String> _labelsFrom(List<CoachMessage> items) {
    final labels = <String>[];
    for (final message in items.reversed) {
      if (message.type != 'quick_replies') continue;
      for (final option in asMapList(message.payload['options'])) {
        final label = asString(option['label'], asString(option['value']));
        if (label.isNotEmpty) labels.add(label);
      }
      if (labels.isNotEmpty) break;
    }
    return labels;
  }

  Future<void> _warmPhotos() async {
    final ids = <String>[];
    for (final message in messages) {
      final id = message.payload['mediaId'];
      if (id is String && id.isNotEmpty && !photos.containsKey(id)) {
        ids.add(id);
      }
    }
    for (final id in ids) {
      if (_disposed) return;
      final bytes = await repository.fetchMedia(id);
      if (bytes == null || bytes.isEmpty) continue;
      photos[id] = bytes;
      _notify();
    }
  }

  List<CoachMessage> _dedupe(List<CoachMessage> items) {
    final seen = <String>{};
    final out = <CoachMessage>[];
    for (final message in items) {
      if (seen.add(message.id)) out.add(message);
    }
    return out;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _sub?.cancel();
    repository.close();
    super.dispose();
  }
}
