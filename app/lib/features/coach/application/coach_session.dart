import 'dart:async';
import 'dart:typed_data';

import '../domain/coach_events.dart';
import '../domain/coach_conversation.dart';
import '../domain/coach_message.dart';
import '../domain/coach_repository.dart';
import '../domain/coach_workspace.dart';
import '../data/coach_notebook.dart';
import '../domain/payload_values.dart';

/// Optimistic send, streaming draft, suggestions and thread history.
class CoachSession {
  CoachSession({
    required this.repository,
    this.onChanged,
    bool animateReplies = false,
  }) : _animateReplies = animateReplies;

  void Function()? onChanged;

  final CoachRepository repository;
  CoachWorkspaceRepository? get workspace =>
      repository is CoachWorkspaceRepository
      ? repository as CoachWorkspaceRepository
      : null;
  CoachNotebook get notebook =>
      CoachNotebook(workspace?.workspaceOwner ?? 'session');
  CoachMessage? replyTo;
  String? highlightedMessageId;
  int _turnGeneration = 0;
  void Function()? onQuotaChanged;

  void setReply(CoachMessage? message) {
    replyTo = message;
    _notify();
  }

  Future<void> openSearchResult(String threadId, String messageId) async {
    await selectConversation(threadId);
    while (!_disposed &&
        conversationId == threadId &&
        !messages.any((m) => m.id == messageId) &&
        hasMore &&
        error == null) {
      await loadMore();
    }
    if (conversationId == threadId) {
      if (messages.any((m) => m.id == messageId)) {
        highlightedMessageId = messageId;
      } else {
        error = 'پیام موردنظر در دسترس نیست.';
      }
      _notify();
    }
  }

  Future<void> stopResponse() async {
    if (!busy && !typing) return;
    ++_turnGeneration;
    final subscription = _sub;
    _sub = null;
    final partial = draftText;
    final completed = _reveal != null;
    _finishReveal();
    _dropAnalyzing();
    busy = false;
    typing = false;
    messages = [
      for (final m in messages)
        if (m.pending)
          m.copyWith(
            pending: false,
            payload: {...m.payload, 'deliveryUnknown': true},
          )
        else
          m,
    ];
    if (!completed && partial != null && partial.isNotEmpty) {
      _upsert(
        CoachMessage(
          id: 'stopped-${DateTime.now().microsecondsSinceEpoch}',
          role: 'assistant',
          type: 'text',
          payload: {'text': partial, 'stopped': true},
          fallbackText: partial,
          createdAt: DateTime.now(),
        ),
      );
    }
    error = 'نمایش پاسخ متوقف شد؛ پردازش سرور ممکن است ادامه داشته باشد.';
    canRetry = false;
    if (_pendingTurn?.isCompleted == false) _pendingTurn!.complete();
    _pendingTurn = null;
    _notify();
    unawaited(subscription?.cancel());
    onQuotaChanged?.call();
    final version = _conversationVersion;
    try {
      await repository.persist(messages);
      if (!_disposed && version == _conversationVersion) {
        unawaited(refreshConversations());
      }
    } catch (_) {
      if (!_disposed && version == _conversationVersion) {
        error =
            'نمایش متوقف شد؛ ذخیره گفتگو انجام نشد. متن رو قبل از خروج کپی کن.';
        _notify();
      }
    }
  }

  CoachConversationRepository? get conversationRepository =>
      repository is CoachConversationRepository
      ? repository as CoachConversationRepository
      : null;
  String? get conversationId => conversationRepository?.conversationId;
  bool _selectingConversation = false;
  String? _nextConversationId;
  String? get draftConversationId =>
      _selectingConversation ? _nextConversationId : conversationId;
  List<CoachConversation> conversations = const [];
  bool conversationsLoading = false;
  String? conversationsError;
  int _listOperation = 0;
  int _conversationVersion = 0;
  int get conversationVersion => _conversationVersion;
  Completer<void>? _pendingTurn;

