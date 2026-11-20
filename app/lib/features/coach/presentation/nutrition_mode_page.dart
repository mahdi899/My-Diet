import '../../../domain/common/number_format.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/photos/photos.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../../plan/goal_math.dart';
import '../../plan/meal_detail_page.dart';
import '../presentation/coach_controller.dart';
import '../data/coach_parse.dart';
import '../domain/coach_message.dart';

const _types = ['صبحانه', 'ناهار', 'میان‌وعده', 'شام'];

Future<void> openNutritionMode(
  BuildContext context, {
  required CoachController controller,
  required CoachMessage message,
}) {
  return Navigator.of(context, rootNavigator: true).push<void>(
    foodDetailRoute<void>(
      NutritionModePage(controller: controller, message: message),
      reduced: Motion.reduced(context),
    ),
  );
}

class _Portion {
  _Portion(this.base) : quantity = asDouble(base['quantity'], 1);
  final Map<String, dynamic> base;
  double quantity;
  bool included = true;

  double get _ratio {
    final start = asDouble(base['quantity'], 1);
    return start <= 0 ? 1 : quantity / start;
  }

  double get step {
    final unit = asString(base['unit'], 'g');
    if (unit == 'serving' || unit == 'piece' || base.containsKey('servings')) {
      return 0.5;
    }
    final start = asDouble(base['quantity'], 1);
    return start >= 200 ? 25 : 10;
  }

  Map<String, dynamic> toWire() {
    final ratio = _ratio;
    final slug = base['slug'];
    return {
      'name': asString(base['name'], 'ماده'),
      if (base['lineIndex'] is int) 'lineIndex': base['lineIndex'],
      if (slug is String && slug.trim().isNotEmpty) 'slug': slug.trim(),
      'servings': double.parse(quantity.toStringAsFixed(2)),
      'kcal': (asDouble(base['kcal'] ?? base['calories']) * ratio).round(),
      'proteinG': (asDouble(base['proteinG'] ?? base['protein_g']) * ratio)
          .round(),
      'carbsG': (asDouble(base['carbsG'] ?? base['carbs_g']) * ratio).round(),
      'fatG': (asDouble(base['fatG'] ?? base['fat_g']) * ratio).round(),
    };
  }

  int get calories => (asDouble(base['calories']) * _ratio).round();
  int get protein => (asDouble(base['protein_g']) * _ratio).round();
  int get carbs => (asDouble(base['carbs_g']) * _ratio).round();
  int get fat => (asDouble(base['fat_g']) * _ratio).round();
}

class NutritionModePage extends StatefulWidget {
  const NutritionModePage({
    super.key,
    required this.controller,
    required this.message,
  });

  final CoachController controller;
  final CoachMessage message;

  @override
  State<NutritionModePage> createState() => _NutritionModePageState();
}

class _NutritionModePageState extends State<NutritionModePage> {
  late final List<_Portion> _rows = [
    for (final item in asMapList(widget.message.payload['items']))
      _Portion(item),
  ];
  late String _meal = _types.contains(widget.message.payload['meal_type_fa'])
      ? widget.message.payload['meal_type_fa'] as String
      : 'ناهار';
  bool _busy = false;

  Iterable<_Portion> get _included => _rows.where((row) => row.included);
  int get _calories => _included.fold(0, (sum, row) => sum + row.calories);
  int get _protein => _included.fold(0, (sum, row) => sum + row.protein);
  int get _carbs => _included.fold(0, (sum, row) => sum + row.carbs);
  int get _fat => _included.fold(0, (sum, row) => sum + row.fat);

