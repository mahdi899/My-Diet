import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/day.dart';
import '../../core/theme/theme.dart';
import 'ui.dart';

class MealRecipeDetails extends StatelessWidget {
  const MealRecipeDetails(this.meal, {super.key});
  final Meal meal;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(meal.title, style: Theme.of(context).textTheme.titleLarge),
      Text('${meal.name} · ${meal.time}', style: const TextStyle(color: muted)),
      const SizedBox(height: 12),
      Text(
        meal.calories > 0
            ? '${fa(meal.calories)} کیلوکالری برای سهم درج‌شده'
            : 'کالری ثبت نشده',
      ),
      Text(
        meal.preparationMinutes == null
            ? 'زمان آماده‌سازی ثبت نشده'
            : 'آماده‌سازی حدود ${fa(meal.preparationMinutes!)} دقیقه',
      ),
      const SizedBox(height: 12),
      const Text(
        'سهم و مقدار مصرف',
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      Text(
        meal.amount.isEmpty ? 'مقدار ثبت نشده' : meal.amount,
        style: const TextStyle(height: 1.9),
      ),
      const SizedBox(height: 12),
      const Text('مواد اولیه', style: TextStyle(fontWeight: FontWeight.bold)),
      if (meal.ingredients.isEmpty) const Text('مواد اولیه ثبت نشده'),
      for (final ingredient in meal.ingredients)
        Text(
          '• ${ingredient.name}: ${ingredient.quantity == null ? "مقدار ثبت نشده" : fa(ingredient.quantity! % 1 == 0 ? ingredient.quantity!.toInt() : ingredient.quantity!)} ${ingredient.unit}',
        ),
      const SizedBox(height: 12),
      Text(
        meal.quantityBasis.isEmpty
            ? 'مبنای وزن خام یا پخته ثبت نشده'
            : meal.quantityBasis,
      ),
      const SizedBox(height: 12),
      const Text(
        'روش آماده‌سازی',
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      Text(
        meal.instructions.isEmpty
            ? 'روش آماده‌سازی ثبت نشده'
            : meal.instructions,
        style: const TextStyle(height: 1.9),
      ),
    ],
  );
}

class MealDislikeButton extends StatelessWidget {
  const MealDislikeButton({
    super.key,
    required this.date,
    required this.index,
  });
  final DateTime date;
  final int index;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.alternativesOn(date, index).isEmpty) {
      return const SizedBox.shrink();
    }
    return TextButton(
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
      onPressed: () => showMealOptions(context, date, index),
      child: const Text(
        'وعده رو دوست نداری؟',
        style: TextStyle(fontSize: 10, color: pine),
      ),
    );
  }
}

Future<void> showMealOptions(
  BuildContext context,
  DateTime date,
  int index, {
  String? initialOption,
}) async {
  final store = DemoScope.of(context);
  if (index >= store.originalMealsOn(date).length) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: cream,
    builder: (_) => _MealOptions(
      store: store,
      date: date,
      index: index,
      initialOption: initialOption,
    ),
  );
}

class _MealOptions extends StatefulWidget {
  const _MealOptions({
    required this.store,
    required this.date,
    required this.index,
    this.initialOption,
  });
  final DemoStore store;
  final DateTime date;
  final int index;
  final String? initialOption;
  @override
  State<_MealOptions> createState() => _MealOptionsState();
}

class _MealOptionsState extends State<_MealOptions> {
  late String choice =
      widget.initialOption ??
      widget.store.selectedOptionOn(widget.date, widget.index);
  String? reason, error;
  bool busy = false;
  final explanation = TextEditingController();
  @override
  void dispose() {
    explanation.dispose();
    super.dispose();
  }