  Future<void> refreshConversations() async {
    final repo = conversationRepository;
    if (repo == null || _disposed) return;
    final operation = ++_listOperation;
    conversationsLoading = true;
    conversationsError = null;
    _notify();
    try {
      final result = await repo.listConversations();
      if (_disposed || operation != _listOperation) return;
      conversations = result;
    } catch (failure) {
      if (_disposed || operation != _listOperation) return;
      conversationsError = failure is CoachTransportException
          ? failure.message
          : 'تاریخچه دریافت نشد. دوباره تلاش کن.';
    } finally {
      if (!_disposed && operation == _listOperation) {
        conversationsLoading = false;
        _notify();
      }
    }
  }

  Future<bool> newConversation() async {
    await refreshConversations();
    if (_disposed || conversationsError != null) return false;
    await selectConversation(null);
    return true;
  }

  Future<void> selectConversation(String? id) async {
    final repo = conversationRepository;
    if (repo == null || _disposed) return;
    if (id != null && id == conversationId && !loading && !historyFailed) {
      return;
    }
    final version = ++_conversationVersion;
    _selectingConversation = true;
    _nextConversationId = id;
    ++_turnGeneration;
    replyTo = null;
    highlightedMessageId = null;
    ++_historyOperation;
    _sub?.cancel();
    _sub = null;
    if (_pendingTurn?.isCompleted == false) _pendingTurn!.complete();
    _pendingTurn = null;
    _finishReveal();
    messages = const [];
    suggestions = const [];
    fresh.clear();
    answered.clear();
    photos.clear();
    _sent.clear();
    _bytes.clear();
    _historyLoaded = false;
    busy = false;
    typing = false;
    loading = true;
    loadingMore = false;
    hasMore = false;
    historyFailed = false;
    cursor = null;
    error = null;
    budgetNote = null;
    canRetry = false;
    retryClientId = null;
    _notify();
    try {
      await repo.selectConversation(id);
      if (_disposed || version != _conversationVersion) return;
      _selectingConversation = false;
      if (id == null) {
        loading = false;
        _notify();
      } else {
        await _load();
      }
    } catch (failure) {
      if (_disposed || version != _conversationVersion) return;
      _selectingConversation = false;
      loading = false;
      historyFailed = true;
      error = failure is CoachTransportException
          ? failure.message
          : 'گفتگو باز نشد.';
      _notify();
    }
  }

  Future<void> renameConversation(String id, String title) async {
    await conversationRepository?.renameConversation(id, title);
    await refreshConversations();
  }

  Future<void> deleteConversation(String id) async {
    final wasSelected = conversationId == id;
    await conversationRepository?.deleteConversation(id);
    await refreshConversations();
    if (_disposed) return;
    if (wasSelected) await selectConversation(conversations.firstOrNull?.id);
  }

  /// Fresh `GET /today`. [reloadPlan] is set when a meal was logged.
  void Function(Map<String, dynamic> today, {required bool reloadPlan})?
  onToday;

  void Function({required bool saved})? onTurnCompleted;

  List<CoachMessage> messages = const [];
  String? draftText;
  String? get typingLayout => _reveal?.text;
  String? get revealingMessageId => _reveal?.id;
  bool _animateReplies;

  void setReplyAnimation(bool enabled) {
    _animateReplies = enabled;
    if (!enabled && _reveal != null) _finishReveal();
  }

  bool typing = false;
  bool loading = true;
  bool busy = false;
  bool historyFailed = false;
  bool hasMore = false;
  bool loadingMore = false;
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
  int _historyOperation = 0;
  bool _historyLoaded = false;
  StreamSubscription<CoachEvent>? _sub;
  Timer? _revealTimer;
  CoachMessage? _reveal;
  final _sent = <String, CoachSendRequest>{};
  final _bytes = <String, Uint8List>{};

  Future<void> start({String? autoSend}) async {
    final version = _conversationVersion;
    await _load();
    if (_disposed || version != _conversationVersion) return;
    await _brief();
    if (_disposed || version != _conversationVersion) return;
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
    final operation = ++_historyOperation;
    final atStart = {for (final m in messages) m.id: m};
    if (!older) {
      loading = messages.isEmpty;
      historyFailed = false;
      _notify();
    }
    try {
      final page = await repository.loadThread(cursor: cursor);
      if (_disposed || operation != _historyOperation) return;
      messages = _mergeHistory(page.messages, older: older, atStart: atStart);
      _historyLoaded = true;
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
      if (!older) unawaited(refreshConversations());
    } on CoachTransportException catch (error) {
      if (_disposed || operation != _historyOperation) return;
      loading = false;
      historyFailed = messages.isEmpty;
      _note(
        error.problem,
        error.message,
        retryable: canRetry,
        clientId: retryClientId,
      );
    } catch (_) {
      if (_disposed || operation != _historyOperation) return;
      loading = false;
      historyFailed = messages.isEmpty;
      error = messages.isEmpty
          ? 'گفتگو را نیاوردم. دوباره تلاش کن.'
          : 'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.';
    }
    _notify();
  }

