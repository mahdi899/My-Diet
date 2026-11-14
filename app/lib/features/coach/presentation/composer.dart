import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../home/weight_sheet.dart';
import '../../plan/goal_math.dart';
import '../presentation/coach_controller.dart';

class CoachComposer extends StatefulWidget {
  const CoachComposer({super.key, required this.controller, this.prefill});

  final CoachController controller;
  final String? prefill;

  @override
  State<CoachComposer> createState() => _CoachComposerState();
}

class _CoachComposerState extends State<CoachComposer> {
  late final TextEditingController _text = TextEditingController(
    text: widget.prefill ?? '',
  );

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
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
    _text.clear();
    widget.controller.sendText(value);
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
      await widget.controller.sendPhoto(file.path, bytes);
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
    final suggestions = widget.controller.suggestions;
    final showChips =
        !_hasText && suggestions.isNotEmpty && !widget.controller.busy;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showChips)
            SizedBox(
              height: 42,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: suggestions.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final label = suggestions[index];
                  return ActionChip(
                    label: Text(label),
                    onPressed: () => widget.controller.sendText(label),
                  );
                },
              ),
            ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              PressableScale(
                semanticLabel: 'افزودن',
                onTap: _plus,
                child: Container(
                  key: const ValueKey('composer-plus'),
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.mint,
                  ),
                  child: const Icon(
                    Icons.add_rounded,
                    color: AppColors.emeraldDeep,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  key: const ValueKey('coach-input'),
                  controller: _text,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                  decoration: InputDecoration(
                    hintText: 'برای مربی بنویس…',
                    filled: true,
                    fillColor: AppColors.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              PressableScale(
                semanticLabel: 'ارسال',
                onTap: _hasText && !widget.controller.busy ? _send : null,
                child: Container(
                  key: const ValueKey('coach-send'),
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: _hasText ? AppGradients.cta : null,
                    color: _hasText ? null : AppColors.line,
                  ),
                  child: const Icon(
                    Icons.send_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
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
