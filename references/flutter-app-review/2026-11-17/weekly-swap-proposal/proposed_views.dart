// Review-only UI concepts. This file is not imported by the application.
import 'package:flutter/material.dart';
import 'package:sabzine_flutter/core/icons/diet_icon.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/core/theme/tokens.dart';
import 'package:sabzine_flutter/data/demo_store.dart';

const _green = Color(0xFF0A5C42);
const _mint = Color(0xFFE6F4EA);
const _muted = Color(0xFF72827B);
const _line = Color(0xFFE6ECE8);

Text _text(
  String text, {
  double size = 13,
  bool bold = false,
  Color color = _green,
}) => Text(
  text,
  style: TextStyle(
    fontSize: size,
    fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
    color: color,
    height: 1.55,
  ),
);

Widget _pill(
  String text, {
  Color background = _mint,
  Color foreground = _green,
}) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
  decoration: BoxDecoration(
    color: background,
    borderRadius: BorderRadius.circular(30),
  ),
  child: _text(text, size: 10, bold: true, color: foreground),
);

Widget _photo(Meal meal, {double? width, double height = 110}) => SizedBox(
  width: width ?? double.infinity,
  height: height,
  child: FoodImage(
    title: meal.title,
    mealType: meal.name,
    ingredients: [for (final i in meal.ingredients) i.name],
    fit: BoxFit.cover,
  ),
);

Widget _button(String text, {bool primary = true, IconData? icon}) => SizedBox(
  height: 44,
  child: FilledButton(
    onPressed: () {},
    style: FilledButton.styleFrom(
      backgroundColor: primary ? _green : _mint,
      foregroundColor: primary ? Colors.white : _green,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[Icon(icon, size: 17), const SizedBox(width: 7)],
        Text(
          text,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
        ),
      ],
    ),
  ),
);

class ProposedWeek extends StatelessWidget {
  const ProposedWeek({super.key, required this.meals});
  final List<Meal> meals;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.white,
    bottomNavigationBar: const _Navigation(),
    body: SafeArea(
      bottom: false,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _text('برنامهٔ من', size: 26, bold: true),
                        _text('۱۶ تا ۲۲ آبان', size: 12, color: _muted),
                      ],
                    ),
                  ),
                  _pill('تأیید متخصص'),
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _mint,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const DietIcon(DietIconKind.plan, size: 26),
                  ),
                ],
              ),
            ),
          ),
          SliverPersistentHeader(pinned: true, delegate: _WeekHeader()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 18),
            sliver: SliverList.list(
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F9F6),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _text('۰ از ۴ وعده ثبت شده', size: 12, bold: true),
                          const Spacer(),
                          _text('هدف: ۱۷۹۰ کالری', size: 11, color: _muted),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          for (var i = 0; i < 4; i++) ...[
                            if (i > 0) const SizedBox(width: 5),
                            Expanded(
                              child: Container(
                                height: 4,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDCE9E0),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _text('دوشنبه، ۱۸ آبان', size: 16, bold: true),
                    const Spacer(),
                    _pill('امروز'),
                  ],
                ),
                const SizedBox(height: 10),
                _CompactMeal(meal: meals[0], label: 'صبحانه · ۸:۰۰'),
                const SizedBox(height: 12),
                _LunchCard(meal: meals[1]),
                const SizedBox(height: 12),
                _CompactMeal(meal: meals[2], label: 'میان‌وعده · ۱۶:۳۰'),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _WeekHeader extends SliverPersistentHeaderDelegate {
  @override
  double get minExtent => 94;
  @override
  double get maxExtent => 94;
  @override
  bool shouldRebuild(covariant _WeekHeader oldDelegate) => false;
  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) => Container(
    color: Colors.white,
    padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
    child: Row(
      children: [
        for (var i = 0; i < 7; i++) ...[
          if (i > 0) const SizedBox(width: 5),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: i == 2
                    ? _green
                    : i < 2
                    ? const Color(0xFFF4F5F4)
                    : Colors.white,
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: i == 2 ? _green : _line),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _text(
                    ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][i],
                    size: 11,
                    color: i == 2 ? Colors.white70 : _muted,
                  ),
                  _text(
                    ['۱۶', '۱۷', '۱۸', '۱۹', '۲۰', '۲۱', '۲۲'][i],
                    size: 18,
                    bold: true,
                    color: i == 2
                        ? Colors.white
                        : i < 2
                        ? const Color(0xFF97A29C)
                        : _green,
                  ),
                  _text(
                    i == 2
                        ? 'امروز'
                        : i < 2
                        ? 'گذشته'
                        : ' ',
                    size: 8,
                    color: i == 2 ? const Color(0xFFDAF1DC) : _muted,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class _CompactMeal extends StatelessWidget {
  const _CompactMeal({required this.meal, required this.label});
  final Meal meal;
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      border: Border.all(color: _line),
      borderRadius: BorderRadius.circular(19),
    ),
    child: Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(13),
          child: _photo(meal, width: 52, height: 52),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _text(label, size: 10, color: _muted),
              _text(meal.title, size: 13, bold: true),
            ],
          ),
        ),
        _text('ثبت نشده', size: 9, color: _muted),
      ],
    ),
  );
}

