import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../domain/coach_message.dart';

/// Device storage scoped to the signed-in owner, independent of thread retention.
class CoachNotebook {
  const CoachNotebook(this.owner);
  final String owner;
  static final _draftWrites = <String, Future<void>>{};
  String _draftKey(String? thread) =>
      'coach.draft.v1.$owner.${thread ?? "new"}';
  String get _savedKey => 'coach.saved.v1.$owner';

  Future<Map<String, dynamic>> draft(String? thread) async {
    await _draftWrites[_draftKey(thread)]?.catchError((_) {});
    final raw = (await SharedPreferences.getInstance()).getString(
      _draftKey(thread),
    );
    return raw == null ? {} : Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  Future<void> saveDraft(
    String? thread,
    String text,
    Map<String, dynamic>? reply,
  ) {
    final key = _draftKey(thread);
    return _draftWrites[key] = (_draftWrites[key] ?? Future<void>.value())
        .catchError((_) {})
        .then((_) async {
          final prefs = await SharedPreferences.getInstance();
          if (text.isEmpty && reply == null) {
            await prefs.remove(_draftKey(thread));
          } else {
            if (!await prefs.setString(
              _draftKey(thread),
              jsonEncode({'text': text, 'reply': reply}),
            )) {
              throw StateError('ذخیره پیش‌نویس انجام نشد');
            }
          }
        });
  }

  Future<List<Map<String, dynamic>>> saved() async {
    final raw = (await SharedPreferences.getInstance()).getString(_savedKey);
    return raw == null
        ? []
        : (jsonDecode(raw) as List)
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
  }

  Future<void> bookmark(
    CoachMessage message,
    String? thread,
    String title,
  ) async {
    final items = await saved();
    items.removeWhere((e) => e['id'] == message.id);
    items.insert(0, {
      'id': message.id,
      'threadId': thread,
      'title': title,
      'text': message.text,
      'role': message.role,
      'createdAt': message.createdAt.toIso8601String(),
    });
    if (!await (await SharedPreferences.getInstance()).setString(
      _savedKey,
      jsonEncode(items),
    )) {
      throw StateError('ذخیره پیام انجام نشد');
    }
  }

  Future<void> removeBookmark(String id) async {
    final items = (await saved())..removeWhere((e) => e['id'] == id);
    if (!await (await SharedPreferences.getInstance()).setString(
      _savedKey,
      jsonEncode(items),
    )) {
      throw StateError('حذف نشان انجام نشد');
    }
  }
}
