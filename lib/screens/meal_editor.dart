import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

class MealEditorScreen extends StatefulWidget {
  const MealEditorScreen({super.key, required this.meal, this.editing = false});
  final Meal meal;
  final bool editing;
  @override
  State<MealEditorScreen> createState() => _MealEditorScreenState();
}

class _Portion {
  _Portion(String value) {
    final i = value.indexOf(':');
    name.text = i < 0 ? value : value.substring(0, i).trim();
    quantity.text = i < 0 ? '' : value.substring(i + 1).trim();
  }
  final name = TextEditingController(), quantity = TextEditingController();
  void dispose() {
    name.dispose();
    quantity.dispose();
  }
}

class _MealEditorScreenState extends State<MealEditorScreen> {
  final form = GlobalKey<FormState>();
  late final TextEditingController title, time, calories, details;
  late String slot;
  late final List<_Portion> portions;
  final retired = <_Portion>[];
  @override
  void initState() {
    super.initState();
    final m = widget.meal;
    slot = m.name;
    title = TextEditingController(text: m.title);
    time = TextEditingController(text: m.time);
    calories = TextEditingController(
      text: m.calories > 0 ? '${m.calories}' : '',
    );
    details = TextEditingController(text: m.details);
    portions = m.amount.trim().isEmpty
        ? [_Portion('')]
        : m.amount
              .split('\n')
              .where((s) => s.trim().isNotEmpty)
              .map(_Portion.new)
              .toList();
  }

  @override
  void dispose() {
    for (final c in [title, time, calories, details]) {
      c.dispose();
    }
    for (final p in [...portions, ...retired]) {
      p.dispose();
    }
    super.dispose();
  }

  String? requiredText(String? v) =>
      (v ?? '').trim().isEmpty ? 'این قسمت را تکمیل کن.' : null;
  void save() {
    if (!form.currentState!.validate()) return;
    Navigator.pop(
      context,
      widget.meal.copyWith(
        name: slot,
        title: title.text.trim(),
        time: time.text.trim(),
        calories: int.parse(latinDigits(calories.text)),
        details: details.text.trim(),
        amount: portions
            .map((p) => '${p.name.text.trim()}: ${p.quantity.text.trim()}')
            .join('\n'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.editing ? 'ویرایش وعده' : 'افزودن وعده')),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton(
          widget.editing ? 'ذخیرهٔ ویرایش' : 'افزودن به برنامه',
          onPressed: save,
          icon: Icons.check,
        ),
      ),
    ),
    body: Form(
      key: form,
      child: PageBody(
        spacing: 12,
        children: [
          const Heading('مشخصات وعده'),
          DropdownButtonFormField<String>(
            initialValue: slot,
            decoration: const InputDecoration(labelText: 'نوع وعده'),
            items: {
              slot,
              'صبحانه',
              'ناهار',
              'میان‌وعده',
              'شام',
              'وعدهٔ دیگر',
            }.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => slot = v ?? slot,
          ),
          TextFormField(
            controller: title,
            decoration: const InputDecoration(labelText: 'نام غذا'),
            validator: requiredText,
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextFormField(
                  controller: time,
                  decoration: const InputDecoration(
                    labelText: 'ساعت وعده',
                    hintText: '۱۹:۳۰',
                  ),
                  validator: requiredText,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: calories,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'انرژی / کیلوکالری',
                  ),
                  validator: (v) {
                    final n = int.tryParse(latinDigits(v ?? ''));
                    return n == null || n <= 0 ? 'عدد مثبت وارد کن.' : null;
                  },
                ),
              ),
            ],
          ),
          const Heading('آیتم‌ها و مقدار مصرف'),
          for (final p in portions)
            Surface(
              radius: 14,
              key: ObjectKey(p),
              padding: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'آیتم ${fa(portions.indexOf(p) + 1)}',
                          style: const TextStyle(
                            color: pine,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'حذف آیتم',
                        onPressed: portions.length > 1
                            ? () => setState(() {
                                portions.remove(p);
                                retired.add(p);
                              })
                            : null,
                        icon: const Icon(Icons.close, size: 18),
                      ),
                    ],
                  ),
                  TextFormField(
                    controller: p.name,
                    decoration: const InputDecoration(
                      labelText: 'نام آیتم',
                      hintText: 'مثلاً برنج پخته',
                    ),
                    validator: requiredText,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: p.quantity,
                    decoration: const InputDecoration(
                      labelText: 'مقدار مصرف',
                      hintText: 'مثلاً ۱۵۰ گرم یا ۱ پیمانه',
                    ),
                    validator: requiredText,
                  ),
                ],
              ),
            ),
          OutlinedButton.icon(
            onPressed: () => setState(() => portions.add(_Portion(''))),
            icon: const Icon(Icons.add),
            label: const Text('افزودن آیتم'),
          ),
          TextFormField(
            controller: details,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'توضیحات و روش مصرف'),
          ),
        ],
      ),
    ),
  );
}