  Future<void> save() async {
    final s = widget.store, date = widget.date, index = widget.index;
    if (busy || s.savingSubstitution) return;
    final currentDay = dateKey(date) == dateKey(s.today);
    if (currentDay && reason == null) {
      setState(() => error = 'دلیل جایگزینی را انتخاب کن.');
      return;
    }
    final consumed = s.mealEaten(date, index);
    if (consumed) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('این وعده قبلاً مصرف شده'),
          content: const Text(
            'فقط انتخاب برنامه تغییر می‌کند. غذای مصرف‌شده و کالری قبلی حفظ می‌شود و دوباره ثبت نخواهد شد.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: const Text('تغییر انتخاب'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final changed = await s.substituteMeal(
        date,
        index,
        choice,
        reason ?? '',
        explanation: explanation.text,
        confirmConsumed: consumed,
      );
      if (!mounted) return;
      if (changed) {
        showToast(
          context,
          s.serverAuthEnabled
              ? 'انتخاب ذخیره شد؛ لیست خرید هم به‌روز شد.'
              : 'انتخاب در نسخهٔ نمایشی ذخیره شد؛ مواد خرید هم به‌روز شد.',
        );
        Navigator.pop(context);
      } else {
        setState(
          () =>
              error = 'این گزینه قبلاً انتخاب شده یا ذخیره دیگری در جریان است.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'ذخیره انجام نشد؛ انتخاب قبلی حفظ شد. دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.store,
    builder: (context, _) {
      final s = widget.store, date = widget.date, index = widget.index;
      final original = s.originalMealOn(date, index);
      final alternatives = s.alternativesOn(date, index);
      final all = <String, Meal>{
        'original': original,
        for (final a in alternatives)
          a.id: a.meal.copyWith(name: original.name, time: original.time),
      };
      final current = s.selectedOptionOn(date, index);
      final selected = all[choice] ?? original;
      final consumed = s.consumedMealOn(date, index);
      final history = s.substitutionHistory
          .where((r) => r.key == s.selectionKey(date, index))
          .toList();
      return SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .9,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              0,
              20,
              MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'انتخاب ${original.name}',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      tooltip: 'بستن',
                      onPressed: busy ? null : () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'برنامه و تأییدها در این نسخه نمونهٔ طراحی هستند.',
                          style: TextStyle(color: muted, fontSize: 11),
                        ),
                        const SizedBox(height: 8),
                        for (final option in all.entries)
                          Card(
                            color: choice == option.key ? sage : Colors.white,
                            child: ListTile(
                              leading: Icon(
                                choice == option.key
                                    ? Icons.radio_button_checked
                                    : Icons.radio_button_off,
                                color: pine,
                              ),
                              title: Text(option.value.title),
                              subtitle: Text(
                                option.key == 'original'
                                    ? 'وعدهٔ تأییدشده${current == option.key ? " · انتخاب فعلی" : ""}'
                                    : 'جایگزین تأییدشده${current == option.key ? " · انتخاب فعلی" : ""}',
                              ),
                              onTap: busy
                                  ? null
                                  : () => setState(() {
                                      choice = option.key;
                                      error = null;
                                    }),
                            ),
                          ),
                        if (alternatives.isEmpty)
                          const Notice(
                            'جایگزین تأییدشده‌ای برای این وعده ثبت نشده است.',
                          ),
                        const SizedBox(height: 12),
                        Surface(child: MealRecipeDetails(selected)),
                        if (consumed != null) ...[
                          const SizedBox(height: 12),
                          Notice(
                            'مصرف ثبت‌شده: ${consumed["title"]}\n${consumed["amount"]}\n${consumed["calories"] == null ? "کالری محاسبه نشده" : fa(consumed["calories"])} کیلوکالری؛ تغییر انتخاب این سابقه را تغییر نمی‌دهد.',
                          ),
                        ],
                        if (current != choice && s.canSubstituteOn(date)) ...[
                          const SizedBox(height: 16),
                          if (dateKey(date) == dateKey(s.today))
                            DropdownButtonFormField<String>(
                              key: const ValueKey('substitution-reason'),
                              initialValue: reason,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'دلیل جایگزینی',
                              ),
                              items: [
                                for (final item
                                    in s.substitutionReasons.entries)
                                  DropdownMenuItem(
                                    value: item.key,
                                    child: Text(item.value),
                                  ),
                              ],
                              onChanged: busy
                                  ? null
                                  : (v) => setState(() => reason = v),
                            ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: explanation,
                            maxLength: 500,
                            maxLines: 2,
                            decoration: const InputDecoration(
                              labelText: 'توضیحات اختیاری',
                            ),
                            enabled: !busy,
                          ),
                        ],
                        if (!s.canSubstituteOn(date))
                          const Notice('روزهای گذشته قابل تغییر نیستند.'),
                        if (history.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          const Text(
                            'سابقهٔ تغییرات',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          for (final record in history.reversed)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(record.foodTitle),
                              subtitle: Text(
                                '${persianDate(record.at)} · ${record.reasonLabel.isEmpty ? "انتخاب پیش از روز مصرف" : record.reasonLabel}\n${record.explanation}',
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                if (error != null)
                  Text(error!, style: const TextStyle(color: Colors.red)),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: PrimaryButton(
                    busy
                        ? 'در حال ذخیره…'
                        : current == choice
                        ? 'انتخاب فعلی'
                        : 'تأیید جایگزینی',
                    onPressed:
                        busy ||
                            s.savingMeal ||
                            !s.canSubstituteOn(date) ||
                            current == choice
                        ? null
                        : save,
                    icon: Icons.check_circle_outline,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
