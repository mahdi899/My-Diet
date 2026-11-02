import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../data/messaging.dart';
import '../theme.dart';
import '../widgets/ui.dart';

String chatTime(DateTime value) => fa(
  '${value.toLocal().hour.toString().padLeft(2, '0')}:${value.toLocal().minute.toString().padLeft(2, '0')}',
);

class LiveConversationsScreen extends StatefulWidget {
  const LiveConversationsScreen({super.key});
  @override
  State<LiveConversationsScreen> createState() =>
      _LiveConversationsScreenState();
}

class _LiveConversationsScreenState extends State<LiveConversationsScreen> {
  List<Map<String, dynamic>>? rows;
  String? error;
  bool loading = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (rows == null && !loading) load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await DemoScope.of(
        context,
      ).customerAuth!.api('conversations');
      if (mounted) {
        setState(() => rows = (result as List).cast<Map<String, dynamic>>());
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('پیام‌ها'),
      actions: [
        IconButton(
          onPressed: loading ? null : load,
          icon: const Icon(Icons.refresh),
          tooltip: 'تازه‌سازی',
        ),
      ],
    ),
    body: PageBody(
      children: [
        if (loading) const LinearProgressIndicator(),
        if (error != null) Notice(error!),
        if (rows?.isEmpty == true)
          const EmptyPanel(
            'گفتگویی نداری',
            'بعد از اختصاص متخصص، گفتگوی او اینجا نمایش داده می‌شود.',
          ),
        for (final row in rows ?? <Map<String, dynamic>>[])
          Surface(
            onTap: () => pushPage(
              context,
              MessagingScreen(
                threadId: row['id'],
                support: row['kind'] == 'support',
              ),
            ),
            child: ListTile(
              leading: const Icon(Icons.chat_bubble_outline, color: pine),
              title: Text(
                row['kind'] == 'support' ? 'پشتیبانی' : 'متخصص تغذیه',
              ),
              trailing: row['unreadCount'] is int && row['unreadCount'] > 0
                  ? Badge(label: Text(fa(row['unreadCount'])))
                  : const Icon(Icons.chevron_left),
            ),
          ),
        TextButton(
          onPressed: () => pushPage(
            context,
            const MessagingScreen(threadId: 'support-main', support: true),
          ),
          child: const Text('ارتباط با پشتیبانی'),
        ),
      ],
    ),
  );
}