class _LunchCard extends StatelessWidget {
  const _LunchCard({required this.meal});
  final Meal meal;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: _line),
      borderRadius: BorderRadius.circular(22),
      boxShadow: [
        BoxShadow(
          color: _green.withValues(alpha: .045),
          blurRadius: 20,
          offset: const Offset(0, 6),
        ),
      ],
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          children: [
            _photo(meal, height: 138),
            PositionedDirectional(
              top: 10,
              start: 10,
              child: _pill('ناهار · ۱۳:۳۰', background: Colors.white),
            ),
            PositionedDirectional(
              bottom: 10,
              end: 10,
              child: _pill(
                'وعدهٔ پیش رو',
                background: _green,
                foreground: Colors.white,
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(child: _text(meal.title, size: 18, bold: true)),
                  _text('۶۴۰ کالری', size: 11, color: _muted),
                ],
              ),
              const SizedBox(height: 3),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: _text(
                  'ماهی ۱۵۰ گرم · پلو ۱۵۰ گرم',
                  size: 11,
                  color: _muted,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _button('ثبت وعده', icon: Icons.add_rounded)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _button(
                      'جایگزین',
                      primary: false,
                      icon: Icons.swap_horiz_rounded,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _Navigation extends StatelessWidget {
  const _Navigation();
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Container(
      height: 76,
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _line)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        textDirection: TextDirection.ltr,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            decoration: BoxDecoration(
              color: _mint,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Row(
              children: [
                const DietIcon(DietIconKind.plan, size: 24, selected: true),
                const SizedBox(width: 8),
                _text('برنامه', size: 12, bold: true),
              ],
            ),
          ),
          Column(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: _green,
                  shape: BoxShape.circle,
                ),
                child: const DietIcon(
                  DietIconKind.coach,
                  size: 23,
                  color: Colors.white,
                  monochrome: true,
                ),
              ),
              _text('مربی', size: 9),
            ],
          ),
          Row(
            children: [
              const DietIcon(DietIconKind.home, size: 24, color: _muted),
              const SizedBox(width: 8),
              _text('خانه', size: 12, color: _muted),
            ],
          ),
        ],
      ),
    ),
  );
}

