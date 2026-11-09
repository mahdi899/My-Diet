import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late PhotoManifest manifest;
  late FoodPhotoResolver r;

  setUpAll(() async {
    manifest = await PhotoManifest.load();
    r = FoodPhotoResolver(manifest);
  });

  test('manifest is complete and files exist', () {
    expect(manifest.items.length, 177);
    final ids = <String>{};
    for (final e in manifest.items) {
      expect(ids.add(e.id), isTrue, reason: 'duplicate ${e.id}');
      expect(e.path, matches(RegExp(r'^assets/photo/[a-z]+/[a-z0-9_]+\.jpg$')));
      expect(File(e.path).existsSync(), isTrue, reason: e.path);
      expect(File(e.thumb).existsSync(), isTrue, reason: e.thumb);
    }
    final counts = manifest.countsByCategory;
    expect(counts['expert'], greaterThan(0));
    expect(counts['breakfast'], greaterThan(10));
  });

  test('matches Persian dish names', () {
    expect(r.resolve(title: 'قورمه‌سبزی').id, contains('ghormeh'));
    expect(r.resolve(title: 'خورش فسنجان', mealType: 'ناهار').id,
        contains('fesenjan'));
    expect(r.resolve(title: 'زرشک پلو با مرغ').id, contains('zereshk'));
    expect(r.resolve(title: 'املت', mealType: 'صبحانه').category, 'breakfast');
    expect(r.resolve(title: 'Salad Shirazi').id, contains('shirazi'));
  });

  test('uses ingredients and synonyms', () {
    final p = r.resolve(
      title: 'وعده ویژه',
      ingredients: ['جوجه', 'زعفران', 'برنج'],
      mealType: 'شام',
    );
    expect(p.isFood, isTrue);
    expect(p.tags.any((t) => t.contains('کباب') || t.contains('مرغ')), isTrue);
  });

  test('fallback is stable per title and respects meal type', () {
    final a = r.resolve(title: 'غذای ناشناخته ۱', mealType: 'ناهار');
    final b = r.resolve(title: 'غذای ناشناخته ۱', mealType: 'ناهار');
    expect(a.id, b.id);
    expect(a.category, 'lunch');
    expect(r.resolve(mealType: 'breakfast').category, 'breakfast');
    expect(r.resolve(mealType: 'نوشیدنی').category, 'drink');
  });

  test('exclude avoids repeats', () {
    final first = r.resolve(title: 'کباب', mealType: 'شام');
    final second = r.resolve(
      title: 'کباب',
      mealType: 'شام',
      exclude: {first.id},
    );
    expect(second.id, isNot(first.id));
  });

  test('experts and lifestyle pickers', () {
    expect(r.expert(1).kind, 'expert');
    expect(r.lifestyle('a').kind, 'lifestyle');
    expect(FoodPhotoResolver.normalizeMealType('میان‌وعده'), 'snack');
  });
}
