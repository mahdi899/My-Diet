import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/photos/photos.dart';
import '../../core/theme/tokens.dart';
import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../coach/coach_launcher.dart';
import 'consume_sheet.dart';
import 'goal_math.dart';

class MealDetailPage extends StatefulWidget {
  const MealDetailPage({super.key, required this.date, required this.index});

  final DateTime date;
  final int index;

  @override
  State<MealDetailPage> createState() => _MealDetailPageState();
}

class _MealDetailPageState extends State<MealDetailPage> {
  String? _choice;
  String? _reason;
  final _note = TextEditingController();
  String? _error;
  bool _busy = false;
  int _burst = 0;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  String _selected(DemoStore store) =>
      _choice ?? store.selectedOptionOn(widget.date, widget.index);

  Future<void> _precise() async {
    final saved = await showConsumeSheet(context, widget.date, widget.index);
    if (saved && mounted) {
      Haptics.success();
      setState(() => _burst++);
    }
  }

  Future<void> _substitute(DemoStore store) async {
    if (_busy || store.savingSubstitution) return;
    final choice = _selected(store);
    final current = store.selectedOptionOn(widget.date, widget.index);
    if (choice == current || !store.canSubstituteOn(widget.date)) return;
    final today = dateKey(widget.date) == dateKey(store.today);
    if (today && (_reason == null || _reason!.isEmpty)) {
      setState(() => _error = 'دلیل را انتخاب کن');
      return;
    }
    final eaten = store.mealEaten(widget.date, widget.index);
    if (eaten) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('قبلاً ثبت شده'),
          content: const Text('فقط برنامه عوض می‌شود. مصرف قبلی می‌ماند.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: const Text('عوض کن'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final changed = await store.substituteMeal(
        widget.date,
        widget.index,
        choice,
        _reason ?? '',
        explanation: _note.text,
        confirmConsumed: eaten,
      );
      if (!mounted) return;
      if (!changed) {
        setState(() => _error = 'این همان انتخاب فعلی است');
      } else {
        setState(() => _choice = choice);
      }
    } on StateError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'ذخیره نشد. دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meals = store.hasUserRequest
        ? store.mealsOn(widget.date)
        : const <Meal>[];
    if (widget.index < 0 || widget.index >= meals.length) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('این وعده در برنامه نیست')),
      );
    }
    final meal = meals[widget.index];
    final eaten = store.mealEaten(widget.date, widget.index);
    final logging = canLogMeal(store, widget.date);
    final recorded = store.mealRecordOn(widget.date, widget.index) != null || eaten;
    final macros = macrosFor(meal.calories, meal.name);
    final original = store.originalMealOn(widget.date, widget.index);
    final alternatives = store.alternativesOn(widget.date, widget.index);
    final current = store.selectedOptionOn(widget.date, widget.index);
    final choice = _selected(store);
    final options = <String, Meal>{
      'original': original,
      for (final alternative in alternatives)
        alternative.id: alternative.meal.copyWith(
          name: original.name,
          time: original.time,
        ),
    };
    final steps = recipeSteps(meal.instructions);
    final tag = mealHeroTag(widget.date, widget.index);
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: AppColors.emeraldDark,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Hero(
                    tag: tag,
                    child: FoodImage(
                      title: meal.title,
                      mealType: meal.name,
                      ingredients: [
                        for (final item in meal.ingredients) item.name,
                      ],
                      fit: BoxFit.cover,
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: AppGradients.photoScrim,
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.center,
                        colors: [Color(0x66000000), Color(0x00000000)],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Text(
                  meal.title,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  meal.time.isEmpty ? meal.name : '${meal.name} · ${meal.time}',
                  style: const TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _MacroStat('کالری', meal.calories, AppColors.amber),
                    _MacroStat('پروتئین', macros.protein, AppColors.sky),
                    _MacroStat('کربو', macros.carbs, AppColors.lime),
                    _MacroStat('چربی', macros.fat, AppColors.coral),
                  ],
                ),
                if (meal.preparationMinutes != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    'حدود ${fa(meal.preparationMinutes!)} دقیقه',
                    style: const TextStyle(
                      color: AppColors.emeraldDeep,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
                if (meal.amount.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  AppCard.tinted(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'مقدار',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Text(meal.amount),
                      ],
                    ),
                  ),
                ],
                if (meal.ingredients.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text('مواد', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  for (final item in meal.ingredients)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(ingredientLine(item)),
                    ),
                ],
                if (steps.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('روش', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  for (var i = 0; i < steps.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: AppColors.mint,
                            child: Text(
                              fa(i + 1),
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.emeraldDark,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(steps[i])),
                        ],
                      ),
                    ),
                ],
                const SizedBox(height: 8),
                Text('جایگزین', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (alternatives.isEmpty)
                  const Text(
                    'جایگزین تأییدشده‌ای نیست',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                for (final option in options.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      color: choice == option.key
                          ? AppColors.mint
                          : AppColors.surface,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      onTap: _busy
                          ? null
                          : () => setState(() {
                              _choice = option.key;
                              _error = null;
                            }),
                      child: Row(
                        children: [
                          Icon(
                            choice == option.key
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  option.value.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  option.key == 'original'
                                      ? 'اصلی${current == option.key ? ' · فعلی' : ''}'
                                      : 'جایگزین${current == option.key ? ' · فعلی' : ''}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (option.value.calories > 0)
                            Text(
                              fa(option.value.calories),
                              style: const TextStyle(
                                color: AppColors.emeraldDeep,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                if (choice != current &&
                    store.canSubstituteOn(widget.date)) ...[
                  if (dateKey(widget.date) == dateKey(store.today)) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final reason in store.substitutionReasons.entries)
                          ChoiceChip(
                            label: Text(reason.value),
                            selected: _reason == reason.key,
                            selectedColor: AppColors.mint,
                            onSelected: _busy
                                ? null
                                : (_) => setState(() => _reason = reason.key),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  TextField(
                    controller: _note,
                    maxLength: 500,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'توضیح'),
                  ),
                  const SizedBox(height: 8),
                  PillButton(
                    label: _busy ? 'در حال ذخیره' : 'تأیید جایگزینی',
                    loading: _busy,
                    onPressed: _busy ? null : () => _substitute(store),
                  ),
                ],
                if (!store.canSubstituteOn(widget.date))
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'روز گذشته عوض نمی‌شود',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ),
                const SizedBox(height: 8),
                PillButton(
                  label: 'تعویض با مربی',
                  icon: Icons.swap_horiz_rounded,
                  variant: PillVariant.soft,
                  onPressed: () =>
                      openCoach(context, prefill: swapPrefill(meal)),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 12,
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SparkleBurst(
                trigger: _burst,
                child: PillButton(
                  label: recorded ? 'ثبت شد' : 'انجام شد',
                  icon: Icons.check_rounded,
                  loading: store.savingMeal,
                  onPressed: logging && !recorded ? _precise : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MacroStat extends StatelessWidget {
  const _MacroStat(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value > 0 ? fa(value) : '—',
          style: TextStyle(
            color: color == AppColors.lime ? AppColors.emeraldDark : color,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 11),
        ),
      ],
    ),
  );
}
