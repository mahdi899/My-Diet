import 'package:flutter/material.dart';
import 'food_photo_resolver.dart';
import 'photo_manifest.dart';

/// A bundled food/expert/lifestyle photo, decoded at display size, fading in
/// over its dominant colour.
///
/// ```dart
/// FoodImage(title: 'قورمه‌سبزی', mealType: 'ناهار', height: 180)   // resolved
/// FoodImage(photoId: 'persian_kuku_sabzi_dish', thumb: true, width: 64, height: 64)
/// FoodImage(photo: entry)                                         // explicit
/// ```
class FoodImage extends StatelessWidget {
  const FoodImage({
    super.key,
    this.photo,
    this.photoId,
    this.title,
    this.ingredients = const [],
    this.mealType,
    this.exclude = const {},
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.borderRadius,
    this.thumb = false,
    this.cacheWidth,
    this.semanticLabel,
  });

  /// Explicit photo; wins over [photoId] and the resolver inputs.
  final PhotoEntry? photo;
  final String? photoId;

  /// Resolver inputs, used when no [photo]/[photoId] is given.
  final String? title;
  final List<String> ingredients;
  final String? mealType;
  final Set<String> exclude;

  final double? width, height;
  final BoxFit fit;
  final AlignmentGeometry alignment;
  final BorderRadius? borderRadius;

  /// Use the 400px thumbnail asset (lists, avatars).
  final bool thumb;

  /// Override decode width in physical pixels.
  final int? cacheWidth;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final ready = FoodPhotoResolver.instance;
    final Widget child;
    if (photo != null) {
      child = _Pic(entry: photo!, owner: this);
    } else if (ready != null) {
      child = _Pic(entry: _resolve(ready), owner: this);
    } else {
      child = FutureBuilder<FoodPhotoResolver>(
        future: FoodPhotoResolver.load(),
        builder: (context, snap) => snap.hasData
            ? _Pic(entry: _resolve(snap.data!), owner: this)
            : _placeholder(const Color(0xFFEFE9DA)),
      );
    }
    final sized = SizedBox(width: width, height: height, child: child);
    return borderRadius == null
        ? sized
        : ClipRRect(borderRadius: borderRadius!, child: sized);
  }

  PhotoEntry _resolve(FoodPhotoResolver r) =>
      r.byId(photoId) ??
      r.resolve(
        title: title,
        ingredients: ingredients,
        mealType: mealType,
        exclude: exclude,
      );

  Widget _placeholder(Color c) => DecoratedBox(
    decoration: BoxDecoration(color: c),
    child: const SizedBox.expand(),
  );
}

class _Pic extends StatelessWidget {
  const _Pic({required this.entry, required this.owner});
  final PhotoEntry entry;
  final FoodImage owner;

  @override
  Widget build(BuildContext context) {
    final bg = Color.lerp(entry.color, Colors.white, 0.45)!;
    return LayoutBuilder(
      builder: (context, c) {
        final dpr = MediaQuery.devicePixelRatioOf(context);
        final logical = owner.width ??
            (c.maxWidth.isFinite ? c.maxWidth : 360.0);
        final limit = owner.thumb ? 400 : 900;
        final cw =
            owner.cacheWidth ?? (logical * dpr).ceil().clamp(64, limit);
        return ColoredBox(
          color: bg,
          child: Image.asset(
            owner.thumb ? entry.thumb : entry.path,
            width: owner.width,
            height: owner.height,
            fit: owner.fit,
            alignment: owner.alignment,
            cacheWidth: cw,
            gaplessPlayback: true,
            filterQuality: FilterQuality.medium,
            semanticLabel: owner.semanticLabel ?? entry.title,
            frameBuilder: (context, child, frame, sync) {
              if (sync) return child;
              final reduce = MediaQuery.maybeDisableAnimationsOf(context) ??
                  false;
              return AnimatedOpacity(
                opacity: frame == null ? 0 : 1,
                duration: reduce
                    ? Duration.zero
                    : const Duration(milliseconds: 320),
                curve: Curves.easeOut,
                child: child,
              );
            },
            errorBuilder: (_, _, _) => ColoredBox(
              color: bg,
              child: Center(
                child: Icon(
                  Icons.restaurant_rounded,
                  color: Colors.white.withValues(alpha: 0.8),
                  size: 32,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
