import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../core/theme/tokens.dart';

class CoachPhotoSelection {
  const CoachPhotoSelection(this.path, this.bytes);
  final String path;
  final Uint8List bytes;
}

class CoachPhotoPreview extends StatefulWidget {
  const CoachPhotoPreview({
    super.key,
    required this.selection,
    required this.replace,
  });
  final CoachPhotoSelection selection;
  final Future<CoachPhotoSelection?> Function() replace;
  @override
  State<CoachPhotoPreview> createState() => _CoachPhotoPreviewState();
}

class _CoachPhotoPreviewState extends State<CoachPhotoPreview> {
  late CoachPhotoSelection _selection = widget.selection;
  final _caption = TextEditingController();
  String _meal = 'lunch';
  String _portion = 'همه';
  bool _picking = false;
  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(
      title: const Text('عکس وعده'),
      backgroundColor: AppColors.bg,
    ),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.memory(
              _selection.bytes,
              height: 260,
              fit: BoxFit.cover,
              semanticLabel: 'پیش‌نمایش عکس انتخاب‌شده',
            ),
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              onPressed: _picking
                  ? null
                  : () async {
                      setState(() => _picking = true);
                      try {
                        final next = await widget.replace();
                        if (mounted && next != null) {
                          setState(() => _selection = next);
                        }
                      } catch (_) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'عکس جدید باز نشد؛ عکس قبلی هنوز انتخاب شده.',
                              ),
                            ),
                          );
                        }
                      } finally {
                        if (mounted) setState(() => _picking = false);
                      }
                    },
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('تغییر عکس'),
            ),
          ),
          DropdownButtonFormField<String>(
            initialValue: _meal,
            decoration: const InputDecoration(labelText: 'وعده'),
            items: const [
              DropdownMenuItem(value: 'breakfast', child: Text('صبحانه')),
              DropdownMenuItem(value: 'lunch', child: Text('ناهار')),
              DropdownMenuItem(value: 'dinner', child: Text('شام')),
              DropdownMenuItem(value: 'snack', child: Text('میان‌وعده')),
            ],
            onChanged: (v) => setState(() => _meal = v!),
          ),
          const SizedBox(height: 20),
          const Text(
            'چه مقدار از غذای عکس رو خوردی؟',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final portion in ['همه', 'نصف', 'یک‌چهارم', 'هنوز نخوردم'])
                ChoiceChip(
                  label: Text(portion),
                  selected: portion == _portion,
                  onSelected: (_) => setState(() => _portion = portion),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _caption,
            maxLines: 3,
            maxLength: 240,
            decoration: const InputDecoration(
              labelText: 'توضیح غذا',
              hintText: 'مثلاً برنج با مرغ، بدون روغن اضافه',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'بعد از بررسی، مقدار و غذای تشخیص‌داده‌شده رو تأیید می‌کنی؛ هنوز چیزی ثبت نمی‌شه.',
            style: TextStyle(color: AppColors.inkSoft, height: 1.8),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            key: const ValueKey('coach-confirm-photo'),
            onPressed: _picking
                ? null
                : () => Navigator.pop(context, {
                    'selection': _selection,
                    'meal': _meal,
                    'caption':
                        'مقدار مصرف از غذای عکس: $_portion. ${_caption.text.trim()}',
                  }),
            icon: const Icon(Icons.send_rounded),
            label: const Text('ارسال برای بررسی'),
          ),
        ],
      ),
    ),
  );
}
