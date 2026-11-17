import '../../core/icons/diet_icon.dart';
import 'package:flutter/material.dart';

import '../../core/motion/motion_kit.dart';
import '../../core/photos/photos.dart';
import '../../core/theme/tokens.dart';
import '../../core/theme/typography.dart';
import '../../domain/common/number_format.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../coach/coach_launcher.dart';
import 'consume_sheet.dart';
import 'cooking_page.dart';
import 'goal_math.dart';
import 'meal_substitution_sheet.dart';

Route<T> foodDetailRoute<T>(Widget page, {bool reduced = false}) =>
    PageRouteBuilder<T>(
      opaque: true,
      transitionDuration: reduced
          ? Duration.zero
          : const Duration(milliseconds: 240),
      reverseTransitionDuration: reduced
          ? Duration.zero
          : const Duration(milliseconds: 200),
      pageBuilder: (_, _, _) => ColoredBox(color: AppColors.bg, child: page),
      transitionsBuilder: (_, animation, _, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
        );
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.03),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        );
      },
    );

class MealDetailPage extends StatefulWidget {
  const MealDetailPage({
    super.key,
    required this.date,
    required this.index,
    this.heroTag,
    this.heroes = true,
  });

  final DateTime date;
  final int index;
  final Object? heroTag;
  final bool heroes;

  @override
  State<MealDetailPage> createState() => _MealDetailPageState();
}

class _MealDetailPageState extends State<MealDetailPage> {
  int _tab = 0;
  int _burst = 0;

  Future<void> _precise() async {
    final saved = await showConsumeSheet(context, widget.date, widget.index);
    if (saved && mounted) {
      Haptics.success();
      setState(() => _burst++);
    }
  }

