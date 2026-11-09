import 'dart:math' as math;
import 'package:flutter/services.dart';
import 'photo_manifest.dart';

/// Picks the best bundled photo for a meal.
///
/// Matching is keyword scoring over the Persian + English tags of every photo
/// (title words weigh most, ingredients less, a few synonym groups bridge
/// «جوجه»↔«مرغ» etc.). When nothing matches well the choice falls back to a
/// deterministic pick inside the meal-type pool, so the same title always gets
/// the same photo.
///
/// ```dart
/// final r = await FoodPhotoResolver.load();
/// final photo = r.resolve(title: 'خورش قیمه', mealType: 'ناهار');
/// ```
class FoodPhotoResolver {
  FoodPhotoResolver(this.manifest) {
    _index();
  }

  final PhotoManifest manifest;

  static FoodPhotoResolver? _instance;
  static Future<FoodPhotoResolver>? _loading;

  /// The shared resolver once [load] has completed, else null.
  static FoodPhotoResolver? get instance => _instance;

  /// Loads the manifest once and caches the resolver.
  static Future<FoodPhotoResolver> load({AssetBundle? bundle}) =>
      _loading ??= PhotoManifest.load(bundle: bundle).then(
        (m) => _instance = FoodPhotoResolver(m),
        onError: (Object e, StackTrace s) {
          _loading = null; // allow a retry
          throw e;
        },
      );

  /// For tests: install a resolver without touching the asset bundle.
  static void debugInstall(FoodPhotoResolver? resolver) {
    _instance = resolver;
    _loading = resolver == null ? null : Future.value(resolver);
  }

  // ---------------------------------------------------------------- index
  final Map<String, Set<String>> _tokens = {};
  final Map<String, String> _normTitle = {};
  final Map<String, int> _df = {};
  List<PhotoEntry> _food = const [];
  List<PhotoEntry> _ingredients = const [];

  void _index() {
    _food = manifest.items.where((e) => e.isFood).toList(growable: false);
    _ingredients = manifest.items
        .where((e) => e.kind == 'ingredient')
        .toList(growable: false);
    for (final e in manifest.items) {
      final toks = <String>{};
      for (final t in [...e.tags, ..._tokenize(e.title)]) {
        final s = _stem(normalize(t));
        if (s.length > 1 && !_stop.contains(s)) toks.add(s);
      }
      _tokens[e.id] = toks;
      _normTitle[e.id] = normalize(e.title);
      for (final t in toks) {
        _df[t] = (_df[t] ?? 0) + 1;
      }
    }
  }

  double _idf(String t) {
    final df = _df[t] ?? 0;
    return 1 + math.log((manifest.items.length + 1) / (df + 1));
  }

  // -------------------------------------------------------------- public
  PhotoEntry? byId(String? id) => id == null ? null : manifest.byId[id];

  /// Best photo for a meal. [exclude] lets a list avoid repeating photos.
  PhotoEntry resolve({
    String? title,
    List<String> ingredients = const [],
    String? mealType,
    Set<String> exclude = const {},
  }) => rank(
    title: title,
    ingredients: ingredients,
    mealType: mealType,
    limit: manifest.items.length,
  ).firstWhere(
    (e) => !exclude.contains(e.id),
    orElse: () => rank(title: title, ingredients: ingredients, mealType: mealType)
        .first,
  );

