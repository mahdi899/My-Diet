import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../data/share_text.dart';
import '../theme.dart';
import '../widgets/ui.dart';

String shoppingListText(DemoStore store, List<DateTime> dates) {
  final data = store.shoppingList(dates: dates);
  final lines = <String>[
    'لیست خرید رژیم من',
    dates.map(persianDate).join(' | '),
    'مقدارها مطابق برنامه و انتخاب‌های فعلی هستند.',
  ];
  String? category;
  for (final row in data.rows) {
    final ingredient = row.ingredient;
    if (category != ingredient.category) {
      category = ingredient.category;
      lines.add('\n$category');
    }
    final mark = store.shoppingMark(row);
    final covered = mark != null && mark.quantity + 1e-9 >= row.quantity;
    final status = covered
        ? (mark.status == 'have' ? 'موجود دارم' : 'خریدم')
        : mark == null
        ? 'تهیه شود'
        : 'بخشی تهیه شده؛ نیاز به بررسی مقدار جدید';
    lines.add(
      '• ${ingredient.name}: ${fa(shoppingQuantity(row.quantity))} ${ingredient.unit}${ingredient.basis.isEmpty ? "" : " (${ingredient.basis})"} — $status',
    );
  }
  if (data.rows.isEmpty) lines.add('ماده‌ای با مقدار کامل ثبت نشده است.');
  for (final missing in data.missing) {
    lines.add('⚠ ${missing.meal}: ${missing.description}');
  }
  return lines.join('\n');
}

class ShoppingScreen extends StatefulWidget {
  const ShoppingScreen({super.key});
  @override
  State<ShoppingScreen> createState() => _ShoppingScreenState();
}

class _ShoppingScreenState extends State<ShoppingScreen> {
  final selectedDays = <int>{0, 1, 2, 3, 4, 5, 6};
  bool sharing = false;
  String? error;
  List<DateTime> dates(DemoStore store) {
    final start = store.userRequest.programWeek!;
    return (selectedDays.toList()..sort())
        .map((i) => DateTime(start.year, start.month, start.day + i))
        .toList();
  }

