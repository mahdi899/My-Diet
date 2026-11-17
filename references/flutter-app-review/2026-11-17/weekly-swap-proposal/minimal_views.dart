// Revision 2: review-only; retain real meal cards and navigation.
import 'package:flutter/material.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/plan/plan_meals.dart';
import 'package:sabzine_flutter/features/shell/shell_bar.dart';

const _green = Color(0xFF0A5C42);
const _muted = Color(0xFF7F8D85);
const _line = Color(0xFFE7EDE8);

Text _label(
  String value, {
  double size = 13,
  Color color = _green,
  bool bold = false,
}) => Text(
  value,
  style: TextStyle(
    fontSize: size,
    color: color,
    height: 1.6,
    fontWeight: bold ? FontWeight.bold : FontWeight.normal,
  ),
);

Widget _photo(Meal meal, double height) => SizedBox(
  width: double.infinity,
  height: height,
  child: FoodImage(
    title: meal.title,
    mealType: meal.name,
    ingredients: [for (final i in meal.ingredients) i.name],
    fit: BoxFit.cover,
  ),
);

class MinimalWeek extends StatelessWidget {
  const MinimalWeek({super.key, required this.date});
  final DateTime date;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.white,
    bottomNavigationBar: Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: ShellTabBar(
        selected: 2,
        onCoach: () {},
        onHome: () {},
        onPlan: () {},
      ),
    ),
    body: SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: _label('برنامهٔ من', size: 25, bold: true)),
              _label('دوشنبه، ۱۸ آبان', size: 12, color: _muted),
            ],
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: Column(
                    children: [
                      _label(
                        ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][i],
                        size: 11,
                        color: _muted,
                      ),
                      const SizedBox(height: 6),
                      Container(
                        width: 36,
                        height: 38,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: i == 2 ? _green : Colors.transparent,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: _label(
                          ['۱۶', '۱۷', '۱۸', '۱۹', '۲۰', '۲۱', '۲۲'][i],
                          size: 17,
                          bold: true,
                          color: i == 2
                              ? Colors.white
                              : i < 2
                              ? const Color(0xFFBBC3BD)
                              : _green,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(height: 1, color: _line),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _label('وعده‌های امروز', size: 15, bold: true)),
              _label('۴ وعده', size: 11, color: _muted),
            ],
          ),
          const SizedBox(height: 14),
          PlanMealCard(date: date, index: 0),
          const SizedBox(height: 20),
          PlanMealCard(date: date, index: 1),
          const SizedBox(height: 20),
          PlanMealCard(date: date, index: 2),
        ],
      ),
    ),
  );
}

class MinimalSwap extends StatelessWidget {
  const MinimalSwap({
    super.key,
    required this.current,
    required this.alternative,
  });
  final Meal current, alternative;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(
      children: [
        Positioned.fill(child: _photo(current, 844)),
        const Positioned.fill(child: ColoredBox(color: Color(0x77000000))),
        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            height: 590,
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 34,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCE3DE),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 17),
                Row(
                  children: [
                    Expanded(
                      child: _label('جایگزین این وعده', size: 21, bold: true),
                    ),
                    const Icon(Icons.close_rounded, size: 20, color: _muted),
                  ],
                ),
                const SizedBox(height: 6),
                _label(
                  'فعلی: ماهی و سبزی‌پلو · ۶۴۰ کالری',
                  size: 12,
                  color: _muted,
                ),
                const SizedBox(height: 22),
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: _photo(alternative, 154),
                ),
                const SizedBox(height: 13),
                Row(
                  children: [
                    Expanded(
                      child: _label(alternative.title, size: 18, bold: true),
                    ),
                    _label('۶۶۰ کالری', size: 12, color: _muted),
                  ],
                ),
                Row(
                  children: [
                    Expanded(
                      child: _label(
                        '۲۰ کالری بیشتر از وعدهٔ فعلی',
                        size: 11,
                        color: _muted,
                      ),
                    ),
                    TextButton(
                      onPressed: () => showModalBottomSheet<void>(
                        context: context,
                        backgroundColor: Colors.white,
                        builder: (_) => Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _label('مقدار و مقایسه', size: 20, bold: true),
                              const SizedBox(height: 16),
                              _label(current.title, bold: true),
                              _label(current.amount, color: _muted, size: 12),
                              const Divider(height: 28, color: _line),
                              _label(alternative.title, bold: true),
                              _label(
                                alternative.amount,
                                color: _muted,
                                size: 12,
                              ),
                            ],
                          ),
                        ),
                      ),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 36),
                      ),
                      child: const Text(
                        'مقدار و مقایسه ›',
                        style: TextStyle(fontSize: 11, color: _green),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 13),
                  decoration: BoxDecoration(
                    border: Border.all(color: _line),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: 'dislike',
                      isExpanded: true,
                      icon: const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 19,
                        color: _muted,
                      ),
                      items: [
                        DropdownMenuItem(
                          value: 'dislike',
                          child: _label('دلیل تعویض: دوست ندارم', size: 12),
                        ),
                        DropdownMenuItem(
                          value: 'missing',
                          child: _label('مواد اولیه ندارم', size: 12),
                        ),
                      ],
                      onChanged: (_) {},
                    ),
                  ),
                ),
                const Spacer(),
                SizedBox(
                  height: 50,
                  child: FilledButton(
                    onPressed: () {},
                    style: FilledButton.styleFrom(
                      backgroundColor: _green,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'تأیید جایگزینی',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
