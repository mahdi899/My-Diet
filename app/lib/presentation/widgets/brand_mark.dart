import 'package:flutter/material.dart';

/// Approved identity: concept 09, the growing Persian «م».
class SabzineMark extends StatelessWidget {
  const SabzineMark({super.key, this.size = 104, this.color});
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/brand/symbol.png',
    width: size,
    height: size,
    fit: BoxFit.contain,
    color: color,
    colorBlendMode: BlendMode.srcIn,
    semanticLabel: 'نشان رژیم من',
    filterQuality: FilterQuality.high,
  );
}

/// The approved lettering is an asset, so its shape does not depend on a font.
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.width = 144, this.color});

  final double width;
  final Color? color;

  @override
  Widget build(BuildContext context) => Center(
    child: Image.asset(
      'assets/brand/wordmark.png',
      width: width,
      height: width * 388 / 1200,
      fit: BoxFit.contain,
      color: color,
      colorBlendMode: BlendMode.srcIn,
      semanticLabel: 'رژیم من',
      filterQuality: FilterQuality.high,
    ),
  );
}