  /// Photos ordered best-first (matches, then deterministic fallbacks).
  List<PhotoEntry> rank({
    String? title,
    List<String> ingredients = const [],
    String? mealType,
    int limit = 6,
  }) {
    final meal = normalizeMealType(mealType);
    final pool = meal == 'ingredient' ? _ingredients : _food;
    final nTitle = normalize(title ?? '');
    // One query term per word; synonyms count once (max), not additively.
    final q = <String, (double, List<String>)>{};
    void add(String raw, double w) {
      for (final t in _tokenize(raw)) {
        final main = _stem(t);
        if (main.length < 2) continue;
        final prev = q[main];
        if (prev == null || w > prev.$1) q[main] = (w, _synonymsOf(main));
      }
    }

    add(title ?? '', 3.0);
    for (final i in ingredients.take(12)) {
      add(i, 1.2);
    }

    final flatQ = nTitle.replaceAll(' ', '');
    final scored = <(PhotoEntry, double)>[];
    for (final e in pool) {
      var s = 0.0;
      final et = _tokens[e.id]!;
      q.forEach((tok, wsyn) {
        final w = wsyn.$1;
        var best = 0.0;
        if (et.contains(tok)) {
          best = w * _idf(tok);
        } else {
          for (final syn in wsyn.$2) {
            if (et.contains(syn)) best = math.max(best, w * 0.5 * _idf(syn));
          }
          if (best == 0 && tok.length >= 4) {
            for (final x in et) {
              if (x.length >= 4 && (x.contains(tok) || tok.contains(x))) {
                best = w * _idf(tok) * 0.45;
                break;
              }
            }
          }
        }
        s += best;
      });
      if (flatQ.length > 3) {
        final flatT = _normTitle[e.id]!.replaceAll(' ', '');
        if (flatQ == flatT) {
          s += 12;
        } else if (flatT.length > 3 && flatQ.contains(flatT)) {
          s += 8;
        } else if (flatT.contains(flatQ)) {
          s += 6;
        }
      }
      if (s > 0 && meal != null && meal != 'ingredient') {
        if (e.category == meal) {
          s += 1.5;
        } else {
          const strong = {'drink', 'dessert'};
          s -= strong.contains(meal) || strong.contains(e.category) ? 4.5 : 0.5;
        }
      }
      if (s >= _threshold) scored.add((e, s));
    }

    final seed = _hash(
      nTitle.isNotEmpty ? nTitle : normalize(ingredients.join(' ')),
    );
    scored.sort((a, b) {
      final c = b.$2.compareTo(a.$2);
      if (c != 0) return c;
      return _hash('$seed${a.$1.id}').compareTo(_hash('$seed${b.$1.id}'));
    });
    final out = [for (final s in scored) s.$1];

    // Deterministic fallback inside the meal-type pool, stable per title.
    final fallbackPool = (meal == null || meal == 'ingredient')
        ? pool
        : pool.where((e) => e.category == meal).toList();
    final fb = fallbackPool.isEmpty ? pool : fallbackPool;
    if (fb.isNotEmpty) {
      final start = seed % fb.length;
      for (var i = 0; i < fb.length; i++) {
        final e = fb[(start + i) % fb.length];
        if (!out.contains(e)) out.add(e);
      }
    }
    if (out.isEmpty) out.addAll(manifest.items);
    return out.length > limit ? out.sublist(0, limit) : out;
  }

  /// A nutritionist portrait, stable per [seed].
  PhotoEntry expert([Object? seed]) => _pick('expert', seed);

  /// A lifestyle shot, stable per [seed].
  PhotoEntry lifestyle([Object? seed]) => _pick('lifestyle', seed);

  PhotoEntry ingredient([Object? seed]) => _pick('ingredient', seed);

  PhotoEntry _pick(String kind, Object? seed) {
    final list = manifest.ofKind(kind);
    if (list.isEmpty) return manifest.items.first;
    return list[_hash('$seed') % list.length];
  }

  /// Free-text search for pickers/galleries.
  List<PhotoEntry> search(String query, {int limit = 24}) {
    final toks = _tokenize(query).map(_stem).where((t) => t.isNotEmpty);
    final scored = <(PhotoEntry, double)>[];
    for (final e in manifest.items) {
      var s = 0.0;
      for (final t in toks) {
        if (_tokens[e.id]!.contains(t)) s += _idf(t);
      }
      if (s > 0) scored.add((e, s));
    }
    scored.sort((a, b) => b.$2.compareTo(a.$2));
    return [for (final s in scored.take(limit)) s.$1];
  }

  // ----------------------------------------------------------- text utils
  static const _threshold = 3.0;

  /// Canonical meal type (`breakfast|lunch|dinner|snack|dessert|drink|
  /// ingredient`) from Persian/English labels, or null.
  static String? normalizeMealType(String? raw) {
    if (raw == null) return null;
    final t = normalize(raw);
    if (t.isEmpty) return null;
    bool has(List<String> keys) => keys.any(t.contains);
    if (has(['breakfast', 'صبحانه'])) return 'breakfast';
    if (has(['lunch', 'ناهار'])) return 'lunch';
    if (has(['dinner', 'شام', 'supper'])) return 'dinner';
    if (has(['dessert', 'دسر', 'شیرینی'])) return 'dessert';
    if (has(['drink', 'beverage', 'نوشیدن', 'نوشابه', 'دمنوش', 'شربت'])) {
      return 'drink';
    }
    if (has([
      'snack', 'میان', 'عصرانه', 'میوه', 'brunch', 'اسنک',
    ])) {
      return 'snack';
    }
    if (has(['ingredient', 'ماده', 'مواد'])) return 'ingredient';
    return null;
  }