  Future<void> _save() async {
    if (_busy || _included.isEmpty) return;
    setState(() => _busy = true);
    Haptics.confirm();
    final payload = widget.message.payload;
    if (payload['status'] == 'logged') {
      if (!mounted) return;
      Navigator.of(context).pop();
      return;
    }
    final entryId = asString(payload['entryId']);
    final mealCode = coachMealCode(_meal);
    if (entryId.isNotEmpty && mealCode != null) {
      final planMeal = payload['planMealUid'];
      final failure = await widget.controller.confirmMeal(
        entryId: entryId,
        title: asString(payload['title']),
        mealType: mealCode,
        items: [for (final row in _included) row.toWire()],
        planMealUid: planMeal is String ? planMeal : null,
        sourceId: widget.message.id,
      );
      if (!mounted) return;
      if (failure != null) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(failure)));
        return;
      }
      Navigator.of(context).pop();
      return;
    }
    await widget.controller.sendAction(
      'confirm_meal',
      {
        'title': asString(payload['title']),
        'meal_name': _meal,
        'calories': _calories,
        'protein_g': _protein,
        'carbs_g': _carbs,
        'fat_g': _fat,
        if (payload['id'] != null) 'meal_id': payload['id'],
      },
      label: 'ثبت و اضافه کن',
      sourceId: widget.message.id,
    );
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  void _swap() {
    Navigator.of(context).pop();
    widget.controller.sendText('یه پیشنهاد دیگه بده');
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final day = nutritionOn(store, store.today);
    final goal = day.targetKcal <= 0 ? 1800 : day.targetKcal;
    final preview = (day.eatenKcal + _calories) / goal;
    final payload = widget.message.payload;
    final title = asString(payload['title'], 'بررسی وعده');
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  Row(
                    children: [
                      IconButton(
                        tooltip: 'بازگشت',
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.arrow_forward_rounded),
                      ),
                      const Expanded(
                        child: Text(
                          'بررسی وعده',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    ],
                  ),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                    child: widget.controller.photoFor(widget.message) == null
                        ? FoodImage(
                            title: asString(payload['photo_title'], title),
                            mealType: _meal,
                            height: 210,
                          )
                        : Image.memory(
                            widget.controller.photoFor(widget.message)!,
                            height: 210,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            cacheWidth:
                                (MediaQuery.sizeOf(context).width *
                                        MediaQuery.devicePixelRatioOf(context))
                                    .ceil()
                                    .clamp(64, 900),
                            gaplessPlayback: true,
                          ),
                  ),
                  const SizedBox(height: 14),
                  Text(title, style: Theme.of(context).textTheme.titleLarge),
                  if (payload['estimated'] == true) ...[
                    const SizedBox(height: 6),
                    const Text(
                      'مقدار و کالری از روی عکس تخمین زده شده است. سهمی را که خوردی بررسی کن.',
                    ),
                    for (final question
                        in (payload['questions'] as List?)
                                ?.whereType<String>() ??
                            const <String>[])
                      Text(question),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final type in _types)
                        ChoiceChip(
                          label: Text(type),
                          selected: _meal == type,
                          onSelected: (_) => setState(() => _meal = type),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  for (final row in _rows) ...[
                    if (payload['estimated'] == true &&
                        payload['status'] != 'logged')
                      CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: Text(asString(row.base['name'])),
                        subtitle: Text(
                          row.included
                              ? 'در این وعده خوردم'
                              : 'در ثبت این وعده حساب نمی‌شود',
                        ),
                        value: row.included,
                        onChanged: _busy
                            ? null
                            : (checked) => setState(
                                () => row.included = checked ?? false,
                              ),
                      ),
                    if (row.included)
                      _RowEditor(
                        row: row,
                        onChanged: (next) =>
                            setState(() => row.quantity = next),
                      ),
                    const SizedBox(height: 8),
                  ],
                  const SizedBox(height: 8),
                  AppCard(
                    child: Row(
                      children: [
                        Ring(
                          value: preview.clamp(0, 1),
                          size: 84,
                          strokeWidth: 8,
                          child: Text(
                            fa(_calories),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            payload['estimated'] == true
                                ? 'کالریِ تخمینی موارد انتخاب‌شده'
                                : 'پروتئین ${fa(_protein)} · کربو ${fa(_carbs)} · چربی ${fa(_fat)}',
                            style: const TextStyle(height: 1.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                children: [
                  PillButton(
                    label: 'ثبت و اضافه کن',
                    loading: _busy,
                    onPressed: _included.isEmpty ? null : _save,
                  ),
                  const SizedBox(height: 8),
                  PillButton(
                    label: 'پیشنهاد دیگه',
                    variant: PillVariant.outline,
                    onPressed: _busy ? null : _swap,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RowEditor extends StatelessWidget {
  const _RowEditor({required this.row, required this.onChanged});
  final _Portion row;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final unit = asString(row.base['unit'], 'واحد');
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              asString(row.base['name'], 'ماده'),
              style: const TextStyle(fontWeight: FontWeight.w700, height: 1.5),
            ),
          ),
          IconButton(
            onPressed: () =>
                onChanged((row.quantity - row.step).clamp(row.step, 5000)),
            icon: const Icon(Icons.remove_rounded),
          ),
          Text(persianNumber(row.quantity)),
          Text(' $unit', style: const TextStyle(color: AppColors.muted)),
          IconButton(
            onPressed: () =>
                onChanged((row.quantity + row.step).clamp(row.step, 5000)),
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
    );
  }
}
