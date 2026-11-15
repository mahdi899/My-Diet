import 'package:flutter/material.dart';
import '../../../core/format/digits.dart';
import '../../../core/motion/motion.dart';
import '../../../core/photos/photos.dart';
import '../../../core/theme/tokens.dart';
import 'pressable_scale.dart';

/// Large photo card: full-bleed food photo, dark gradient scrim, title,
/// optional kcal chip, meal badge and a "done" tick.
///
/// The photo comes from (in order) [photo], [photoId], or the resolver using
/// [title]/[ingredients]/[mealType]. Pass [heroTag] to enable a Hero
/// transition into a detail page that uses the same tag + [FoodImage].
class FoodHeroCard extends StatelessWidget {
  const FoodHeroCard({
    super.key,
    required this.title,
    this.subtitle,
    this.kcal,
    this.badge,
    this.photo,
    this.photoId,
    this.ingredients = const [],
    this.mealType,
    this.exclude = const {},
    this.height = 220,
    this.radius = AppRadius.xl,
    this.onTap,
    this.heroTag,
    this.done = false,
    this.trailing,
  });

  final String title;
  final String? subtitle;

  /// Calories; shown as «۴۵۰ کالری» chip.
  final num? kcal;

  /// Small glass label top-start, e.g. «ناهار · ۱۳:۰۰».
  final String? badge;
  final PhotoEntry? photo;
  final String? photoId;
  final List<String> ingredients;
  final String? mealType;
  final Set<String> exclude;
  final double height;
  final double radius;
  final VoidCallback? onTap;
  final Object? heroTag;
  final bool done;

  /// Extra widget at top-end (e.g. a swap button).
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    Widget image = FoodImage(
      photo: photo,
      photoId: photoId,
      title: title,
      ingredients: ingredients,
      mealType: mealType,
      exclude: exclude,
      cacheWidth:
          (MediaQuery.sizeOf(context).width *
                  MediaQuery.devicePixelRatioOf(context))
              .ceil()
              .clamp(64, 900),
    );
    if (heroTag != null) {
      image = HeroMode(
        enabled: !Motion.reduced(context),
        child: Hero(tag: heroTag!, child: image),
      );
    }
    final r = BorderRadius.circular(radius);
    return PressableScale(
      onTap: onTap,
      scale: 0.975,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          borderRadius: r,
          boxShadow: AppShadows.lifted,
        ),
        child: ClipRRect(
          borderRadius: r,
          child: Stack(
            fit: StackFit.expand,
            children: [
              image,
              const DecoratedBox(
                decoration: BoxDecoration(gradient: AppGradients.photoScrim),
              ),
              if (badge != null)
                PositionedDirectional(
                  top: 14,
                  start: 14,
                  child: GlassChip(label: badge!),
                ),
              if (trailing != null)
                PositionedDirectional(top: 10, end: 10, child: trailing!),
              PositionedDirectional(
                start: 18,
                end: 18,
                bottom: 16,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FoodTitleHero(
                            title: title,
                            tag: heroTag,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.bold,
                              height: 1.5,
                            ),
                          ),
                          if (subtitle != null)
                            Text(
                              subtitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Color(0xDDFFFFFF),
                                fontSize: 12,
                                height: 1.6,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (kcal != null) ...[
                      const SizedBox(width: 10),
                      _KcalChip(kcal: kcal!),
                    ],
                  ],
                ),
              ),
              PositionedDirectional(
                top: 12,
                end: 12,
                child: IgnorePointer(
                  child: AnimatedScale(
                    scale: done ? 1 : .7,
                    duration: Motion.of(context, Motion.quick),
                    child: AnimatedOpacity(
                      opacity: done ? 1 : 0,
                      duration: Motion.of(context, Motion.quick),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: AppGradients.cta,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FoodTitleHero extends StatelessWidget {
  const FoodTitleHero({
    super.key,
    required this.title,
    this.tag,
    required this.style,
  });
  final String title;
  final Object? tag;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final text = Material(
      type: MaterialType.transparency,
      child: Text(
        title,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: style.copyWith(
          fontFamily: Theme.of(context).textTheme.bodyMedium?.fontFamily,
        ),
      ),
    );
    if (tag == null) return text;
    return HeroMode(
      enabled: !Motion.reduced(context),
      child: Hero(tag: '$tag-title', child: text),
    );
  }
}

class _KcalChip extends StatelessWidget {
  const _KcalChip({required this.kcal});
  final num kcal;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
    decoration: BoxDecoration(
      gradient: AppGradients.amber,
      borderRadius: BorderRadius.circular(AppRadius.pill),
    ),
    child: Text(
      '${fa(kcal.round())} کالری',
      style: const TextStyle(
        color: AppColors.ink,
        fontSize: 12,
        fontWeight: FontWeight.bold,
        height: 1.5,
      ),
    ),
  );
}

/// Small translucent label for use on top of photos.
class GlassChip extends StatelessWidget {
  const GlassChip({super.key, required this.label, this.icon});
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0x66000000),
      borderRadius: BorderRadius.circular(AppRadius.pill),
      border: Border.all(color: const Color(0x33FFFFFF)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 4),
        ],
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11.5,
            fontWeight: FontWeight.bold,
            height: 1.5,
          ),
        ),
      ],
    ),
  );
}
