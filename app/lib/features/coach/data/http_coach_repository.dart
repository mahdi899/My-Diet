import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/coach_conversation.dart';
import '../domain/coach_workspace.dart';

import '../../../data/customer_auth.dart';
import '../domain/coach_events.dart';
import '../domain/coach_message.dart';
import '../domain/coach_repository.dart';
import 'coach_image.dart';
import 'coach_parse.dart';
import 'coach_wire.dart';

/// Live coach client. JSON and SSE both use [http.Client.send] and the session bearer token.
class HttpCoachRepository
    implements
        CoachRepository,
        CoachConversationRepository,
        CoachWorkspaceRepository {
  HttpCoachRepository({required this.auth, http.Client? client})
    : _client = client ?? http.Client(),
      _ownsClient = client == null;

  final CustomerAuth auth;
  final http.Client _client;
  final bool _ownsClient;

  String? _conversationId;
  bool _selectionReady = false;
  int _selectionVersion = 0;
  String? _creationId;

  @override
  String? get conversationId => _conversationId;
  String get _selectionKey => 'rejime_man.coach.selected.${auth.userId}';
  @override
  String get workspaceOwner => 'account.${auth.userId}';
  @override
  Future<Map<String, dynamic>> searchMessages(
    String query, {
    String? before,
  }) async => asMap(
    await _json(
      'search?${Uri(queryParameters: {'q': query, 'before': ?before}).query}',
    ),
  );
  @override
  Future<Map<String, dynamic>> memory() async => asMap(
    await _json(
      'memory${_conversationId == null ? "" : "?threadId=$_conversationId"}',
    ),
  );
  @override
  Future<void> editMemory(String id, String? value) async {
    await _json(
      'memory/${Uri.encodeComponent(id)}',
      method: value == null ? 'DELETE' : 'PATCH',
      body: value == null ? null : {'value': value},
    );
  }

  @override
  Future<List<CoachConversation>> listConversations() async {
    final data = asMap(await _json('threads'));
    return [
      for (final row in asMapList(data['threads']))
        CoachConversation.fromJson(row),
    ];
  }

  Future<void> _restoreSelection() async {
    if (_selectionReady) return;
    final version = _selectionVersion;
    final threads = await listConversations();
    final prefs = await SharedPreferences.getInstance();
    if (version != _selectionVersion || _selectionReady) return;
    final saved = prefs.getString(_selectionKey);
    _conversationId = threads.any((t) => t.id == saved)
        ? saved
        : threads.firstOrNull?.id;
    _selectionReady = true;
  }

  @override
  Future<void> selectConversation(String? id) async {
    _selectionVersion++;
    _selectionReady = true;
    _conversationId = id;
    _creationId = null;
    final prefs = await SharedPreferences.getInstance();
    if (id == null) {
      await prefs.remove(_selectionKey);
    } else {
      await prefs.setString(_selectionKey, id);
    }
  }

  Future<String> _ensureConversation() async {
    final version = _selectionVersion;
    await _restoreSelection();
    if (version != _selectionVersion) {
      throw const CoachTransportException('گفتگو تغییر کرد؛ پیام ارسال نشد.');
    }
    if (_conversationId != null) return _conversationId!;
    _creationId ??= CoachSendRequest.text('').clientMessageId;
    final result = asMap(
      await _json('threads', method: 'POST', body: {'id': _creationId}),
    );
    final id = asMap(result['thread'])['id'] as String;
    if (version == _selectionVersion) {
      _conversationId = id;
      final prefs = await SharedPreferences.getInstance();
      if (version == _selectionVersion) {
        await prefs.setString(_selectionKey, id);
      }
    }
    return id;
  }

  @override
  Future<void> renameConversation(String id, String title) async {
    await _json(
      'threads/${Uri.encodeComponent(id)}',
      method: 'PATCH',
      body: {'title': title},
    );
  }

  @override
  Future<void> deleteConversation(String id) async {
    await _json('threads/${Uri.encodeComponent(id)}', method: 'DELETE');
    if (_conversationId == id) await selectConversation(null);
  }

  Uri _uri(String path) {
    final root = auth.baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$root/v1/me/coach/$path');
  }

  Map<String, String> _headers({bool sse = false}) {
    final session = auth.session;
    return {
      'Accept': sse ? 'text/event-stream' : 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      if (kIsWeb) 'x-sabzine-client': 'web',
      if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
    };
  }

  @override
  Future<Map<String, dynamic>?> quota() async {
    final value = await _json('quota');
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    return null;
  }

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async {
    await _restoreSelection();
    final id = _conversationId;
    if (id == null) return const CoachThreadPage();
    final query = Uri(
      queryParameters: {
        'threadId': id,
        if (cursor != null && cursor.isNotEmpty) 'before': cursor,
      },
    ).query;
    final page = parseThreadPage(await _json('thread?$query'));
    final prefs = await SharedPreferences.getInstance();
    if (_conversationId == id) await prefs.setString(_selectionKey, id);
    return page;
  }

  @override
  Stream<CoachEvent> send(
    CoachSendRequest request, {
    List<int>? photoBytes,
  }) async* {
    try {
      if (photoBytes != null && photoBytes.isNotEmpty) {
        yield* _photo(request, photoBytes);
        return;
      }
      final action = request.action;
      if ((request.kind == 'card_action' || request.kind == 'quick_reply') &&
          action != null &&
          kCoachServerActions.contains(action)) {
        yield* _action(request);
        return;
      }
      final threadId = await _ensureConversation();
      yield* _sse({...coachMessageBody(request), 'threadId': threadId});
    } on CoachTransportException {
      rethrow;
    } catch (_) {
      throw const CoachTransportException(
        'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.',
        problem: CoachProblem.offline,
        retryable: true,
      );
    }
  }

  Stream<CoachEvent> _photo(CoachSendRequest request, List<int> bytes) async* {
    yield CoachMessageEvent(
      CoachMessage(
        id: 'analyzing-${request.clientMessageId}',
        role: 'assistant',
        type: 'system_note',
        payload: const {'analyzing': true, 'text': 'دارم عکست رو نگاه می‌کنم…'},
        fallbackText: 'دارم عکست رو نگاه می‌کنم…',
        createdAt: DateTime.now(),
      ),
    );
    final data = asMap(
      await _postPhoto(request, bytes, timeout: const Duration(seconds: 90)),
    );
    yield* _transcript(data);
  }

  Future<dynamic> _postPhoto(
    CoachSendRequest request,
    List<int> bytes, {
    Duration timeout = const Duration(seconds: 90),
  }) async {
    final threadId = await _ensureConversation();
    final compressed = await compressFoodPhoto(
      bytes is Uint8List ? bytes : Uint8List.fromList(bytes),
    );
    return _json(
      'food-photos',
      method: 'POST',
      body: {
        'threadId': threadId,
        ...coachPhotoBody(
          clientMessageId: request.clientMessageId,
          base64: base64Encode(compressed.bytes),
          mime: compressed.mime,
          caption: request.text,
          mealType: request.data['mealType'] as String?,
        ),
      },
      timeout: timeout,
    );
  }

  Stream<CoachEvent> _action(CoachSendRequest request) async* {
    final threadId = await _ensureConversation();
    final data = asMap(
      await _json(
        'actions',
        method: 'POST',
        body: {...coachActionBody(request), 'threadId': threadId},
      ),
    );
    yield* _transcript(data);
  }

  Stream<CoachEvent> _transcript(Map<String, dynamic> data) async* {
    final user = parseOptionalMessage(data['userMessage']);
    if (user != null) yield CoachUserMessage(user);
    for (final item in asMapList(data['messages'])) {
      yield CoachMessageEvent(parseCoachMessage(item));
    }
    yield const CoachDone();
  }

  Stream<CoachEvent> _sse(Map<String, dynamic> body) async* {
    final response = await _openSse(body);
    await for (final event in parseSseStream(response.stream)) {
      // Older servers omit the client ID from the user echo. This stream
      // acknowledges the request that opened it, so replace its pending bubble.
      if (event is CoachUserMessage && event.message.clientMessageId == null) {
        yield CoachUserMessage(
          event.message.copyWith(
            clientMessageId: body['clientMessageId'] as String,
          ),
        );
      } else {
        yield event;
      }
    }
  }

  Future<http.StreamedResponse> _openSse(Map<String, dynamic> body) async {
    _requireSession();
    Future<http.StreamedResponse> once() {
      final request = http.Request('POST', _uri('messages'))
        ..headers.addAll(_headers(sse: true))
        ..body = jsonEncode(body);
      return _client.send(request).timeout(const Duration(seconds: 45));
    }

    var response = await once();
    if (response.statusCode == 401) {
      if (await auth.restore() == null) {
        throw const CoachTransportException(
          'نشست پایان یافته؛ دوباره وارد شو.',
          code: 'unauthorized',
          problem: CoachProblem.expired,
          retryable: false,
        );
      }
      response = await once();
    }
    if (response.statusCode >= 400) {
      final text = await response.stream.bytesToString();
      throw coachTransportFrom(status: response.statusCode, body: text);
    }
    return response;
  }

  Future<dynamic> _json(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    _requireSession();
    Future<http.Response> once() {
      final request = http.Request(method, _uri(path))
        ..headers.addAll(_headers());
      if (body != null) request.body = jsonEncode(body);
      return _client
          .send(request)
          .then(http.Response.fromStream)
          .timeout(timeout);
    }

    try {
      var response = await once();
      if (response.statusCode == 401) {
        if (await auth.restore() == null) {
          throw const CoachTransportException(
            'نشست پایان یافته؛ دوباره وارد شو.',
            code: 'unauthorized',
            problem: CoachProblem.expired,
            retryable: false,
          );
        }
        response = await once();
      }
      final text = utf8.decode(response.bodyBytes);
      if (response.statusCode >= 400) {
        throw coachTransportFrom(status: response.statusCode, body: text);
      }
      if (text.isEmpty) return null;
      return jsonDecode(text);
    } on CoachTransportException {
      rethrow;
    } on TimeoutException {
      throw const CoachTransportException(
        'پاسخ مربی به‌موقع نرسید.',
        problem: CoachProblem.offline,
        retryable: true,
      );
    } catch (error) {
      if (error is CoachTransportException) rethrow;
      throw const CoachTransportException(
        'ارتباط قطع شد. وقتی آنلاین شدی، دوباره بفرست.',
        problem: CoachProblem.offline,
        retryable: true,
      );
    }
  }

  void _requireSession() {
    if (auth.session == null) {
      throw const CoachTransportException('ابتدا وارد شو.', retryable: false);
    }
  }

  @override
  Future<void> persist(List<CoachMessage> messages) async {}

  @override
  Future<Map<String, dynamic>> uploadFoodPhoto(
    List<int> bytes, {
    String filename = 'meal.jpg',
  }) async {
    final data = await _postPhoto(CoachSendRequest.photo(filename), bytes);
    return asMap(data);
  }

  @override
  Future<CoachMessage?> patchMeal(String id, Map<String, dynamic> body) async {
    final data = await _json(
      'meals/${Uri.encodeComponent(id)}',
      method: 'PATCH',
      body: body,
    );
    return parseOptionalMessage(asMap(data)['message']);
  }

  @override
  Future<Map<String, dynamic>> today() async => asMap(await _json('today'));

  @override
  Future<CoachMessage?> postAction(
    String action,
    Map<String, dynamic> data,
  ) async {
    CoachMessage? last;
    await for (final event in _action(CoachSendRequest.action(action, data))) {
      if (event is CoachMessageEvent) last = event.message;
    }
    return last;
  }

  @override
  Future<CoachDayBrief?> ensureDayBrief() async {
    final id = _conversationId;
    if (id == null) return null;
    final data = asMap(
      await _json('day-brief', method: 'POST', body: {'threadId': id}),
    );
    final message = parseOptionalMessage(data['message']);
    if (message == null) return null;
    return CoachDayBrief(message: message, created: data['created'] == true);
  }

  @override
  Future<Uint8List?> fetchMedia(String id) async {
    try {
      if (auth.session == null || id.isEmpty) return null;
      Future<http.Response> once() {
        final request =
            http.Request('GET', _uri('media/${Uri.encodeComponent(id)}'))
              ..headers.addAll({
                'Accept': 'image/*',
                if (kIsWeb) 'x-sabzine-client': 'web',
                'Authorization': 'Bearer ${auth.session!.accessToken}',
              });
        return _client
            .send(request)
            .then(http.Response.fromStream)
            .timeout(const Duration(seconds: 20));
      }

      var response = await once();
      if (response.statusCode == 401) {
        if (await auth.restore() == null) return null;
        response = await once();
      }
      if (response.statusCode >= 400 || response.bodyBytes.isEmpty) return null;
      return response.bodyBytes;
    } catch (_) {
      return null;
    }
  }

  @override
  void close() {
    if (_ownsClient) _client.close();
  }
}