  Future<void> mark(
    DemoStore store,
    ShoppingIngredient row,
    String? status,
  ) async {
    setState(() => error = null);
    try {
      await store.setShoppingMark(row, status);
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'ذخیره انجام نشد؛ تیک قبلی حفظ شد. دوباره تلاش کن.',
        );
      }
    }
  }

  Future<void> share(DemoStore store, {bool copy = false}) async {
    if (sharing) return;
    final text = shoppingListText(store, dates(store));
    setState(() {
      sharing = true;
      error = null;
    });
    try {
      final opened = !copy && await shareShoppingText(text);
      if (!opened) await Clipboard.setData(ClipboardData(text: text));
      if (mounted) {
        showToast(
          context,
          opened
              ? 'پنجرهٔ اشتراک‌گذاری باز شد.'
              : 'لیست کپی شد؛ می‌توانی آن را در پیام‌رسان بچسبانی.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'اشتراک‌گذاری تکمیل نشد یا لغو شد. می‌توانی از کپی لیست استفاده کنی.',
        );
      }
    } finally {
      if (mounted) setState(() => sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (!store.hasActiveShoppingPlan) {
      return Scaffold(
        appBar: AppBar(title: const Text('لیست خرید')),
        body: const PageBody(
          children: [
            EmptyPanel(
              'لیست خرید فعالی نداری',
              'پس از آماده‌شدن برنامهٔ تأییدشدهٔ همین هفته، مواد لازم اینجا نمایش داده می‌شوند.',
              icon: Icons.shopping_basket_outlined,
            ),
          ],
        ),
      );
    }
    final selectedDates = dates(store),
        data = store.shoppingList(dates: selectedDates);
    final categories = data.rows.map((r) => r.ingredient.category).toSet();
    final busy =
        store.savingShopping || store.savingMeal || store.savingSubstitution;
    return Scaffold(
      appBar: AppBar(title: const Text('لیست خرید هفته')),
      body: PageBody(
        children: [
          Surface(
            color: sage,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  persianDate(store.userRequest.programWeek!),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'مواد لازم مطابق غذاهای انتخاب‌شده؛ بدون تبدیل واحدها',
                ),
                const SizedBox(height: 8),
                const Text(
                  'نسخهٔ نمایشی؛ تیک‌ها روی همین دستگاه ذخیره می‌شوند.',
                  style: TextStyle(color: muted, fontSize: 11),
                ),
              ],
            ),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              FilterChip(
                label: const Text('کل هفته'),
                selected: selectedDays.length == 7,
                onSelected: (_) => setState(() {
                  selectedDays
                    ..clear()
                    ..addAll({0, 1, 2, 3, 4, 5, 6});
                }),
              ),
              for (var i = 0; i < 7; i++)
                FilterChip(
                  key: ValueKey('shopping-day-$i'),
                  label: Text(persianWeekDays[i]),
                  selected: selectedDays.contains(i),
                  onSelected: (on) => setState(() {
                    if (on) {
                      selectedDays.add(i);
                    } else {
                      selectedDays.remove(i);
                    }
                  }),
                ),
            ],
          ),
          if (selectedDays.isEmpty) const Notice('حداقل یک روز را انتخاب کن.'),
          if (store.shoppingChanges.isNotEmpty)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'لیست هفته با جایگزینی غذا تغییر کرد',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const Text(
                    'تیک مواد مشترک حفظ شده؛ اگر مقدار لازم بیشتر شده باشد، دوباره مقدار را بررسی کن.',
                  ),
                  for (final change in store.shoppingChanges)
                    Text(
                      '${change["name"]}: ${fa(shoppingQuantity((change["previous"] as num).toDouble()))} ← ${fa(shoppingQuantity((change["next"] as num).toDouble()))} ${change["unit"]}',
                    ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () async {
                            try {
                              await store.acknowledgeShoppingChanges();
                            } catch (_) {
                              if (mounted) {
                                setState(
                                  () => error =
                                      'ثبت مشاهدهٔ تغییرات انجام نشد؛ دوباره تلاش کن.',
                                );
                              }
                            }
                          },
                    child: const Text('متوجه شدم'),
                  ),
                ],
              ),
            ),
          if (error != null)
            Text(
              error!,
              style: const TextStyle(color: Colors.red),
              semanticsLabel: error,
            ),
          if (store.savingShopping)
            const LinearProgressIndicator(
              semanticsLabel: 'در حال ذخیره تیک خرید',
            ),
          if (selectedDays.isNotEmpty && data.rows.isEmpty)
            const Notice(
              'برای روزهای انتخاب‌شده ماده‌ای با مقدار کامل ثبت نشده است.',
            ),
          for (final category in categories) ...[
            Heading(category),
            for (final row in data.rows.where(
              (r) => r.ingredient.category == category,
            ))
              _IngredientCard(
                row: row,
                mark: store.shoppingMark(row),
                busy: busy,
                onChanged: (status) => mark(store, row, status),
              ),
          ],
          if (data.missing.isNotEmpty)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'اطلاعات ناقص؛ مقدار حدس زده نشده',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  for (final missing in data.missing)
                    Text('${missing.meal}: ${missing.description}'),
                ],
              ),
            ),
          Wrap(
            spacing: 10,
            children: [
              FilledButton.icon(
                onPressed: sharing || selectedDays.isEmpty
                    ? null
                    : () => share(store),
                icon: const Icon(Icons.share_outlined),
                label: Text(
                  sharing ? 'در حال آماده‌سازی…' : 'اشتراک‌گذاری لیست',
                ),
              ),
              OutlinedButton.icon(
                onPressed: sharing || selectedDays.isEmpty
                    ? null
                    : () => share(store, copy: true),
                icon: const Icon(Icons.copy_outlined),
                label: const Text('کپی لیست'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IngredientCard extends StatelessWidget {
  const _IngredientCard({
    required this.row,
    required this.mark,
    required this.busy,
    required this.onChanged,
  });
  final ShoppingIngredient row;
  final ShoppingMark? mark;
  final bool busy;
  final ValueChanged<String?> onChanged;
  @override
  Widget build(BuildContext context) {
    final covered = mark != null && mark!.quantity + 1e-9 >= row.quantity;
    return Surface(
      padding: 12,
      color: covered ? sage : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            row.ingredient.name,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          Text('${fa(shoppingQuantity(row.quantity))} ${row.ingredient.unit}'),
          if (row.ingredient.basis.isNotEmpty)
            Text(
              row.ingredient.basis,
              style: const TextStyle(color: muted, fontSize: 11),
            ),
          if (mark != null && !covered)
            Text(
              '${fa(shoppingQuantity(mark!.quantity))} ${row.ingredient.unit} قبلاً ${mark!.status == "have" ? "موجود داشتی" : "خریدی"}؛ مقدار جدید را بررسی کن.',
            ),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in const {
                'have': 'موجود دارم',
                'purchased': 'خریدم',
              }.entries)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Checkbox(
                      key: ValueKey(
                        'shopping-${shoppingRowKey(row.ingredient)}-${entry.key}',
                      ),
                      semanticLabel: '${entry.value}: ${row.ingredient.name}',
                      value: covered && mark?.status == entry.key,
                      onChanged: busy
                          ? null
                          : (v) => onChanged(v == true ? entry.key : null),
                    ),
                    Text(entry.value),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
