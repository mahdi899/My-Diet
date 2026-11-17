import 'package:flutter/foundation.dart';
import 'dart:math';

String messageRequestId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

enum MessageState { pending, sent, delivered, read, failed }

enum MessageKind { text, photo, voice, system }

enum ChangeStatus { awaitingReview, underReview, rejected, approved }

class ChatAttachment {
  ChatAttachment(this.name, this.mime, this.bytes, {this.seconds});
  final String name, mime;
  final Uint8List bytes;
  final int? seconds;
  void validate() {
    if (bytes.isEmpty || bytes.length > 10 * 1024 * 1024) {
      throw StateError('فایل باید بین ۱ بایت و ۱۰ مگابایت باشد.');
    }
    if (![
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/wav',
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
    ].contains(mime)) {
      throw StateError('این نوع فایل پشتیبانی نمی‌شود.');
    }
    if (seconds != null && (seconds! < 1 || seconds! > 120)) {
      throw StateError('ویس باید بین ۱ تا ۱۲۰ ثانیه باشد.');
    }
  }
}

class ConversationMessage {
  ConversationMessage({
    required this.id,
    required this.body,
    required this.mine,
    required this.createdAt,
    this.kind = MessageKind.text,
    this.state = MessageState.sent,
    this.attachment,
    this.mediaId,
  }) : clientRequestId = messageRequestId();
  final String clientRequestId;
  String? mediaId;
  String id;
  final String body;
  final bool mine;
  final DateTime createdAt;
  final MessageKind kind;
  MessageState state;
  ChatAttachment? attachment;
  double progress = 0;
  bool cancelled = false;
  bool legacySynced = false;
}

class PlanChange {
  PlanChange({
    required this.id,
    required this.planId,
    required this.reasons,
    required this.details,
    required this.createdAt,
  });
  final String id, planId, details;
  final List<String> reasons;
  final DateTime createdAt;
  ChangeStatus status = ChangeStatus.awaitingReview;
  bool awaitingCustomer = false;
  String clarification = '', rejection = '';
  final List<String> history = ['در انتظار بررسی'];
  String get label => switch (status) {
    ChangeStatus.awaitingReview => 'در انتظار بررسی',
    ChangeStatus.underReview => 'در حال بررسی توسط متخصص',
    ChangeStatus.rejected => 'رد شده',
    ChangeStatus.approved => 'تأیید شده',
  };
}

/// An intentionally isolated design adapter. No service delivery/read is inferred.
/// The live adapter is handled by CustomerAuth.api and exposes text only until
/// media and revision contracts are supplied by the backend.
class DemoMessaging extends ChangeNotifier {
  final Map<String, List<ConversationMessage>> _messages = {};
  final List<PlanChange> changes = [];
  List<String> reasons = [
    'غذاها را دوست ندارم',
    'تهیه غذا زمان‌بر است',
    'هزینه غذا بالاست',
    'مواد اولیه موجود نیست',
    'شرایطم تغییر کرده',
  ];
  bool failNextSend = false;
  int _sequence = 0;
  List<ConversationMessage> messages(String thread) =>
      List.unmodifiable(_messages[thread] ?? []);
  void seed(String thread, List<ConversationMessage> messages) {
    _messages.putIfAbsent(thread, () => messages);
  }

  Future<void> send(String thread, ConversationMessage message) async {
    message.attachment?.validate();
    if (message.kind == MessageKind.text &&
        (message.body.trim().isEmpty || message.body.length > 2000)) {
      throw StateError('پیام باید بین ۱ تا ۲۰۰۰ کاراکتر باشد.');
    }
    final list = _messages.putIfAbsent(thread, () => []);
    if (!list.contains(message)) list.add(message);
    message.state = MessageState.pending;
    message.cancelled = false;
    message.progress = 0;
    notifyListeners();
    // Local progress only: this is never represented as network upload progress.
    for (var i = 1; i <= 4; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 90));
      if (message.cancelled) return;
      message.progress = i / 4;
      notifyListeners();
    }
    if (failNextSend) {
      failNextSend = false;
      message.state = MessageState.failed;
    } else {
      message.state = MessageState.sent;
    }
    notifyListeners();
  }

  void cancel(ConversationMessage message) {
    message.cancelled = true;
    message.state = MessageState.failed;
    notifyListeners();
  }

  PlanChange submit(String planId, List<String> selected, String details) {
    if (selected.isEmpty || selected.any((s) => !reasons.contains(s))) {
      throw StateError('حداقل یک دلیل معتبر انتخاب کن.');
    }
    if (details.length > 2000) {
      throw StateError('توضیحات حداکثر ۲۰۰۰ کاراکتر است.');
    }
    if (changes.any(
      (c) =>
          c.planId == planId &&
          [
            ChangeStatus.awaitingReview,
            ChangeStatus.underReview,
          ].contains(c.status),
    )) {
      throw StateError('یک درخواست باز برای این برنامه داری.');
    }
    final result = PlanChange(
      id: 'local-${++_sequence}',
      planId: planId,
      reasons: List.unmodifiable(selected),
      details: details,
      createdAt: DateTime.now(),
    );
    changes.add(result);
    notifyListeners();
    return result;
  }

  void startReview(PlanChange change) {
    if (change.status != ChangeStatus.awaitingReview) {
      throw StateError('درخواست قبلاً بررسی شده است.');
    }
    change.status = ChangeStatus.underReview;
    change.history.add(change.label);
    notifyListeners();
  }

  void clarify(PlanChange change, String question) {
    if (change.status != ChangeStatus.underReview || question.trim().isEmpty) {
      throw StateError('بررسی را شروع و سؤال را وارد کن.');
    }
    change.awaitingCustomer = true;
    change.clarification = question.trim();
    change.history.add('در انتظار پاسخ کاربر: ${question.trim()}');
    notifyListeners();
  }

  void answer(PlanChange change, String answer) {
    if (!change.awaitingCustomer || answer.trim().isEmpty) {
      throw StateError('پاسخ را وارد کن.');
    }
    change.awaitingCustomer = false;
    change.history.add('پاسخ کاربر: ${answer.trim()}');
    notifyListeners();
  }

  void reject(PlanChange change, String explanation) {
    if (change.status != ChangeStatus.underReview ||
        explanation.trim().isEmpty) {
      throw StateError('بررسی را شروع و دلیل رد را وارد کن.');
    }
    change.rejection = explanation.trim();
    change.awaitingCustomer = false;
    change.status = ChangeStatus.rejected;
    change.history.add('${change.label}: ${change.rejection}');
    notifyListeners();
  }

  Future<void> publishReplacement(
    PlanChange change,
    Future<void> Function() publish,
  ) async {
    if (change.status != ChangeStatus.underReview || change.awaitingCustomer) {
      throw StateError(
        'پاسخ لازم هنوز دریافت نشده یا درخواست قابل تأیید نیست.',
      );
    }
    await publish();
    change.status = ChangeStatus.approved;
    change.history.add(change.label);
    _messages
        .putIfAbsent('user-main', () => [])
        .add(
          ConversationMessage(
            id: 'replacement-${change.id}',
            body: 'برنامه جدید در پنل شما قرار گرفت.',
            mine: false,
            createdAt: DateTime.now(),
            kind: MessageKind.system,
          ),
        );
    notifyListeners();
  }

  void reset() {
    _messages.clear();
    changes.clear();
    notifyListeners();
  }
}