  Future<void> _brief() async {
    final version = _conversationVersion;
    try {
      final brief = await repository.ensureDayBrief();
      if (_disposed || version != _conversationVersion || brief == null) return;
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
    if (!hasMore || cursor == null || busy || loading || loadingMore) return;
    loadingMore = true;
    _notify();
    try {
      await _load(cursor: cursor, older: true);
    } finally {
      loadingMore = false;
      _notify();
    }
  }

  Future<void> sendText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return Future<void>.value();
    final quoted = replyTo;
    replyTo = null;
    return _send(
      CoachSendRequest(
        kind: 'text',
        text: trimmed,
        data: {
          if (quoted != null)
            'replyTo': {
              'id': quoted.id,
              'text': quoted.text,
              'role': quoted.role,
            },
        },
      ),
    );
  }

  Future<void> sendPhoto(
    String path,
    Uint8List bytes, {
    String? caption,
    String? mealType,
  }) {
    return _send(
      CoachSendRequest(
        kind: 'photo',
        text: caption ?? 'عکس وعده',
        data: {'path': path, 'mealType': ?mealType},
      ),
      photoBytes: bytes,
    );
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
    final version = _conversationVersion;
    if (sourceId != null) answered.add(sourceId);
    try {
      final message = await repository.patchMeal(entryId, {
        if (title.trim().isNotEmpty) 'title': title.trim(),
        'mealType': mealType,
        'items': items,
        if (planMealUid != null && planMealUid.isNotEmpty)
          'planMealUid': planMealUid,
      });
      if (_disposed || version != _conversationVersion) return null;
      if (message != null) _upsert(message);
      onTurnCompleted?.call(saved: true);
      _notify();
      await refreshToday(reloadPlan: true);
      return null;
    } on CoachTransportException catch (error) {
      if (_disposed || version != _conversationVersion) return error.message;
      _note(error.problem, error.message, retryable: false, clientId: null);
      _notify();
      return error.message;
    } catch (_) {
      const text = 'ثبت وعده انجام نشد. دوباره تلاش کن.';
      if (!_disposed && version == _conversationVersion) {
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
    final version = _conversationVersion;
    final generation = ++_turnGeneration;
    if (_reveal != null) _finishReveal();
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
        id: 'local-${request.clientMessageId}',
        role: 'user',
        type: request.kind == 'photo' ? 'user_photo' : 'text',
        payload: {
          'text': request.displayText,
          if (request.data['replyTo'] != null)
            'replyTo': request.data['replyTo'],
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
        request.action == 'confirm_meal' ||
        request.action == 'log_as_planned' ||
        request.action == 'confirm_swap' ||
        request.action == 'undo_meal';
    var replayed = false;
    CoachTransportException? failure;
    final done = Completer<void>();
    _pendingTurn = done;
    _sub = repository
        .send(request, photoBytes: photoBytes)
        .listen(
          (event) {
            if (_disposed ||
                version != _conversationVersion ||
                generation != _turnGeneration) {
              return;
            }
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
                if (_animateReplies &&
                    !message.isUser &&
                    message.type == 'text' &&
                    message.text.length > 1) {
                  _typeOut(message);
                  break;
                }
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
              case CoachDone(
                :final suggestions,
                :final userMessage,
                replayed: final wasReplayed,
              ):
                replayed = wasReplayed;
                settled = true;
                succeeded = true;
                if (_reveal == null) {
                  draft.clear();
                  draftText = null;
                }
                _dropAnalyzing();
                if (suggestions.isNotEmpty) this.suggestions = suggestions;
                if (userMessage != null) _replacePending(userMessage);
                _mark(request.clientMessageId, failed: false);
                canRetry = false;
                error = null;
              case CoachErrorEvent(
                :final message,
                :final problem,
                :final retryable,
              ):
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
            if (_disposed ||
                version != _conversationVersion ||
                generation != _turnGeneration) {
              return;
            }
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
            if (_disposed ||
                version != _conversationVersion ||
                generation != _turnGeneration) {
              return;
            }
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
              acknowledge: !replayed,
            );
            if (!done.isCompleted) done.complete();
          },
          cancelOnError: true,
        );
    await done.future;
    if (_disposed ||
        version != _conversationVersion ||
        generation != _turnGeneration) {
      return;
    }
    _pendingTurn = null;
    await repository.persist(messages);
    if (_disposed || version != _conversationVersion) return;
    unawaited(refreshConversations());
    onQuotaChanged?.call();
  }

  void _closeTurn({
    required StringBuffer draft,
    required CoachSendRequest request,
    required CoachTransportException? failure,
    required bool succeeded,
    required bool refresh,
    required bool reloadPlan,
    bool acknowledge = false,
  }) {
    typing = failure == null && _reveal != null;
    busy = false;
    _sub = null;
    if (failure != null) {
      _failTurn(failure, draft, request.clientMessageId);
    }
    if (succeeded && failure == null && acknowledge) {
      onTurnCompleted?.call(
        saved:
            reloadPlan ||
            request.action == 'log_water' ||
            request.action == 'log_weight',
      );
    }
    if (succeeded && refresh) {
      unawaited(refreshToday(reloadPlan: reloadPlan));
    }
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
      action == 'confirm_swap' ||
      action == 'undo_meal' ||
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
    final version = _conversationVersion;
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
      if (_disposed || version != _conversationVersion) return;
      if (bytes == null || bytes.isEmpty) continue;
      photos[id] = bytes;
      _notify();
    }
  }

  List<CoachMessage> _mergeHistory(
    List<CoachMessage> incoming, {
    required bool older,
    required Map<String, CoachMessage> atStart,
  }) {
    final merged = [...messages];
    var insertion = older || !_historyLoaded ? 0 : merged.length;
    for (final message in incoming.reversed) {
      final index = merged.indexWhere(
        (m) =>
            m.id == message.id ||
            (m.isUser &&
                message.isUser &&
                message.clientMessageId != null &&
                m.clientMessageId == message.clientMessageId),
      );
      if (index >= 0) {
        final current = merged[index];
        // A stream update received during this request is newer than its snapshot.
        if (current.id != message.id ||
            identical(current, atStart[message.id])) {
          merged[index] = message;
        }
        insertion = index;
      } else {
        merged.insert(insertion, message);
      }
    }
    final seen = <String>{};
    final out = <CoachMessage>[];
    for (final message in merged) {
      if (seen.add(message.id)) out.add(message);
    }
    return out;
  }

  void _notify() {
    if (!_disposed) onChanged?.call();
  }

  void _typeOut(CoachMessage message) {
    _revealTimer?.cancel();
    _upsert(message);
    _reveal = message;
    var shown = 0;
    final full = message.text;
    draftText = '';
    typing = true;
    _notify();
    void step() {
      if (_disposed || _reveal?.id != message.id) return;
      if (shown >= full.length) {
        _reveal = null;
        draftText = null;
        typing = false;
        _notify();
        return;
      }
      shown += 1;
      draftText = full.substring(0, shown);
      _notify();
      final mark = full[shown - 1];
      final pause = switch (mark) {
        '\n' => 90,
        ' ' => 26,
        '،' || ',' || '؛' || ':' => 160,
        '.' || '!' || '؟' || '?' => 240,
        _ => 46,
      };
      _revealTimer = Timer(Duration(milliseconds: pause), step);
    }

    _revealTimer = Timer(const Duration(milliseconds: 46), step);
  }

  void _finishReveal() {
    _revealTimer?.cancel();
    _revealTimer = null;
    _reveal = null;
    draftText = null;
    typing = false;
  }

  void close() {
    _disposed = true;
    if (_pendingTurn?.isCompleted == false) _pendingTurn!.complete();
    _revealTimer?.cancel();
    _sub?.cancel();
    repository.close();
    onChanged = null;
  }
}