  Future<void> _alternatives() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: AppColors.bg,
      builder: (_) => MealSubstitutionSheet(
        date: widget.date,
        index: widget.index,
        onCoach: (meal) => openCoach(context, prefill: swapPrefill(meal)),
      ),
    );
    if (changed == true && mounted) setState(() => _tab = 0);
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meals = store.hasUserRequest
        ? store.mealsOn(widget.date)
        : const <Meal>[];
    if (widget.index < 0 || widget.index >= meals.length) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          leading: const BackButton(color: AppColors.emeraldDark),
        ),
        body: const Center(child: Text('این وعده در برنامه نیست')),
      );
    }
    final meal = meals[widget.index];
    final recorded =
        store.mealRecordOn(widget.date, widget.index) != null ||
        store.mealEaten(widget.date, widget.index);
    final tag = widget.heroTag ?? mealHeroTag(widget.date, widget.index);
    final theme = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          CustomScrollView(
            key: const ValueKey('meal-detail-scroll'),
            slivers: [
              SliverToBoxAdapter(
                child: SizedBox(
                  height: (MediaQuery.sizeOf(context).height * .285).clamp(
                    220.0,
                    300.0,
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      HeroMode(
                        enabled: widget.heroes && !Motion.reduced(context),
                        child: Hero(
                          tag: tag,
                          child: FoodImage(
                            title: meal.title,
                            mealType: meal.name,
                            ingredients: [
                              for (final item in meal.ingredients) item.name,
                            ],
                            fit: BoxFit.cover,
                            semanticLabel: meal.title,
                            cacheWidth:
                                (MediaQuery.sizeOf(context).width *
                                        MediaQuery.devicePixelRatioOf(context))
                                    .ceil()
                                    .clamp(64, 900),
                          ),
                        ),
                      ),
                      const Positioned(
                        bottom: -1,
                        left: 0,
                        right: 0,
                        child: SizedBox(
                          height: 25,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.bg,
                              borderRadius: BorderRadius.vertical(
                                top: Radius.circular(32),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        meal.time.isEmpty
                            ? meal.name
                            : '${meal.name} · ${fa(meal.time)}',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 5),
                      FoodTitleHero(
                        title: meal.title,
                        tag: widget.heroes ? tag : null,
                        style: theme.headlineMedium!.copyWith(
                          color: AppColors.emeraldDark,
                          fontSize: 26,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _MealMetadata(meal: meal),
                      const SizedBox(height: 12),
                      _DetailTabs(
                        selected: _tab,
                        onChanged: (value) {
                          if (_tab == value) return;
                          Haptics.tap();
                          setState(() => _tab = value);
                        },
                      ),
                      const SizedBox(height: 14),
                      if (_tab == 1 &&
                          recipeSteps(meal.instructions).isNotEmpty) ...[
                        const SizedBox(height: 14),
                        FilledButton.icon(
                          key: const ValueKey('meal-start-cooking'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                          ),
                          onPressed: () => Navigator.of(context).push<void>(
                            foodDetailRoute<void>(
                              CookingPage(meal: meal),
                              reduced: Motion.reduced(context),
                            ),
                          ),
                          icon: const DietIcon(
                            DietIconKind.meal,
                            color: Colors.white,
                            monochrome: true,
                          ),
                          label: const Text('شروع آشپزی قدم‌به‌قدم'),
                        ),
                      ],
                      AnimatedSwitcher(
                        duration: Motion.of(context, Motion.quick),
                        switchInCurve: Curves.easeOut,
                        switchOutCurve: Curves.easeIn,
                        child: _tab == 0
                            ? _PortionCard(
                                key: ValueKey('meal-portions-${meal.title}'),
                                meal: meal,
                              )
                            : _RecipeCard(
                                key: ValueKey('meal-recipe-${meal.title}'),
                                meal: meal,
                              ),
                      ),
                      if (meal.quantityBasis.trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Theme(
                            data: Theme.of(
                              context,
                            ).copyWith(dividerColor: Colors.transparent),
                            child: ExpansionTile(
                              key: ValueKey('meal-basis-${meal.title}'),
                              tilePadding: EdgeInsets.zero,
                              childrenPadding: const EdgeInsets.only(
                                bottom: 12,
                              ),
                              visualDensity: VisualDensity.compact,
                              title: const Text(
                                'راهنمای اندازه‌گیری',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.inkSoft,
                                ),
                              ),
                              children: [
                                Text(
                                  meal.quantityBasis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.inkSoft,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          PositionedDirectional(
            top: 12,
            start: 16,
            child: SafeArea(
              bottom: false,
              child: Material(
                color: AppColors.surfaceWarm,
                shape: const CircleBorder(),
                elevation: 1,
                shadowColor: const Color(0x180A5C42),
                child: BackButton(color: AppColors.emeraldDark),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: AppColors.surfaceWarm,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final stacked =
                    constraints.maxWidth < 330 &&
                    MediaQuery.textScalerOf(context).scale(14) > 18;
                final primaryWidth = stacked
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 10) * .625;
                final secondaryWidth = stacked
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 10) * .375;
                return Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  children: [
                    SizedBox(
                      width: primaryWidth,
                      child: SparkleBurst(
                        trigger: _burst,
                        child: FilledButton(
                          key: const ValueKey('meal-record'),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.emeraldDeep,
                            minimumSize: const Size.fromHeight(52),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                          onPressed: canLogMeal(store, widget.date)
                              ? _precise
                              : null,
                          child: store.savingMeal
                              ? const SizedBox.square(
                                  dimension: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.check_rounded, size: 22),
                                    const SizedBox(width: 8),
                                    Flexible(
                                      child: Text(
                                        recorded ? 'ثبت شد' : 'ثبت این وعده',
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ),
                    SizedBox(
                      width: secondaryWidth,
                      child: OutlinedButton(
                        key: const ValueKey('meal-alternatives'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.emeraldDeep,
                          side: const BorderSide(
                            color: AppColors.emeraldDeep,
                            width: 1.2,
                          ),
                          minimumSize: const Size.fromHeight(52),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        onPressed: store.savingSubstitution
                            ? null
                            : _alternatives,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.swap_horiz_rounded, size: 22),
                            const SizedBox(width: 6),
                            const Flexible(
                              child: Text(
                                'جایگزین',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _MealMetadata extends StatelessWidget {
  const _MealMetadata({required this.meal});
  final Meal meal;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[
      if (meal.calories > 0)
        _MealMeta(
          Icons.local_fire_department_outlined,
          '${fa(meal.calories)} کالری',
        ),
      if (meal.preparationMinutes != null)
        _MealMeta(
          Icons.schedule_rounded,
          '${fa(meal.preparationMinutes!)} دقیقه آماده‌سازی',
        ),
    ];
    if (items.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.only(bottom: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              Container(
                width: 1,
                height: 28,
                margin: const EdgeInsets.symmetric(horizontal: 12),
                color: AppColors.line,
              ),
            Expanded(child: items[i]),
          ],
        ],
      ),
    );
  }
}

class _MealMeta extends StatelessWidget {
  const _MealMeta(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(7),
        decoration: const BoxDecoration(
          color: AppColors.mint,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 19, color: AppColors.emeraldDark),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.emeraldDark,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
  );
}

class _DetailTabs extends StatelessWidget {
  const _DetailTabs({required this.selected, required this.onChanged});
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.bgDeep,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Padding(
      padding: const EdgeInsets.all(3),
      child: Row(
        children: [
          for (var i = 0; i < 2; i++)
            Expanded(
              child: Semantics(
                selected: i == selected,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    key: ValueKey(
                      i == 0 ? 'meal-tab-portions' : 'meal-tab-recipe',
                    ),
                    onTap: () => onChanged(i),
                    borderRadius: BorderRadius.circular(15),
                    child: AnimatedContainer(
                      duration: Motion.of(context, Motion.quick),
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 6,
                      ),
                      constraints: const BoxConstraints(minHeight: 46),
                      decoration: BoxDecoration(
                        color: selected == i
                            ? AppColors.surface
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(15),
                        boxShadow: selected == i
                            ? [
                                const BoxShadow(
                                  color: Color(0x0A1F2D26),
                                  blurRadius: 8,
                                  offset: Offset(0, 2),
                                ),
                              ]
                            : null,
                      ),
                      child: Text(
                        i == 0 ? 'مقدار و مواد' : 'طرز تهیه',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: selected == i
                              ? AppColors.emeraldDeep
                              : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _PortionCard extends StatelessWidget {
  const _PortionCard({super.key, required this.meal});
  final Meal meal;

  @override
  Widget build(BuildContext context) => _DetailCard(
    title: 'سهم تو در این وعده',
    subtitle: 'مقدار هر جزء را اینجا ببین',
    child: meal.ingredients.isEmpty
        ? Padding(
            padding: const EdgeInsets.all(18),
            child: Text(
              meal.amount.trim().isEmpty
                  ? 'مقدار مواد این وعده هنوز درج نشده است.'
                  : meal.amount,
            ),
          )
        : Column(
            children: [
              for (var i = 0; i < meal.ingredients.length; i++) ...[
                if (i > 0)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Divider(height: 1, color: AppColors.line),
                  ),
                _IngredientRow(item: meal.ingredients[i]),
              ],
            ],
          ),
  );
}

class _IngredientRow extends StatelessWidget {
  const _IngredientRow({required this.item});
  final MealIngredient item;

  @override
  Widget build(BuildContext context) {
    final quantity = item.quantity;
    final amount = quantity == null
        ? (item.unit.trim().isEmpty ? 'مقدار درج نشده' : fa(item.unit))
        : persianQuantity(quantity, item.unit);
    final resolver = FoodPhotoResolver.instance;
    final cooked = ['پلو', 'پخته', 'سالاد'].any(item.name.contains);
    final photo =
        (cooked ? resolver?.bestMatch(title: item.name) : null) ??
        resolver?.bestMatch(title: item.name, mealType: 'ingredient');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stacked =
              constraints.maxWidth < 300 &&
              MediaQuery.textScalerOf(context).scale(14) > 17;
          return Row(
            children: [
              ExcludeSemantics(
                child: photo == null
                    ? Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.mint,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const DietIcon(DietIconKind.meal, size: 24),
                      )
                    : FoodImage(
                        photo: photo,
                        thumb: true,
                        width: 44,
                        height: 44,
                        borderRadius: BorderRadius.circular(12),
                      ),
              ),
              const SizedBox(width: 10),
              if (stacked)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: AppTypography.body),
                      const SizedBox(height: AppSpacing.xs),
                      Text(amount, style: AppTypography.quantity),
                    ],
                  ),
                )
              else ...[
                Expanded(
                  flex: 3,
                  child: Text(item.name, style: AppTypography.body),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: Text(
                    amount,
                    textAlign: TextAlign.end,
                    style: AppTypography.quantity,
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({super.key, required this.meal});
  final Meal meal;

  @override
  Widget build(BuildContext context) {
    final steps = recipeSteps(meal.instructions);
    return _DetailCard(
      title: 'یک وعدهٔ خوش‌طعم، قدم‌به‌قدم',
      subtitle: 'طرز تهیهٔ این غذا',
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: steps.isEmpty
            ? const Text('دستور تهیهٔ این غذا هنوز درج نشده است.')
            : Column(
                children: [
                  for (var i = 0; i < steps.length; i++)
                    Padding(
                      padding: EdgeInsets.only(
                        bottom: i == steps.length - 1 ? 0 : 18,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 15,
                            backgroundColor: AppColors.mint,
                            child: Text(
                              fa(i + 1),
                              style: const TextStyle(
                                color: AppColors.emeraldDark,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(steps[i], style: AppTypography.body),
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

class _DetailCard extends StatelessWidget {
  const _DetailCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });
  final String title, subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.line),
      borderRadius: BorderRadius.circular(AppRadius.xl),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: AppColors.mint,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.emeraldDark,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 12, color: AppColors.inkSoft),
              ),
            ],
          ),
        ),
        child,
      ],
    ),
  );
}
