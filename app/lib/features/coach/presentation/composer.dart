import '../../../core/icons/diet_icon.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../home/weight_sheet.dart';
import '../../plan/goal_math.dart';
import '../presentation/coach_controller.dart';
import '../data/coach_parse.dart';
import 'photo_preview.dart';

class CoachComposer extends StatefulWidget {
  const CoachComposer({
    super.key,
    required this.controller,
    this.prefill,
    this.onTodayPlan,
  });

  final CoachController controller;
  final String? prefill;
  final VoidCallback? onTodayPlan;

  @override
  State<CoachComposer> createState() => _CoachComposerState();
}

class _CoachComposerState extends State<CoachComposer> {
  late final TextEditingController _text = TextEditingController(
    text: widget.prefill ?? '',
  );
  String? _draftThread;
  bool _edited = false;
  bool _restoring = false;
  Future<void> _draftWrite = Future<void>.value();
  Map<String, dynamic>? _lastReply;

  @override
  void initState() {
    super.initState();
    _draftThread = widget.controller.draftConversationId;
    _text.addListener(() {
      if (_restoring) return;
      _edited = true;
      _saveDraft();
      if (mounted) setState(() {});
    });
    _restoreDraft();
  }

  Future<void> _restoreDraft() async {
    final thread = _draftThread;
    final saved = await widget.controller.notebook.draft(thread);
    if (!mounted ||
        _edited ||
        thread != _draftThread ||
        widget.prefill?.isNotEmpty == true) {
      return;
    }
    _restoring = true;
    _text.text = asString(saved['text']);
    _restoring = false;
    final reply = saved['reply'];
    if (reply is Map) widget.controller.setReply(parseCoachMessage(reply));
    setState(() {});
  }