class ProposedSwap extends StatelessWidget {
  const ProposedSwap({
    super.key,
    required this.current,
    required this.alternative,
  });
  final Meal current, alternative;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFEDF3EE),
    body: Stack(
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: _photo(current, height: 150),
        ),
        const Positioned.fill(child: ColoredBox(color: Color(0x660A2017))),
        Positioned(
          top: 38,
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD8E2DC),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _text(
                                'جایگزین ناهار',
                                size: 23,
                                bold: true,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: const BoxDecoration(
                                color: Color(0xFFF4F7F4),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                size: 19,
                                color: _muted,
                              ),
                            ),
                          ],
                        ),
                        _text(
                          'قبل از تأیید، دو وعده را مقایسه کن.',
                          size: 12,
                          color: _muted,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: _ComparisonMeal(
                                meal: current,
                                selected: false,
                                amounts: const [
                                  'ماهی: ۱۵۰ گرم',
                                  'پلو: ۱۵۰ گرم',
                                  'سالاد: ۱ لیوان',
                                  'روغن: ۲ قاشق چای‌خوری',
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _ComparisonMeal(
                                meal: alternative,
                                selected: true,
                                amounts: const [
                                  'عدس‌پلو: ۲۲۵ گرم',
                                  'گوشت: ۷۰ گرم',
                                  'ماست: نصف لیوان',
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: _mint,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.swap_horiz_rounded,
                                color: _green,
                                size: 21,
                              ),
                              const SizedBox(width: 8),
                              _text('۲۰ کالری بیشتر', size: 13, bold: true),
                              const Spacer(),
                              _text('مخصوص همین وعده', size: 10),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _text('دلیل تعویض', size: 13, bold: true),
                            const Spacer(),
                            _text(
                              'برای امروز لازم است',
                              size: 10,
                              color: _muted,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 7,
                          runSpacing: 7,
                          children: [
                            for (final reason in [
                              'دوست ندارم',
                              'مواد اولیه ندارم',
                              'زمان آماده‌سازی',
                            ])
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 11,
                                  vertical: 7,
                                ),
                                decoration: BoxDecoration(
                                  color: reason == 'دوست ندارم'
                                      ? _mint
                                      : Colors.white,
                                  border: Border.all(
                                    color: reason == 'دوست ندارم'
                                        ? _green
                                        : _line,
                                  ),
                                  borderRadius: BorderRadius.circular(22),
                                ),
                                child: _text(reason, size: 11),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            const Icon(
                              Icons.add_rounded,
                              size: 16,
                              color: _muted,
                            ),
                            const SizedBox(width: 4),
                            _text('افزودن توضیح', size: 11, color: _muted),
                            const Spacer(),
                            const DietIcon(DietIconKind.coach, size: 19),
                            const SizedBox(width: 5),
                            _text('پرسیدن از مربی', size: 11),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _text(
                          'گزینهٔ تأییدشدهٔ برنامهٔ تو',
                          size: 11,
                          color: _muted,
                        ),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 18),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(top: BorderSide(color: _line)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _button('تأیید جایگزینی', icon: Icons.swap_horiz_rounded),
                      const SizedBox(height: 9),
                      Text(
                        'تا قبل از تأیید، برنامه تغییر نمی‌کند.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 10, color: _muted),
                      ),
                    ],
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

class _ComparisonMeal extends StatelessWidget {
  const _ComparisonMeal({
    required this.meal,
    required this.selected,
    required this.amounts,
  });
  final Meal meal;
  final bool selected;
  final List<String> amounts;
  @override
  Widget build(BuildContext context) => Container(
    height: 292,
    decoration: BoxDecoration(
      color: selected ? const Color(0xFFF4FAF5) : Colors.white,
      border: Border.all(
        color: selected ? _green : _line,
        width: selected ? 1.5 : 1,
      ),
      borderRadius: BorderRadius.circular(19),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              _text(
                selected ? 'انتخاب جدید' : 'وعدهٔ فعلی',
                size: 11,
                bold: true,
                color: selected ? _green : _muted,
              ),
              const Spacer(),
              if (selected)
                const Icon(Icons.radio_button_checked, size: 16, color: _green),
            ],
          ),
        ),
        _photo(meal, height: 106),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _text(meal.title, size: 14, bold: true),
              const SizedBox(height: 3),
              _text(selected ? '۶۶۰ کالری' : '۶۴۰ کالری', size: 12, bold: true),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Divider(height: 1, color: _line),
              ),
              for (final amount in amounts)
                _text(amount, size: 10, color: _muted),
            ],
          ),
        ),
      ],
    ),
  );
}