  /// Lowercase, unify Arabic/Persian letters & digits, ZWNJ -> space,
  /// strip diacritics and punctuation.
  static String normalize(String s) {
    final b = StringBuffer();
    for (final r in s.toLowerCase().runes) {
      if (r == 0x64A) {
        b.writeCharCode(0x6CC); // ي -> ی
      } else if (r == 0x649) {
        b.writeCharCode(0x6CC); // ى -> ی
      } else if (r == 0x643) {
        b.writeCharCode(0x6A9); // ك -> ک
      } else if (r == 0x200C || r == 0x200D || r == 0x640) {
        b.write(r == 0x640 ? '' : ' ');
      } else if (r >= 0x64B && r <= 0x65F) {
        continue; // harakat
      } else if (r >= 0x6F0 && r <= 0x6F9) {
        b.writeCharCode(r - 0x6F0 + 0x30);
      } else if (r >= 0x660 && r <= 0x669) {
        b.writeCharCode(r - 0x660 + 0x30);
      } else {
        b.writeCharCode(r);
      }
    }
    return b
        .toString()
        .replaceAll(RegExp(r'[^\p{L}\p{N}\s]', unicode: true), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static List<String> _tokenize(String s) => normalize(
    s,
  ).split(' ').where((t) => t.isNotEmpty && !_stop.contains(t)).toList();

  /// Cheap Persian/English suffix stripping so «کبابی»≈«کباب», «eggs»≈«egg».
  static String _stem(String t) {
    if (t.length > 4) {
      for (final suf in const ['های', 'ها', 'ان']) {
        if (t.endsWith(suf)) return t.substring(0, t.length - suf.length);
      }
    }
    if (t.length > 3 && t.endsWith('ی')) return t.substring(0, t.length - 1);
    if (t.length > 3 && t.endsWith('s') && RegExp(r'^[a-z]+$').hasMatch(t)) {
      return t.substring(0, t.length - 1);
    }
    return t;
  }

  /// Other members of every synonym group containing [stem].
  static List<String> _synonymsOf(String stem) => [
    for (final g in _syn)
      if (g.contains(stem))
        for (final s in g)
          if (s != stem && s.length > 1) s,
  ];

  static int _hash(String s) {
    var h = 0x811C9DC5; // FNV-1a, 32-bit
    for (final c in s.codeUnits) {
      h = ((h ^ c) * 0x01000193) & 0x7FFFFFFF;
    }
    return h;
  }

  static const _stop = {
    'با', 'و', 'از', 'در', 'به', 'برای', 'یک', 'غذا', 'وعده', 'خوراک',
    'with', 'and', 'the', 'of', 'in', 'a', 'on', 'for', 'meal', 'food',
  };

  static final _syn = [
    for (final g in _synonyms) [for (final s in g) _stem(s)],
  ];

  static const _synonyms = <List<String>>[
    ['مرغ', 'جوجه', 'chicken', 'سینه'],
    ['ماهی', 'قزل', 'سالمون', 'تن', 'fish', 'trout', 'tuna', 'salmon'],
    ['میگو', 'shrimp', 'prawn', 'prawns', 'seafood'],
    ['گوشت', 'گوسفند', 'بره', 'گاو', 'beef', 'lamb', 'meat', 'ماهیچه'],
    ['تخم', 'تخمرغ', 'نیمرو', 'املت', 'egg', 'omelet', 'eggs'],
    ['ماست', 'دوغ', 'yogurt'],
    ['عدس', 'lentil', 'ماش', 'حبوبات', 'لپه'],
    ['نخود', 'chickpea', 'لوبیا', 'باقلا'],
    ['برنج', 'پلو', 'چلو', 'rice', 'ته', 'تهدیگ', 'tahdig'],
    ['سالاد', 'salad'],
    ['سوپ', 'آش', 'soup'],
    ['چای', 'دمنوش', 'tea'],
    ['کباب', 'kabab', 'kebab', 'کوبیده', 'برگ'],
    ['خورش', 'خورشت', 'stew', 'khoresh'],
    ['کوکو', 'kuku', 'کتلت', 'patties', 'frittata'],
    ['بادمجان', 'eggplant'],
    ['سبزی', 'herb', 'herbs', 'سبزیجات', 'vegetable', 'vegetables'],
    ['نان', 'bread', 'لواش', 'سنگک', 'بربری', 'تافتون'],
    ['پنیر', 'cheese', 'فتا'],
    ['شیر', 'milk', 'لبنیات', 'dairy'],
    ['سیب', 'apple', 'میوه', 'fruit'],
    ['گردو', 'بادام', 'مغز', 'آجیل', 'nuts', 'walnut', 'almond', 'پسته'],
    ['خرما', 'dates', 'date'],
    ['انار', 'pomegranate'],
    ['زعفران', 'saffron'],
    ['حلیم', 'haleem', 'فرنی', 'oatmeal', 'oats', 'جو', 'porridge'],
    ['کیک', 'cake', 'شیرینی', 'دسر', 'dessert', 'حلوا'],
    ['آب', 'water', 'نوشیدنی'],
    ['زمینی', 'potato', 'potatoes'],
    ['کدو', 'zucchini'],
    ['قارچ', 'mushroom'],
    ['پروتئین', 'protein'],
  ];
}
