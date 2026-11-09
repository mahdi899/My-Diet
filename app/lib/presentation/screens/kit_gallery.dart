import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/photos/photos.dart';
import '../../core/theme/theme.dart';
import '../widgets/kit/kit.dart';

/// Debug-only playground for the «رژیم من» design system.
/// Run with `--dart-define=KIT_GALLERY=true` or call [openKitGallery].
void openKitGallery(BuildContext context) {
  assert(() {
    Navigator.of(context).push(fadeThroughRoute<void>(const KitGalleryScreen()));
    return true;
  }());
}

class KitGalleryScreen extends StatefulWidget {
  const KitGalleryScreen({super.key});
  @override
  State<KitGalleryScreen> createState() => _KitGalleryScreenState();
}

class _KitGalleryScreenState extends State<KitGalleryScreen> {
  int burst = 0;
  double progress = 0.72;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    FoodPhotoResolver.load().then((_) {
      if (mounted) setState(() {});
    });
  }

  static const samples = <(String, String, List<String>)>[
    ('املت گوجه‌فرنگی', 'صبحانه', ['تخم‌مرغ', 'گوجه']),
    ('قورمه‌سبزی با برنج', 'ناهار', ['سبزی', 'لوبیا قرمز', 'گوشت']),
    ('جوجه‌کباب', 'شام', ['مرغ', 'زعفران']),
    ('فالوده', 'دسر', []),
    ('خرما و گردو', 'میان‌وعده', ['خرما', 'گردو']),
    ('سکنجبین', 'نوشیدنی', []),
    ('غذای ناشناخته ۱', 'ناهار', []),
    ('غذای ناشناخته ۲', 'شام', []),
  ];

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(title: const Text('کیت «رژیم من»')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 48),
          children: [
            ...staggered([
              _section('دکمه‌ها'),
              PillButton(
                label: 'شروع کن',
                icon: Icons.bolt_rounded,
                onPressed: () => setState(() => burst++),
              ),
              Row(
                children: [
                  Expanded(
                    child: PillButton(
                      label: 'ثبت وعده',
                      variant: PillVariant.lime,
                      onPressed: () {},
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PillButton(
                      label: 'تعویض',
                      variant: PillVariant.soft,
                      onPressed: () {},
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Expanded(
                    child: PillButton(
                      label: 'بعداً',
                      variant: PillVariant.outline,
                      onPressed: () {},
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PillButton(
                      label: loading ? 'صبر کن' : 'لودینگ',
                      variant: PillVariant.dark,
                      loading: loading,
                      onPressed: () {
                        setState(() => loading = true);
                        Future<void>.delayed(
                          const Duration(seconds: 1),
                          () => mounted ? setState(() => loading = false) : null,
                        );
                      },
                    ),
                  ),
                ],
              ),
              const PillButton(label: 'غیرفعال'),
            ]),
            _section('حلقه و عدد'),
            AppCard(
              child: Row(
                children: [
                  SparkleBurst(
                    trigger: burst,
                    child: Ring(
                      value: progress,
                      size: 132,
                      strokeWidth: 14,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Ticker(
                            key: ValueKey(progress),
                            value: 1850 * progress,
                            grouped: true,
                            style: t.titleLarge,
                          ),
                          Text('از ۱٬۸۵۰', style: t.bodySmall),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Ticker(
                          value: 72.4,
                          fractionDigits: 1,
                          suffix: ' کیلو',
                          style: t.headlineMedium,
                        ),
                        Slider(
                          value: progress,
                          onChanged: (v) => setState(() => progress = v),
                        ),
                        Row(
                          children: [
                            const Ring(
                              value: 0.6,
                              size: 44,
                              strokeWidth: 6,
                              colors: [AppColors.amber],
                            ),
                            const SizedBox(width: 8),
                            const Ring(
                              value: 0.3,
                              size: 44,
                              strokeWidth: 6,
                              colors: [AppColors.coral],
                              delay: Duration(milliseconds: 150),
                            ),
                            const SizedBox(width: 8),
                            const Ring(
                              value: 0.9,
                              size: 44,
                              strokeWidth: 6,
                              colors: [AppColors.sky],
                              delay: Duration(milliseconds: 300),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ).rise(index: 2),
            _section('اسکلتون'),
            const SkeletonCard(height: 120),
            const SizedBox(height: 10),
            const Row(
              children: [
                Skeleton.circle(size: 44),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    children: [
                      Skeleton.line(),
                      SizedBox(height: 8),
                      Skeleton.line(width: 120),
                    ],
                  ),
                ),
              ],
            ),
            _section('کارت غذا (انتخاب خودکار عکس)'),
            for (final (i, s) in samples.indexed)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: FoodHeroCard(
                  title: s.$1,
                  mealType: s.$2,
                  ingredients: s.$3,
                  badge: s.$2,
                  kcal: 320 + i * 55,
                  done: i == 1,
                  subtitle: _matched(s),
                  heroTag: 'gallery-$i',
                  onTap: () => setState(() => burst++),
                ).rise(index: i),
              ),
            _section('چهره‌ها و سبک زندگی'),
            SizedBox(
              height: 110,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (var i = 0; i < 4; i++)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 10),
                      child: FoodImage(
                        photo: FoodPhotoResolver.instance?.expert(i),
                        title: 'x',
                        thumb: true,
                        width: 110,
                        height: 110,
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ),
                  for (var i = 0; i < 4; i++)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 10),
                      child: FoodImage(
                        photo: FoodPhotoResolver.instance?.lifestyle(i),
                        title: 'x',
                        thumb: true,
                        width: 110,
                        height: 110,
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ),
                ],
              ),
            ),
            _section('شیشه‌ای'),
            SizedBox(
              height: 140,
              child: Stack(
                children: [
                  FoodImage(
                    title: 'کباب',
                    mealType: 'شام',
                    height: 140,
                    borderRadius: BorderRadius.circular(28),
                  ),
                  const Positioned.fill(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: GlassBar(
                        height: 56,
                        margin: EdgeInsets.all(12),
                        child: Center(child: Text('نوار شیشه‌ای')),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (kDebugMode)
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Text(
                  'تعداد عکس‌ها: ${FoodPhotoResolver.instance?.manifest.items.length ?? '…'}',
                  style: t.bodySmall,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String? _matched(( String, String, List<String>) s) {
    final r = FoodPhotoResolver.instance;
    if (r == null) return null;
    final p = r.resolve(title: s.$1, ingredients: s.$3, mealType: s.$2);
    return '← ${p.title}';
  }

  Widget _section(String text) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 12),
    child: Text(text, style: Theme.of(context).textTheme.titleMedium),
  );
}