class MessagingScreen extends StatefulWidget {
  const MessagingScreen({
    super.key,
    required this.threadId,
    this.support = false,
  });
  final String threadId;
  final bool support;
  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final input = TextEditingController(), scroll = ScrollController();
  AudioRecorder? recorder;
  final inputFocus = FocusNode();
  StreamSubscription<Uint8List>? recording;
  final chunks = BytesBuilder();
  Timer? timer;
  DemoStore? store;
  String? error, conversationId;
  List<ConversationMessage> liveMessages = [], outbox = [];
  ChatAttachment? attachment;
  bool loading = false, recordingNow = false, startingRecording = false, sending = false;
  bool? photo;
  int seconds = 0, visibleCount = 30, operation = 0;
  bool get live => store!.serverAuthEnabled;
  String get thread => conversationId ?? widget.threadId;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (store != null) return;
    store = DemoScope.of(context);
    store!.messaging.addListener(changed);
    if (live) {
      load();
    } else {
      store!.messaging.seed(
        thread,
        store!
            .threadMessages(thread)
            .map(
              (m) => ConversationMessage(
                id: 'seed-${identityHashCode(m)}',
                body: m.text,
                mine: m.sender == (store!.role ?? AppRole.user),
                createdAt: store!.today,
                state: MessageState.sent,
              ),
            )
            .toList(),
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          store!.markThreadRead(thread, store!.role ?? AppRole.user);
          store!.update();
        }
      });
    }
  }

  void changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    operation++;
    timer?.cancel();
    recording?.cancel();
    recorder?.dispose();
    inputFocus.dispose();
    input.dispose();
    scroll.dispose();
    store?.messaging.removeListener(changed);
    super.dispose();
  }

  Future<void> load() async {
    final expected = ++operation;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = store!.customerAuth!;
      if (conversationId == null) {
        if (widget.threadId == 'support-main') {
          conversationId = (await api.api(
            'me/support-conversation',
            method: 'POST',
            body: {},
          ))['id'];
        } else if (widget.threadId == 'user-main') {
          final rows = await api.api('conversations') as List;
          final matching = rows.where((r) => r['kind'] != 'support');
          if (matching.isEmpty) {
            throw StateError(
              'هنوز متخصصی به درخواست شما اختصاص داده نشده است.',
            );
          }
          conversationId = matching.first['id'];
        } else {
          conversationId = widget.threadId;
        }
      }
      final result =
          await api.api('conversations/$conversationId/messages') as List;
      String? actor;
      try {
        actor = jsonDecode(
          utf8.decode(
            base64Url.decode(
              base64Url.normalize(api.session!.accessToken.split('.')[1]),
            ),
          ),
        )['sub'];
      } catch (_) {}
      if (!mounted || expected != operation) return;
      setState(() {
        liveMessages = result
            .map(
              (r) => ConversationMessage(
                id: r['id'],
                body: r['body'] ?? '',
                mine: actor != null && r['authorId'] == actor,
                createdAt: DateTime.parse(r['createdAt']),
                state:
                    MessageState.values
                        .where((s) => s.name == r['status'])
                        .firstOrNull ??
                    MessageState.sent,
              ),
            )
            .toList();
        final ids = liveMessages.map((m) => m.id).toSet();
        outbox.removeWhere((m) => ids.contains(m.id));
      });
      await api.api(
        'conversations/$conversationId/read',
        method: 'POST',
        body: {},
      );
    } catch (e) {
      if (mounted && expected == operation) setState(() => error = '$e');
    } finally {
      if (mounted && expected == operation) setState(() => loading = false);
    }
  }

  Future<void> send([ConversationMessage? retry]) async {
    if (sending) return;
    if (live && conversationId == null) return;
    if (retry == null && attachment == null && input.text.trim().isEmpty) {
      return;
    }
    if (live && attachment != null) {
      setState(
        () => error =
            'ارسال رسانه به API رسانه نیاز دارد؛ فایل فقط پیش‌نمایش است.',
      );
      return;
    }
    final message =
        retry ??
        ConversationMessage(
          id: 'local-${DateTime.now().microsecondsSinceEpoch}',
          body: input.text.trim(),
          mine: true,
          createdAt: DateTime.now(),
          kind: attachment == null
              ? MessageKind.text
              : attachment!.mime.startsWith('image/')
              ? MessageKind.photo
              : MessageKind.voice,
          attachment: attachment,
          state: MessageState.pending,
        );
    if (message.body.length > 2000) {
      setState(() => error = 'پیام حداکثر ۲۰۰۰ کاراکتر است.');
      return;
    }
    sending = true;
    if (retry == null) {
      setState(() {
        attachment = null;
        error = null;
      });
    }
    try {
      if (live) {
        setState(() {
          if (!outbox.contains(message)) outbox.add(message);
          message.state = MessageState.pending;
        });
        try {
          final data = await store!.customerAuth!.api(
            'conversations/$conversationId/messages',
            method: 'POST',
            body: {'body': message.body},
          );
          if (!mounted) return;
          setState(() {
            message.id = data['id'];
            message.state = MessageState.sent;
          });
        } catch (e) {
          if (mounted) {
            setState(() {
              message.state = MessageState.failed;
              error =
                  '$e — ممکن است پیام در سرور ثبت شده باشد؛ پیش از تلاش مجدد تازه‌سازی کن.';
            });
          }
        }
      } else {
        try {
          await store!.messaging.send(thread, message);
          if (!mounted || !store!.userSignedIn) return;
          if (message.state == MessageState.sent &&
              !message.legacySynced &&
              message.body.isNotEmpty) {
            message.legacySynced = true;
            store!.send(message.body, threadId: thread);
            if (thread == 'user-main') {
              for (final change in store!.messaging.changes.where(
                (c) => c.awaitingCustomer,
              )) {
                store!.messaging.answer(change, message.body);
              }
            }
          }
        } catch (e) {
          if (mounted) setState(() => error = '$e');
        }
      }
      if (retry == null && message.state == MessageState.sent) input.clear();
      if (mounted && scroll.hasClients) {
        await scroll.animateTo(
          scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      }
    } finally {
      sending = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> pick() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        withData: true,
      );
      if (result == null || !mounted) return;
      final f = result.files.single;
      if (f.size > 10 * 1024 * 1024 || f.bytes == null) {
        throw StateError('حداکثر اندازه عکس ۱۰ مگابایت است.');
      }
      final media = ChatAttachment(
        f.name,
        f.extension == 'png'
            ? 'image/png'
            : f.extension == 'webp'
            ? 'image/webp'
            : 'image/jpeg',
        f.bytes!,
      );
      media.validate();
      setState(() {
        attachment = media;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = 'انتخاب عکس انجام نشد: $e');
    }
  }

  Future<void> startRecord() async {
    if (startingRecording || recordingNow) return;
    setState(() => startingRecording = true);
    try {
      if (!await (recorder ??= AudioRecorder()).hasPermission()) {
        throw StateError('اجازه میکروفن داده نشده؛ از تنظیمات دستگاه فعال کن.');
      }
      if (!mounted) return;
      chunks.clear();
      seconds = 0;
      final stream = await recorder!.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );
      if (!mounted) {
        await recorder!.stop();
        return;
      }
      recording = stream.listen(
        chunks.add,
        onError: (Object e) {
          stopRecord(cancel: true);
          if (mounted) setState(() => error = 'ضبط متوقف شد: $e');
        },
      );
      setState(() {
        recordingNow = true;
        error = null;
      });
      timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => seconds++);
        if (seconds >= 120) stopRecord();
      });
    } catch (e) {
      if (mounted) setState(() => error = 'ضبط ویس انجام نشد: $e');
    } finally {
      if (mounted) setState(() => startingRecording = false);
    }
  }

  Future<void> stopRecord({bool cancel = false}) async {
    timer?.cancel();
    try {
      await recorder?.stop();
      await recording?.cancel();
      recording = null;
      final data = chunks.takeBytes();
      if (!mounted) return;
      setState(() {
        recordingNow = false;
        if (!cancel && data.isNotEmpty) {
          attachment = ChatAttachment(
            'voice.wav',
            'audio/wav',
            pcmWave(data),
            seconds: (data.length / 32000).ceil().clamp(1, 120),
          );
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          recordingNow = false;
          error = 'توقف ضبط انجام نشد: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = store!;
    final items = live
        ? [...liveMessages, ...outbox]
        : s.messaging.messages(thread);
    final shown = items
        .skip((items.length - visibleCount).clamp(0, items.length))
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.support || thread.startsWith('support')
              ? 'پشتیبانی سبزینه'
              : 'گفتگو با متخصص',
        ),
        actions: [
          if (live)
            IconButton(
              onPressed: loading ? null : load,
              tooltip: 'تازه‌سازی پیام‌ها',
              icon: const Icon(Icons.refresh),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              live
                  ? 'پیام‌ها با تازه‌سازی دریافت می‌شوند'
                  : 'نسخه نمایشی • پیام‌ها به کسی ارسال نمی‌شوند',
              style: const TextStyle(color: muted, fontSize: 11),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          if (loading) const LinearProgressIndicator(),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          if (!widget.support && !thread.startsWith('support'))
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                onPressed: () => showPlanChange(context),
                icon: const Icon(Icons.edit_note),
                label: const Text('درخواست تغییر برنامه غذایی'),
              ),
            ),
          Expanded(
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.all(16),
              children: [
                if (items.length > visibleCount)
                  TextButton(
                    onPressed: () => setState(() => visibleCount += 30),
                    child: const Text('پیام‌های قبلی'),
                  ),
                if (items.isEmpty && !loading)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'گفتگو را با یک پیام شروع کن.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                for (final message in shown) messageBubble(message),
                if (!live && !widget.support && thread == 'user-main')
                  for (final change in s.messaging.changes)
                    PlanChangeCard(
                      change: change,
                      onReply: () => inputFocus.requestFocus(),
                    ),
              ],
            ),
          ),
          if (recordingNow)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.mic, color: Colors.red),
                Text(' در حال ضبط ${fa(seconds)} ثانیه'),
                TextButton(
                  onPressed: () => stopRecord(),
                  child: const Text('توقف و پیش‌نمایش'),
                ),
                IconButton(
                  tooltip: 'لغو ضبط',
                  onPressed: () => stopRecord(cancel: true),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          if (attachment != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: attachment!.mime.startsWith('image/')
                        ? SizedBox(
                            height: 100,
                            child: Image.memory(
                              attachment!.bytes,
                              errorBuilder: (_, _, _) =>
                                  const Text('عکس قابل خواندن نیست'),
                            ),
                          )
                        : VoicePlayer(attachment: attachment!),
                  ),
                  IconButton(
                    tooltip: 'حذف پیوست',
                    onPressed: () => setState(() => attachment = null),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
          SafeArea(
            top: false,
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.all(10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'انتخاب عکس',
                    onPressed: recordingNow ? null : pick,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                  ),
                  IconButton(
                    tooltip: 'ضبط ویس',
                    onPressed: recordingNow || startingRecording
                        ? null
                        : startRecord,
                    icon: const Icon(Icons.mic_none),
                  ),
                  Expanded(
                    child: TextField(
                      key: const ValueKey('chat-input'),
                      controller: input,
                      focusNode: inputFocus,
                      minLines: 1,
                      maxLines: 4,
                      enabled: !recordingNow,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => send(),
                      decoration: const InputDecoration(
                        hintText: 'پیامت را بنویس…',
                      ),
                    ),
                  ),
                  IconButton.filled(
                    tooltip: 'ارسال پیام',
                    onPressed:
                        sending ||
                            recordingNow ||
                            (live &&
                                (conversationId == null || attachment != null))
                        ? null
                        : send,
                    icon: const Icon(Icons.send_outlined),
                  ),
                ],
              ),
            ),
          ),
          if (live && attachment != null)
            const Padding(
              padding: EdgeInsets.all(8),
              child: Text(
                'پیش‌نمایش رسانه آماده است؛ ارسال با اتصال API رسانه فعال می‌شود.',
                style: TextStyle(fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }

  Widget messageBubble(ConversationMessage m) => Align(
    alignment: m.mine
        ? AlignmentDirectional.centerEnd
        : AlignmentDirectional.centerStart,
    child: Container(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * .82,
      ),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: m.mine ? sage : Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (m.kind == MessageKind.photo && m.attachment != null)
            InkWell(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => Scaffold(
                    appBar: AppBar(title: const Text('عکس')),
                    body: Center(
                      child: InteractiveViewer(
                        minScale: .5,
                        maxScale: 5,
                        child: Image.memory(m.attachment!.bytes),
                      ),
                    ),
                  ),
                ),
              ),
              child: Image.memory(
                m.attachment!.bytes,
                height: 160,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Text('عکس قابل نمایش نیست'),
              ),
            ),
          if (m.kind == MessageKind.voice && m.attachment != null)
            VoicePlayer(attachment: m.attachment!),
          if (m.body.isNotEmpty) SelectableText(m.body),
          const SizedBox(height: 6),
          Text(
            '${chatTime(m.createdAt)}${m.mine ? ' · ${switch (m.state) {
                    MessageState.pending => live ? 'در حال ارسال' : 'ثبت در نمونه',
                    MessageState.sent => live ? 'ارسال‌شده' : 'ثبت‌شده در نمونه',
                    MessageState.delivered => 'تحویل‌شده',
                    MessageState.read => 'خوانده‌شده',
                    MessageState.failed => m.cancelled ? 'لغوشده' : 'ارسال ناموفق',
                  }}' : ''}',
            style: const TextStyle(fontSize: 10, color: muted),
          ),
          if (m.state == MessageState.pending && m.attachment != null) ...[
            LinearProgressIndicator(value: m.progress),
            TextButton(
              onPressed: () => store!.messaging.cancel(m),
              child: const Text('لغو ثبت نمونه'),
            ),
          ],
          if (m.state == MessageState.failed)
            TextButton(
              onPressed: () => send(m),
              child: const Text('تلاش مجدد'),
            ),
        ],
      ),
    ),
  );
}

