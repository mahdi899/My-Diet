import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One bundled photo (see `tool/build_photo_manifest.py`).
@immutable
class PhotoEntry {
  const PhotoEntry({
    required this.id,
    required this.path,
    required this.thumb,
    required this.title,
    required this.category,
    required this.kind,
    required this.tags,
    required this.color,
    this.width = 0,
    this.height = 0,
  });

  factory PhotoEntry.fromJson(Map<String, dynamic> j) => PhotoEntry(
    id: j['id'] as String,
    path: j['path'] as String,
    thumb: j['thumb'] as String,
    title: j['title'] as String,
    category: j['category'] as String,
    kind: j['kind'] as String,
    tags: List<String>.unmodifiable((j['tags'] as List).cast<String>()),
    color: _hex(j['color'] as String? ?? '#CCCCCC'),
    width: (j['w'] as num?)?.toInt() ?? 0,
    height: (j['h'] as num?)?.toInt() ?? 0,
  );

  final String id;

  /// Asset path of the 900px image, e.g. `assets/photo/food/x.jpg`.
  final String path;

  /// Asset path of the 400px thumbnail.
  final String thumb;

  /// Persian title.
  final String title;

  /// breakfast | lunch | dinner | snack | dessert | drink |
  /// ingredient | expert | lifestyle
  final String category;

  /// Folder: food | expert | lifestyle | ingredient
  final String kind;
  final List<String> tags;

  /// Approximate dominant colour, handy as a placeholder.
  final Color color;
  final int width, height;

  bool get isFood => kind == 'food';

  static Color _hex(String s) =>
      Color(0xFF000000 | int.parse(s.replaceFirst('#', ''), radix: 16));
}

/// All photos from `assets/photo/manifest.json`.
class PhotoManifest {
  PhotoManifest(Iterable<PhotoEntry> items)
    : items = List.unmodifiable(items),
      byId = {for (final e in items) e.id: e};

  factory PhotoManifest.fromJson(Map<String, dynamic> j) => PhotoManifest(
    (j['items'] as List).map(
      (e) => PhotoEntry.fromJson((e as Map).cast<String, dynamic>()),
    ),
  );

  static const assetPath = 'assets/photo/manifest.json';

  final List<PhotoEntry> items;
  final Map<String, PhotoEntry> byId;

  static Future<PhotoManifest> load({AssetBundle? bundle}) async {
    final raw = await (bundle ?? rootBundle).loadString(assetPath);
    return PhotoManifest.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  PhotoEntry? operator [](String id) => byId[id];

  List<PhotoEntry> inCategory(String category) =>
      items.where((e) => e.category == category).toList(growable: false);

  List<PhotoEntry> ofKind(String kind) =>
      items.where((e) => e.kind == kind).toList(growable: false);

  Map<String, int> get countsByCategory {
    final out = <String, int>{};
    for (final e in items) {
      out[e.category] = (out[e.category] ?? 0) + 1;
    }
    return out;
  }
}