  void _saveDraft() {
    final thread = _draftThread;
    final text = _text.text;
    final reply = widget.controller.replyTo?.toJson();
    _draftWrite = widget.controller.notebook
        .saveDraft(thread, text, reply)
        .catchError((_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'ذخیره پیش‌نویس انجام نشد. متن رو قبل از خروج کپی کن.',
                ),
              ),
            );
          }
        });
  }

  @override
  void didUpdateWidget(covariant CoachComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    final current = widget.controller.draftConversationId;
    if (_draftThread == null && current != null) {
      final old = _draftThread;
      _draftThread = current;
      if (!_edited) {
        _restoreDraft();
      } else {
        _draftWrite = _draftWrite.then(
          (_) => widget.controller.notebook.saveDraft(old, '', null),
        );
        _saveDraft();
      }
    }
    final reply = widget.controller.replyTo?.toJson();
    if (reply?['id'] != _lastReply?['id']) {
      _lastReply = reply;
      _saveDraft();
    }
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  bool get _hasText => _text.text.trim().isNotEmpty;

  void _send() {
    final value = _text.text.trim();
    if (value.isEmpty || widget.controller.busy) return;
    final sending = widget.controller.sendText(value);
    _text.clear();
    sending.catchError((_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ارسال انجام نشد؛ دوباره تلاش کن.')),
        );
      }
    });
  }

  Future<void> _plus() async {
    final action = await showModalBottomSheet<_Attach>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (context) => const _AttachSheet(),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case _Attach.camera:
        await _pick(ImageSource.camera);
      case _Attach.gallery:
        await _pick(ImageSource.gallery);
      case _Attach.weight:
        await _weight();
      case _Attach.water:
        widget.controller.sendAction('log_water', const {
          'glasses': 1,
        }, label: 'یه لیوان آب');
      case _Attach.mood:
        await _mood();
    }
  }

  Future<void> _pick(ImageSource source) async {
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        imageQuality: 62,
        maxWidth: 1280,
        maxHeight: 1280,
      );
      if (file == null || !mounted) return;
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      final result = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(
          builder: (_) => CoachPhotoPreview(
            selection: CoachPhotoSelection(file.path, bytes),
            replace: () async {
              final next = await ImagePicker().pickImage(
                source: ImageSource.gallery,
                imageQuality: 62,
                maxWidth: 1280,
                maxHeight: 1280,
              );
              return next == null
                  ? null
                  : CoachPhotoSelection(next.path, await next.readAsBytes());
            },
          ),
        ),
      );
      if (!mounted || result == null) return;
      final selected = result['selection'] as CoachPhotoSelection;
      await widget.controller.sendPhoto(
        selected.path,
        selected.bytes,
        caption: result['caption'] as String,
        mealType: result['meal'] as String,
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('عکس باز نشد. دوباره تلاش کن.')),
      );
    }
  }

  Future<void> _weight() async {
    final store = DemoScope.of(context);
    final before = store.latestWeight;
    await showWeightSheet(context);
    if (!mounted) return;
    final after = DemoScope.of(context).latestWeight;
    if (after == before) return;
    if (DemoScope.of(context).serverAuthEnabled) {
      widget.controller.sendAction('log_weight', {
        'kilograms': after,
      }, label: 'ثبت وزن');
      return;
    }
    widget.controller.sendText('وزن امروز را ${kilos(after)} ثبت کردم');
  }

  Future<void> _mood() async {
    final mood = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (context) => const _MoodSheet(),
    );
    if (!mounted || mood == null) return;
    widget.controller.sendAction('mood', {
      'mood': mood,
    }, label: 'حال امروز: $mood');
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final suggestions = controller.suggestions.toSet().toList();
    final starter =
        !controller.messages.any((m) => m.isUser) &&
        controller.messages.every(
          (m) => const {
            'text',
            'day_brief',
            'plan_meal',
            'quick_replies',
          }.contains(m.type),
        );
    final quickIndex = controller.messages.lastIndexWhere(
      (m) => m.type == 'quick_replies',
    );
    final userIndex = controller.messages.lastIndexWhere((m) => m.isUser);
    final inlinePrompt =
        quickIndex > userIndex &&
        !controller.answered.contains(controller.messages[quickIndex].id);
    final showChips =
        !_hasText &&
        !controller.busy &&
        !inlinePrompt &&
        (starter || suggestions.isNotEmpty);
    final canSend = _hasText && !controller.busy;
    final chipStyle = OutlinedButton.styleFrom(
      foregroundColor: AppColors.emeraldDark,
      backgroundColor: AppColors.surfaceWarm,
      side: const BorderSide(color: AppColors.line),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      minimumSize: const Size(48, 40),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontFamily: 'Vazirmatn', fontSize: 12),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (controller.replyTo != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsetsDirectional.only(start: 12),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Icon(Icons.reply_rounded, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      controller.replyTo!.text,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, height: 1.8),
                    ),
                  ),
                  IconButton(
                    tooltip: 'لغو پاسخ به پیام',
                    onPressed: () => controller.setReply(null),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
          if (showChips)
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: starter
                    ? [
                        OutlinedButton.icon(
                          key: const ValueKey('coach-quick-water'),
                          style: chipStyle,
                          onPressed: () => controller.sendAction(
                            'log_water',
                            const {'glasses': 1},
                            label: 'ثبت آب',
                          ),
                          icon: const DietIcon(DietIconKind.water, size: 21),
                          label: const Text('ثبت آب'),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          key: const ValueKey('coach-quick-weight'),
                          style: chipStyle,
                          onPressed: _weight,
                          icon: const Icon(
                            Icons.monitor_weight_outlined,
                            size: 17,
                          ),
                          label: const Text('ثبت وزن'),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          key: const ValueKey('coach-quick-plan'),
                          style: chipStyle,
                          onPressed:
                              widget.onTodayPlan ??
                              () => controller.sendText('برنامهٔ امروز'),
                          icon: const DietIcon(DietIconKind.plan, size: 21),
                          label: const Text('برنامهٔ امروز'),
                        ),
                      ]
                    : [
                        for (final label in suggestions)
                          Padding(
                            padding: const EdgeInsetsDirectional.only(end: 8),
                            child: OutlinedButton(
                              style: chipStyle,
                              onPressed: () => controller.sendText(label),
                              child: Text(label),
                            ),
                          ),
                      ],
              ),
            ),
          const SizedBox(height: 9),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  key: const ValueKey('coach-input'),
                  controller: _text,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.ink,
                    height: 1.7,
                  ),
                  decoration: InputDecoration(
                    hintText: 'از مربی بپرس…',
                    hintStyle: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                    ),
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 13,
                    ),
                    prefixIcon: Padding(
                      padding: const EdgeInsets.all(4),
                      child: IconButton(
                        key: const ValueKey('composer-plus'),
                        tooltip: 'افزودن عکس یا ثبت',
                        onPressed: controller.busy ? null : _plus,
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.mint,
                          foregroundColor: AppColors.emeraldDark,
                        ),
                        icon: const Icon(Icons.add_rounded, size: 24),
                      ),
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(30),
                      borderSide: const BorderSide(
                        color: AppColors.emeraldDeep,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                key: const ValueKey('coach-send'),
                tooltip: controller.busy || controller.typing
                    ? 'توقف نمایش پاسخ'
                    : 'ارسال پیام',
                onPressed: controller.busy || controller.typing
                    ? controller.stopResponse
                    : canSend
                    ? _send
                    : null,
                style: IconButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  backgroundColor: AppColors.emeraldDeep,
                  disabledBackgroundColor: AppColors.mint,
                  foregroundColor: Colors.white,
                  disabledForegroundColor: AppColors.muted,
                ),
                icon: Icon(
                  controller.busy || controller.typing
                      ? Icons.stop_rounded
                      : Icons.send_rounded,
                  size: 22,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _Attach { camera, gallery, weight, water, mood }

class _AttachSheet extends StatelessWidget {
  const _AttachSheet();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'چی اضافه کنیم؟',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _tile(context, 'دوربین', Icons.photo_camera_rounded, _Attach.camera),
          _tile(context, 'گالری', Icons.photo_library_rounded, _Attach.gallery),
          _tile(context, 'وزن', Icons.monitor_weight_outlined, _Attach.weight),
          _tile(context, 'آب', Icons.water_drop_outlined, _Attach.water),
          _tile(context, 'حال امروز', Icons.mood_rounded, _Attach.mood),
        ],
      ),
    );
  }

  Widget _tile(
    BuildContext context,
    String label,
    IconData icon,
    _Attach value,
  ) {
    return ListTile(
      leading: Icon(icon, color: AppColors.emeraldDeep),
      title: Text(label),
      onTap: () => Navigator.pop(context, value),
    );
  }
}

class _MoodSheet extends StatelessWidget {
  const _MoodSheet();

  @override
  Widget build(BuildContext context) {
    const moods = ['عالی', 'خوب', 'معمولی', 'خسته'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Wrap(
        spacing: 8,
        children: [
          for (final mood in moods)
            ActionChip(
              label: Text(mood),
              onPressed: () => Navigator.pop(context, mood),
            ),
        ],
      ),
    );
  }
}