Uint8List pcmWave(Uint8List data) {
  final header = ByteData(44);
  void text(int offset, String s) {
    for (var i = 0; i < s.length; i++) {
      header.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  text(0, 'RIFF');
  header.setUint32(4, data.length + 36, Endian.little);
  text(8, 'WAVE');
  text(12, 'fmt ');
  header.setUint32(16, 16, Endian.little);
  header.setUint16(20, 1, Endian.little);
  header.setUint16(22, 1, Endian.little);
  header.setUint32(24, 16000, Endian.little);
  header.setUint32(28, 32000, Endian.little);
  header.setUint16(32, 2, Endian.little);
  header.setUint16(34, 16, Endian.little);
  text(36, 'data');
  header.setUint32(40, data.length, Endian.little);
  return (BytesBuilder()
        ..add(header.buffer.asUint8List())
        ..add(data))
      .takeBytes();
}

class VoicePlayer extends StatefulWidget {
  const VoicePlayer({super.key, required this.attachment});
  final ChatAttachment attachment;
  @override
  State<VoicePlayer> createState() => _VoicePlayerState();
}

class _VoicePlayerState extends State<VoicePlayer> {
  final player = AudioPlayer();
  StreamSubscription<void>? completed;
  bool playing = false;
  String? error;
  @override
  void initState() {
    super.initState();
    completed = player.onPlayerComplete.listen((_) {
      if (mounted) setState(() => playing = false);
    });
  }

  @override
  void dispose() {
    completed?.cancel();
    player.dispose();
    super.dispose();
  }

  Future<void> toggle() async {
    try {
      if (playing) {
        await player.pause();
      } else {
        await player.play(
          BytesSource(
            widget.attachment.bytes,
            mimeType: widget.attachment.mime,
          ),
        );
      }
      if (mounted) {
        setState(() {
          playing = !playing;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'پخش ویس ممکن نیست.');
    }
  }

  @override
  Widget build(BuildContext context) => Wrap(
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      IconButton(
        tooltip: playing ? 'توقف پخش' : 'پخش ویس',
        onPressed: toggle,
        icon: Icon(playing ? Icons.pause : Icons.play_arrow),
      ),
      Text('ویس · ${fa(widget.attachment.seconds ?? 0)} ثانیه'),
      if (error != null) Text(error!),
    ],
  );
}

class PlanChangeCard extends StatelessWidget {
  const PlanChangeCard({
    super.key,
    required this.change,
    required this.onReply,
  });
  final PlanChange change;
  final VoidCallback onReply;
  @override
  Widget build(BuildContext context) => Surface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'درخواست تغییر برنامه',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        Text(
          '${change.id} · ${persianDate(change.createdAt)} ${chatTime(change.createdAt)}',
          style: const TextStyle(fontSize: 10, color: muted),
        ),
        Tag(change.label),
        Text(
          change.reasons.join('، '),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        if (change.details.isNotEmpty) Text(change.details),
        if (change.rejection.isNotEmpty) Text('دلیل رد: ${change.rejection}'),
        if (change.awaitingCustomer) ...[
          Text('در انتظار پاسخ شما: ${change.clarification}'),
          TextButton(onPressed: onReply, child: const Text('پاسخ به متخصص')),
        ],
        ExpansionTile(
          title: const Text('جزئیات و تاریخچه'),
          children: [
            Text('برنامه ${change.planId}'),
            for (final entry in change.history) ListTile(title: Text(entry)),
          ],
        ),
      ],
    ),
  );
}

Future<void> showPlanChange(BuildContext context) async {
  final store = DemoScope.of(context);
  Map<String, dynamic>? livePlan;
  if (store.serverAuthEnabled) {
    try {
      livePlan =
          await store.customerAuth!.api('me/plan') as Map<String, dynamic>?;
      if (!context.mounted) return;
      if (livePlan == null) {
        showToast(context, 'هنوز برنامه تأییدشده نداری.');
        return;
      }
    } catch (e) {
      if (context.mounted) showToast(context, '$e');
      return;
    }
  } else if (!store.hasUserRequest || !store.userRequest.isPublished) {
    showToast(context, 'ابتدا باید برنامه تأییدشده داشته باشی.');
    return;
  }
  final details = TextEditingController(), selected = <String>{};
  String? error;
  final route = ModalBottomSheetRoute<void>(
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => StatefulBuilder(
      builder: (sheet, update) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            MediaQuery.viewInsetsOf(sheet).bottom + 16,
          ),
          child: SizedBox(
            height: MediaQuery.sizeOf(sheet).height * .78,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'درخواست تغییر برنامه غذایی',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                Text(
                  store.serverAuthEnabled
                      ? 'برنامه فعلی از سرور دریافت شده؛ ثبت اصلاح به API درخواست تغییر و دلایل مدیر نیاز دارد.'
                      : 'نسخه نمایشی • برنامه فعلی تا انتشار برنامه جدید فعال می‌ماند.',
                  style: TextStyle(color: muted, fontSize: 11),
                ),
                Expanded(
                  child: ListView(
                    children: [
                      ExpansionTile(
                        title: const Text('مشاهده برنامه فعلی • ۷ روز'),
                        children: [
                          for (
                            var day = 0;
                            day <
                                (livePlan == null
                                    ? 7
                                    : (livePlan['days'] as List).length);
                            day++
                          )
                            ExpansionTile(
                              title: Text(
                                [
                                  'شنبه',
                                  'یکشنبه',
                                  'دوشنبه',
                                  'سه‌شنبه',
                                  'چهارشنبه',
                                  'پنجشنبه',
                                  'جمعه',
                                ][day],
                              ),
                              children: [
                                if (livePlan != null)
                                  for (final meal
                                      in (livePlan['days'][day]['meals']
                                          as List))
                                    ListTile(
                                      title: Text(meal['title'] ?? ''),
                                      subtitle: Text(
                                        (meal['items'] as List)
                                            .map(
                                              (i) =>
                                                  "${i['name']} ${i['quantity'] ?? ''} ${i['unit'] ?? ''}",
                                            )
                                            .join('، '),
                                      ),
                                    ),
                                if (livePlan == null)
                                  for (final meal
                                      in store.userRequest.mealsForDay(day))
                                    ListTile(
                                      title: Text(
                                        '${meal.name} • ${meal.title}',
                                      ),
                                      subtitle: Text(meal.amount),
                                    ),
                              ],
                            ),
                        ],
                      ),
                      ExpansionTile(
                        title: Text(
                          selected.isEmpty
                              ? 'انتخاب دلیل تغییر'
                              : '${fa(selected.length)} دلیل انتخاب شد',
                        ),
                        initiallyExpanded: true,
                        children: [
                          if (store.serverAuthEnabled)
                            const ListTile(
                              title: Text(
                                'گزینه‌های دلیل هنوز از سرور ارائه نشده‌اند.',
                              ),
                            ),
                          for (final reason
                              in store.serverAuthEnabled
                                  ? <String>[]
                                  : store.messaging.reasons)
                            CheckboxListTile(
                              value: selected.contains(reason),
                              title: Text(reason),
                              onChanged: (value) => update(() {
                                value == true
                                    ? selected.add(reason)
                                    : selected.remove(reason);
                              }),
                            ),
                        ],
                      ),
                      TextField(
                        controller: details,
                        maxLines: 3,
                        maxLength: 2000,
                        decoration: const InputDecoration(
                          labelText: 'توضیحات اضافی (اختیاری)',
                        ),
                      ),
                      if (error != null)
                        Text(error!, style: const TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
                PrimaryButton(
                  'ارسال درخواست',
                  onPressed: store.serverAuthEnabled
                      ? null
                      : () {
                          try {
                            store.messaging.submit(
                              store.userRequest.id,
                              selected.toList(),
                              details.text.trim(),
                            );
                            store.requestRevision(
                              selected.join('، '),
                              details.text.trim(),
                            );
                            Navigator.pop(sheet);
                          } catch (e) {
                            update(() => error = '$e');
                          }
                        },
                ),
                TextButton(
                  onPressed: () => Navigator.pop(sheet),
                  child: const Text('انصراف'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  await Navigator.of(context).push<void>(route);
  await route.completed;
  details.dispose();
}
