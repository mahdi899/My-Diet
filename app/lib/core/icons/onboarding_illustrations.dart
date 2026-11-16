part of 'diet_icon.dart';

/// Small illustrations on a 64-unit artboard. Rounded emerald contours, filled
/// clothing and secondary mint planes keep the figures legible at card size.
class _OnboardingIllustration {
  _OnboardingIllustration(this.canvas, this.ink, this.accent, this.tint);

  final Canvas canvas;
  final Color ink, accent, tint;
  bool get mono => tint == Colors.transparent;
  Color get paper => mono ? Colors.transparent : const Color(0xFFF8FCF9);
  Color get soft =>
      mono ? Colors.transparent : Color.lerp(accent, Colors.white, .72)!;

  Paint stroke([Color? color, double width = 2.3]) => Paint()
    ..color = color ?? ink
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  void shape(Path path, {Color? fill, Color? color, double width = 2.3}) {
    canvas.drawPath(path, Paint()..color = fill ?? tint);
    canvas.drawPath(path, stroke(color, width));
  }

  void line(
    double x1,
    double y1,
    double x2,
    double y2, {
    Color? color,
    double width = 2.3,
  }) => canvas.drawLine(Offset(x1, y1), Offset(x2, y2), stroke(color, width));

  void curve(Path path, {Color? color, double width = 2.3}) =>
      canvas.drawPath(path, stroke(color, width));

  void rect(
    double x,
    double y,
    double w,
    double h, {
    double radius = 3,
    Color? fill,
    Color? color,
    double width = 2.3,
  }) {
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(x, y, w, h),
      Radius.circular(radius),
    );
    canvas.drawRRect(r, Paint()..color = fill ?? tint);
    canvas.drawRRect(r, stroke(color, width));
  }

  void circle(
    double x,
    double y,
    double r, {
    Color? fill,
    Color? color,
    double width = 2.3,
  }) {
    canvas.drawCircle(Offset(x, y), r, Paint()..color = fill ?? tint);
    canvas.drawCircle(Offset(x, y), r, stroke(color, width));
  }

  void ground() {
    line(5, 59, 58, 59, color: soft, width: 1.8);
  }

  void head(double x, double y, {bool helmet = false}) {
    // A shaped face, hairline and neck rather than a hollow stick-figure head.
    shape(
      Path()
        ..moveTo(x - 5, y - 1)
        ..cubicTo(x - 6, y - 10, x + 8, y - 10, x + 7, y - 1)
        ..lineTo(x + 8, y + 2)
        ..lineTo(x + 5, y + 3)
        ..quadraticBezierTo(x + 3, y + 8, x - 2, y + 5)
        ..lineTo(x - 4, y + 1)
        ..close(),
      fill: paper,
      width: 2,
    );
    shape(
      Path()
        ..moveTo(x - 5, y)
        ..cubicTo(x - 9, y - 10, x + 6, y - 13, x + 7, y - 3)
        ..quadraticBezierTo(x + 2, y - 3, x, y - 6)
        ..lineTo(x - 2, y)
        ..close(),
      fill: helmet ? accent : ink,
      width: 1.6,
    );
    if (helmet) line(x, y - 8, x + 3, y - 4, color: paper, width: 1.3);
  }

  void paint(DietIconKind kind, Size size) {
    canvas.save();
    canvas.scale(size.width / 64, size.height / 64);
    switch (kind) {
      case DietIconKind.seated:
        seated();
      case DietIconKind.walking:
        walking();
      case DietIconKind.cycling:
        cycling();
      case DietIconKind.running:
        running();
      case DietIconKind.strength:
        strength();
      case DietIconKind.person:
      case DietIconKind.female:
      case DietIconKind.male:
        portrait(kind);
      case DietIconKind.leaf:
        plant();
      case DietIconKind.heart:
        heart();
      case DietIconKind.shield:
        shield();
      case DietIconKind.scale:
        scale();
      case DietIconKind.moon:
        moon();
      case DietIconKind.sun:
        sun();
      case DietIconKind.clock:
        clock();
      case DietIconKind.medicine:
        medicine();
      case DietIconKind.pregnancy:
        pregnancy();
      case DietIconKind.wallet:
        wallet();
      case DietIconKind.mealOne:
      case DietIconKind.mealTwo:
      case DietIconKind.mealThree:
      case DietIconKind.mealMore:
        meals(kind);
      case DietIconKind.dairy:
        dairy();
      case DietIconKind.nuts:
        nuts();
      case DietIconKind.egg:
        egg();
      case DietIconKind.wheat:
        wheat();
      case DietIconKind.foodAllergy:
        foodAllergy();
      default:
        break;
    }
    canvas.restore();
  }

  void meals(DietIconKind kind) {
    switch (kind) {
      case DietIconKind.mealOne:
        placeSetting(32, 32, 18);
      case DietIconKind.mealTwo:
        placeSetting(19, 20, 12);
        placeSetting(45, 45, 12);
      case DietIconKind.mealThree:
        placeSetting(32, 14, 10);
        placeSetting(17, 45, 9.5);
        placeSetting(47, 45, 9.5);
      default:
        placeSetting(17, 17, 9);
        placeSetting(47, 17, 9);
        placeSetting(17, 47, 9);
        placeSetting(47, 47, 9);
        circle(54, 54, 8, fill: paper, color: accent, width: 2);
        line(50, 54, 58, 54, color: accent, width: 2);
        line(54, 50, 54, 58, color: accent, width: 2);
    }
  }

  void placeSetting(double x, double y, double r) {
    final unit = r / 18;
    circle(x, y, r, fill: paper, width: 2.2);
    circle(x, y, r * .74, fill: tint, color: soft, width: 1.3);
    shape(
      Path()
        ..moveTo(x - r * .1, y + r * .22)
        ..cubicTo(
          x - r * .25,
          y - r * .3,
          x + r * .25,
          y - r * .55,
          x + r * .51,
          y - r * .45,
        )
        ..cubicTo(
          x + r * .52,
          y - r * .02,
          x + r * .21,
          y + r * .31,
          x - r * .1,
          y + r * .22,
        )
        ..close(),
      fill: accent,
      color: accent,
      width: 1.1,
    );
    curve(
      Path()
        ..moveTo(x - r * .1, y + r * .2)
        ..lineTo(x + r * .31, y - r * .26),
      color: paper,
      width: 1.1,
    );
    circle(x - r * .33, y + r * .2, r * .1, fill: soft, color: soft, width: .8);
    circle(
      x - r * .25,
      y - r * .18,
      r * .09,
      fill: soft,
      color: soft,
      width: .8,
    );
    // Cutlery makes these read as meals rather than a numeric badge.
    final forkX = x - r - 5;
    final knifeX = x + r + 5;
    curve(
      Path()
        ..moveTo(forkX - 2 * unit, y - r * .5)
        ..lineTo(forkX - 2 * unit, y - r * .1)
        ..quadraticBezierTo(forkX, y + r * .12, forkX + 2 * unit, y - r * .1)
        ..lineTo(forkX + 2 * unit, y - r * .5),
      width: 1.5,
    );
    line(forkX, y - r * .5, forkX, y + r * .5, width: 1.5);
    curve(
      Path()
        ..moveTo(knifeX, y + r * .5)
        ..lineTo(knifeX, y - r * .5)
        ..quadraticBezierTo(
          knifeX + 3 * unit,
          y - r * .2,
          knifeX + 2 * unit,
          y + r * .05,
        )
        ..lineTo(knifeX, y + r * .05),
      width: 1.5,
    );
  }

  void dairy() {
    ground();
    shape(
      Path()
        ..moveTo(8, 19)
        ..lineTo(16, 7)
        ..lineTo(33, 7)
        ..lineTo(40, 19)
        ..lineTo(40, 57)
        ..lineTo(8, 57)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    shape(
      Path()
        ..moveTo(16, 7)
        ..lineTo(16, 18)
        ..lineTo(8, 19)
        ..lineTo(32, 19)
        ..lineTo(40, 19)
        ..lineTo(33, 7)
        ..close(),
      fill: soft,
      width: 2,
    );
    line(16, 18, 32, 19, color: paper, width: 1.4);
    line(32, 20, 32, 56, color: soft, width: 1.5);
    rect(11, 27, 18, 21, radius: 4, fill: paper, color: soft, width: 1.5);
    shape(
      Path()
        ..moveTo(20, 31)
        ..cubicTo(18, 35, 15, 37, 15, 40)
        ..cubicTo(15, 47, 25, 47, 25, 40)
        ..cubicTo(25, 37, 22, 35, 20, 31)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.5,
    );
    // A separate glass adds a clear dairy cue at compact size.
    shape(
      Path()
        ..moveTo(38, 31)
        ..lineTo(59, 31)
        ..lineTo(56, 56)
        ..quadraticBezierTo(49, 61, 41, 56)
        ..close(),
      fill: paper,
      width: 2.2,
    );
    shape(
      Path()
        ..moveTo(40, 41)
        ..quadraticBezierTo(48, 38, 58, 42)
        ..lineTo(56, 56)
        ..quadraticBezierTo(49, 60, 42, 56)
        ..close(),
      fill: soft,
      color: soft,
      width: 1.2,
    );
    curve(
      Path()
        ..moveTo(45, 45)
        ..lineTo(46, 53),
      color: paper,
      width: 1.5,
    );
  }

  void nuts() {
    ground();
    // Walnut with the characteristic folded shell.
    shape(
      Path()
        ..moveTo(22, 12)
        ..cubicTo(6, 7, 2, 25, 8, 37)
        ..cubicTo(12, 47, 27, 45, 32, 35)
        ..cubicTo(41, 23, 34, 10, 22, 12)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    curve(
      Path()
        ..moveTo(21, 15)
        ..cubicTo(15, 20, 27, 23, 19, 29)
        ..cubicTo(13, 34, 24, 35, 20, 41),
      color: accent,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(13, 18)
        ..quadraticBezierTo(8, 23, 13, 28)
        ..moveTo(28, 19)
        ..quadraticBezierTo(32, 24, 27, 29)
        ..moveTo(12, 32)
        ..quadraticBezierTo(10, 36, 15, 38),
      color: soft,
      width: 1.6,
    );
    // A peanut: two lobes, a narrow waist and a textured shell.
    shape(
      Path()
        ..moveTo(44, 14)
        ..cubicTo(48, 8, 59, 14, 58, 21)
        ..cubicTo(57, 27, 51, 27, 53, 34)
        ..cubicTo(56, 44, 44, 50, 39, 42)
        ..cubicTo(34, 35, 40, 32, 39, 27)
        ..cubicTo(36, 20, 40, 17, 44, 14)
        ..close(),
      fill: soft,
      width: 2.3,
    );
    curve(
      Path()
        ..moveTo(49, 17)
        ..quadraticBezierTo(52, 22, 46, 27)
        ..quadraticBezierTo(43, 33, 46, 40),
      color: paper,
      width: 1.6,
    );
    line(43, 22, 48, 24, color: accent, width: 1.2);
    line(42, 32, 49, 34, color: accent, width: 1.2);
    // Almond in the foreground.
    shape(
      Path()
        ..moveTo(26, 43)
        ..quadraticBezierTo(39, 39, 43, 54)
        ..quadraticBezierTo(28, 65, 20, 54)
        ..quadraticBezierTo(19, 48, 26, 43)
        ..close(),
      fill: paper,
      width: 2.3,
    );
    curve(
      Path()
        ..moveTo(24, 54)
        ..quadraticBezierTo(30, 47, 37, 52),
      color: accent,
      width: 1.6,
    );
  }

  void egg() {
    ground();
    shape(
      Path()
        ..moveTo(23, 5)
        ..cubicTo(16, 5, 5, 25, 5, 37)
        ..cubicTo(5, 57, 40, 57, 40, 37)
        ..cubicTo(40, 25, 30, 5, 23, 5)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(19, 14)
        ..quadraticBezierTo(11, 24, 11, 33),
      color: paper,
      width: 2.5,
    );
    // The cut egg and round yolk distinguish it from a generic oval.
    canvas.save();
    canvas.translate(44, 40);
    canvas.rotate(.35);
    shape(
      Path()
        ..moveTo(0, -18)
        ..cubicTo(-8, -18, -15, -4, -15, 5)
        ..cubicTo(-15, 23, 15, 23, 15, 5)
        ..cubicTo(15, -4, 8, -18, 0, -18)
        ..close(),
      fill: paper,
      width: 2.5,
    );
    circle(0, 6, 8, fill: soft, color: accent, width: 2);
    curve(
      Path()
        ..moveTo(-4, 4)
        ..quadraticBezierTo(-3, 1, 0, 1),
      color: paper,
      width: 1.6,
    );
    canvas.restore();
  }

  void wheat() {
    ground();
    wheatEar(19, 12, -0.2);
    wheatEar(38, 7, .24);
    // A scored loaf gives the gluten option a second food cue.
    shape(
      Path()
        ..moveTo(32, 57)
        ..lineTo(31, 48)
        ..cubicTo(28, 34, 58, 31, 59, 46)
        ..lineTo(59, 57)
        ..close(),
      fill: paper,
      width: 2.5,
    );
    curve(
      Path()
        ..moveTo(32, 50)
        ..quadraticBezierTo(45, 44, 58, 49),
      color: soft,
      width: 1.6,
    );
    for (final x in [38.0, 46.0, 54.0]) {
      curve(
        Path()
          ..moveTo(x, 39)
          ..quadraticBezierTo(x - 4, 43, x - 1, 46),
        color: accent,
        width: 1.7,
      );
    }
  }

  void wheatEar(double x, double y, double angle) {
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(angle);
    line(0, -3, 0, 44, color: ink, width: 2);
    for (var i = 0; i < 4; i++) {
      final at = i * 7.0;
      for (final side in [-1.0, 1.0]) {
        shape(
          Path()
            ..moveTo(0, at + 7)
            ..quadraticBezierTo(side * 9, at + 5, side * 7, at - 2)
            ..quadraticBezierTo(side * 1, at - 2, 0, at + 7)
            ..close(),
          fill: i.isEven ? soft : tint,
          color: accent,
          width: 1.7,
        );
      }
    }
    canvas.restore();
  }

  void foodAllergy() {
    circle(28, 29, 22, fill: paper, width: 2.6);
    circle(28, 29, 16, fill: tint, color: soft, width: 1.6);
    shape(
      Path()
        ..moveTo(19, 35)
        ..cubicTo(15, 21, 31, 17, 38, 20)
        ..cubicTo(39, 31, 29, 38, 19, 35)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.7,
    );
    curve(
      Path()
        ..moveTo(20, 35)
        ..lineTo(31, 25),
      color: paper,
      width: 1.5,
    );
    shape(
      Path()
        ..moveTo(44, 32)
        ..quadraticBezierTo(46, 29, 48, 32)
        ..lineTo(61, 55)
        ..quadraticBezierTo(63, 59, 58, 59)
        ..lineTo(31, 59)
        ..quadraticBezierTo(27, 59, 29, 55)
        ..close(),
      fill: soft,
      width: 2.4,
    );
    line(45, 40, 45, 48, width: 2.6);
    circle(45, 53, 1.3, fill: ink, color: ink, width: 1);
  }

  void seated() {
    ground();
    // Desk, open laptop and a supported seated posture.
    rect(5, 26, 6, 20, fill: soft, radius: 2);
    rect(7, 44, 22, 4, fill: soft, radius: 2);
    line(10, 48, 8, 58);
    line(25, 48, 27, 58);
    shape(
      Path()
        ..moveTo(16, 39)
        ..lineTo(29, 39)
        ..quadraticBezierTo(34, 39, 34, 44)
        ..lineTo(36, 54)
        ..lineTo(30, 54)
        ..lineTo(27, 46)
        ..lineTo(15, 46)
        ..close(),
      fill: ink,
    );
    rect(29, 53, 12, 5, fill: paper, radius: 2, width: 1.8);
    shape(
      Path()
        ..moveTo(15, 23)
        ..quadraticBezierTo(20, 19, 25, 24)
        ..lineTo(26, 39)
        ..lineTo(14, 39)
        ..lineTo(13, 29)
        ..close(),
      fill: accent,
    );
    head(19, 14);
    curve(
      Path()
        ..moveTo(23, 26)
        ..lineTo(28, 33)
        ..lineTo(38, 33),
      color: paper,
      width: 5,
    );
    curve(
      Path()
        ..moveTo(23, 26)
        ..lineTo(28, 33)
        ..lineTo(38, 33),
      width: 2,
    );
    line(31, 37, 60, 37);
    line(52, 38, 52, 58);
    shape(
      Path()
        ..moveTo(40, 32)
        ..lineTo(36, 21)
        ..lineTo(55, 21)
        ..lineTo(59, 32)
        ..close(),
      fill: soft,
    );
    line(38, 33, 60, 33, width: 1.7);
    circle(48, 26, 1.2, fill: paper, color: paper, width: 1);
    line(10, 21, 10, 18, color: soft, width: 1.6);
  }

  void walking() {
    ground();
    // Two separate trouser legs, sleeves, face and trainers.
    shape(
      Path()
        ..moveTo(27, 35)
        ..lineTo(34, 37)
        ..lineTo(28, 48)
        ..lineTo(21, 56)
        ..lineTo(16, 53)
        ..lineTo(23, 44)
        ..close(),
      fill: soft,
    );
    shape(
      Path()
        ..moveTo(31, 35)
        ..lineTo(37, 35)
        ..lineTo(39, 46)
        ..lineTo(45, 54)
        ..lineTo(39, 57)
        ..lineTo(32, 47)
        ..lineTo(28, 41)
        ..close(),
      fill: ink,
    );
    shape(
      Path()
        ..moveTo(15, 52)
        ..lineTo(21, 55)
        ..lineTo(19, 59)
        ..lineTo(10, 59)
        ..quadraticBezierTo(9, 56, 15, 52)
        ..close(),
      fill: paper,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(40, 53)
        ..lineTo(46, 52)
        ..lineTo(52, 56)
        ..quadraticBezierTo(54, 59, 49, 59)
        ..lineTo(39, 59)
        ..close(),
      fill: paper,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(29, 19)
        ..quadraticBezierTo(34, 17, 38, 23)
        ..lineTo(38, 36)
        ..quadraticBezierTo(31, 41, 25, 35)
        ..lineTo(25, 25)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(29, 24)
        ..lineTo(22, 33)
        ..lineTo(15, 34),
      color: paper,
      width: 5.4,
    );
    curve(
      Path()
        ..moveTo(29, 24)
        ..lineTo(22, 33)
        ..lineTo(15, 34),
      width: 2,
    );
    curve(
      Path()
        ..moveTo(37, 24)
        ..lineTo(43, 30)
        ..lineTo(48, 25),
      color: soft,
      width: 5.4,
    );
    curve(
      Path()
        ..moveTo(37, 24)
        ..lineTo(43, 30)
        ..lineTo(48, 25),
      width: 2,
    );
    head(33, 11);
    line(29, 32, 35, 33, color: paper, width: 1.4);
    line(5, 46, 11, 46, color: soft, width: 1.5);
    line(7, 41, 14, 41, color: soft, width: 1.5);
  }

  void cycling() {
    ground();
    // Spoked wheels and a closed frame keep the bicycle recognizable at 48px.
    for (final x in [13.0, 51.0]) {
      circle(x, 46, 10, fill: paper, width: 2.6);
      circle(x, 46, 6, fill: Colors.transparent, color: soft, width: 1);
      line(x - 6, 46, x + 6, 46, color: soft, width: 1);
      line(x, 40, x, 52, color: soft, width: 1);
    }
    curve(
      Path()
        ..moveTo(13, 46)
        ..lineTo(23, 31)
        ..lineTo(34, 46)
        ..close()
        ..moveTo(23, 31)
        ..lineTo(43, 31)
        ..lineTo(34, 46)
        ..moveTo(51, 46)
        ..lineTo(42, 26)
        ..lineTo(49, 25),
      color: accent,
      width: 2.9,
    );
    line(20, 29, 28, 29, width: 2.6);
    circle(34, 46, 2, fill: paper, width: 1.6);
    line(34, 46, 40, 48, width: 1.7);
    shape(
      Path()
        ..moveTo(26, 16)
        ..lineTo(36, 17)
        ..lineTo(33, 27)
        ..lineTo(23, 27)
        ..quadraticBezierTo(21, 22, 26, 16)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(26, 28)
        ..lineTo(36, 34)
        ..lineTo(31, 42),
      color: paper,
      width: 6,
    );
    curve(
      Path()
        ..moveTo(26, 28)
        ..lineTo(36, 34)
        ..lineTo(31, 42),
      width: 2.2,
    );
    line(29, 43, 35, 44, width: 3);
    curve(
      Path()
        ..moveTo(34, 21)
        ..lineTo(41, 28)
        ..lineTo(48, 26),
      color: soft,
      width: 5,
    );
    curve(
      Path()
        ..moveTo(34, 21)
        ..lineTo(41, 28)
        ..lineTo(48, 26),
      width: 2,
    );
    head(39, 11, helmet: true);
  }

  void running() {
    ground();
    shape(
      Path()
        ..moveTo(27, 32)
        ..lineTo(34, 35)
        ..lineTo(24, 46)
        ..lineTo(13, 43)
        ..lineTo(15, 38)
        ..lineTo(23, 39)
        ..close(),
      fill: soft,
    );
    shape(
      Path()
        ..moveTo(31, 33)
        ..lineTo(38, 33)
        ..lineTo(43, 42)
        ..lineTo(40, 54)
        ..lineTo(34, 53)
        ..lineTo(37, 44)
        ..lineTo(27, 39)
        ..close(),
      fill: ink,
    );
    shape(
      Path()
        ..moveTo(10, 37)
        ..lineTo(16, 38)
        ..lineTo(14, 44)
        ..lineTo(6, 44)
        ..lineTo(5, 42)
        ..close(),
      fill: paper,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(34, 52)
        ..lineTo(41, 52)
        ..lineTo(47, 57)
        ..lineTo(47, 59)
        ..lineTo(33, 59)
        ..close(),
      fill: paper,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(31, 18)
        ..quadraticBezierTo(37, 16, 42, 22)
        ..lineTo(37, 35)
        ..lineTo(26, 32)
        ..lineTo(27, 23)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(31, 22)
        ..lineTo(21, 20)
        ..lineTo(16, 26),
      color: paper,
      width: 5.2,
    );
    curve(
      Path()
        ..moveTo(31, 22)
        ..lineTo(21, 20)
        ..lineTo(16, 26),
      width: 2,
    );
    curve(
      Path()
        ..moveTo(39, 24)
        ..lineTo(47, 28)
        ..lineTo(54, 20),
      color: soft,
      width: 5.2,
    );
    curve(
      Path()
        ..moveTo(39, 24)
        ..lineTo(47, 28)
        ..lineTo(54, 20),
      width: 2,
    );
    head(39, 10);
    line(6, 13, 17, 13, color: soft, width: 1.8);
    line(4, 19, 12, 19, color: accent, width: 1.8);
    line(4, 31, 10, 31, color: soft, width: 1.8);
  }

  void strength() {
    ground();
    // An athlete lifting a barbell, with paired weight plates and a full body.
    shape(
      Path()
        ..moveTo(22, 45)
        ..lineTo(31, 45)
        ..lineTo(29, 57)
        ..lineTo(22, 57)
        ..close(),
      fill: ink,
    );
    shape(
      Path()
        ..moveTo(33, 45)
        ..lineTo(42, 45)
        ..lineTo(42, 57)
        ..lineTo(35, 57)
        ..close(),
      fill: soft,
    );
    rect(19, 55, 11, 4, fill: paper, radius: 1.5, width: 1.8);
    rect(34, 55, 11, 4, fill: paper, radius: 1.5, width: 1.8);
    curve(
      Path()
        ..moveTo(23, 32)
        ..lineTo(15, 26)
        ..lineTo(14, 16),
      color: paper,
      width: 6,
    );
    curve(
      Path()
        ..moveTo(23, 32)
        ..lineTo(15, 26)
        ..lineTo(14, 16),
      width: 2.2,
    );
    curve(
      Path()
        ..moveTo(41, 32)
        ..lineTo(49, 26)
        ..lineTo(50, 16),
      color: paper,
      width: 6,
    );
    curve(
      Path()
        ..moveTo(41, 32)
        ..lineTo(49, 26)
        ..lineTo(50, 16),
      width: 2.2,
    );
    shape(
      Path()
        ..moveTo(23, 29)
        ..lineTo(28, 27)
        ..lineTo(36, 27)
        ..lineTo(41, 29)
        ..lineTo(43, 46)
        ..quadraticBezierTo(32, 51, 21, 46)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(27, 30)
        ..quadraticBezierTo(32, 36, 37, 30),
      color: paper,
      width: 1.8,
    );
    line(31, 39, 34, 39, color: paper, width: 1.6);
    head(31, 20);
    line(4, 12, 60, 12, width: 3);
    for (final x in [7.0, 50.0]) {
      rect(x, 4, 7, 17, fill: soft, radius: 2, width: 2);
      line(x + 3.5, 8, x + 3.5, 17, color: paper, width: 1.4);
    }
    line(3, 8, 3, 17, color: accent, width: 2.4);
    line(61, 8, 61, 17, color: accent, width: 2.4);
  }

  void portrait(DietIconKind kind) {
    final female = kind == DietIconKind.female;
    ground();
    if (female) {
      shape(
        Path()
          ..moveTo(16, 32)
          ..lineTo(16, 21)
          ..cubicTo(16, 1, 48, 1, 48, 21)
          ..lineTo(50, 37)
          ..lineTo(14, 37)
          ..close(),
        fill: ink,
      );
    }
    shape(
      Path()
        ..moveTo(9, 58)
        ..lineTo(10, 48)
        ..quadraticBezierTo(10, 38, 25, 36)
        ..lineTo(39, 36)
        ..quadraticBezierTo(54, 38, 54, 48)
        ..lineTo(55, 58)
        ..close(),
      fill: soft,
    );
    shape(
      Path()
        ..moveTo(26, 29)
        ..lineTo(26, 39)
        ..quadraticBezierTo(32, 46, 38, 39)
        ..lineTo(38, 29)
        ..close(),
      fill: paper,
      width: 2,
    );
    shape(
      Path()
        ..moveTo(21, 18)
        ..cubicTo(20, 7, 44, 7, 43, 18)
        ..lineTo(42, 28)
        ..quadraticBezierTo(32, 43, 22, 28)
        ..close(),
      fill: paper,
      width: 2.2,
    );
    shape(
      Path()
        ..moveTo(20, 21)
        ..cubicTo(15, 3, 46, 1, 44, 20)
        ..quadraticBezierTo(37, 19, 32, 13)
        ..quadraticBezierTo(27, 20, 20, 21)
        ..close(),
      fill: ink,
      width: 1.7,
    );
    line(26, 25, 27, 25, width: 1.5);
    line(37, 25, 38, 25, width: 1.5);
    curve(
      Path()
        ..moveTo(29, 31)
        ..quadraticBezierTo(32, 33, 35, 31),
      color: accent,
      width: 1.5,
    );
    if (female) {
      curve(
        Path()
          ..moveTo(20, 42)
          ..quadraticBezierTo(32, 54, 44, 42),
        color: accent,
        width: 2,
      );
    } else {
      curve(
        Path()
          ..moveTo(24, 38)
          ..lineTo(32, 46)
          ..lineTo(40, 38),
        color: accent,
        width: 2,
      );
      line(32, 46, 32, 56, color: accent, width: 1.6);
    }
    line(18, 50, 18, 57, width: 1.6);
    line(46, 50, 46, 57, width: 1.6);
  }

  void plant() {
    ground();
    shape(
      Path()
        ..moveTo(21, 48)
        ..cubicTo(12, 50, 4, 40, 8, 31)
        ..cubicTo(24, 27, 32, 36, 28, 46)
        ..close(),
      fill: soft,
    );
    shape(
      Path()
        ..moveTo(31, 36)
        ..cubicTo(26, 18, 41, 9, 57, 11)
        ..cubicTo(58, 29, 48, 42, 31, 36)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(20, 57)
        ..quadraticBezierTo(29, 37, 46, 22),
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(26, 46)
        ..lineTo(16, 38),
      color: ink,
      width: 1.8,
    );
    curve(
      Path()
        ..moveTo(37, 31)
        ..lineTo(47, 30)
        ..moveTo(37, 31)
        ..lineTo(37, 22),
      color: paper,
      width: 1.6,
    );
    line(9, 19, 9, 25, color: soft, width: 1.5);
    line(6, 22, 12, 22, color: soft, width: 1.5);
  }

  void heart() {
    shape(
      Path()
        ..moveTo(32, 56)
        ..cubicTo(23, 50, 5, 36, 5, 21)
        ..cubicTo(5, 5, 24, 1, 32, 15)
        ..cubicTo(40, 1, 59, 5, 59, 21)
        ..cubicTo(59, 36, 41, 50, 32, 56)
        ..close(),
      fill: tint,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(12, 29)
        ..lineTo(22, 29)
        ..lineTo(27, 20)
        ..lineTo(35, 40)
        ..lineTo(41, 29)
        ..lineTo(52, 29),
      color: accent,
      width: 3,
    );
    curve(
      Path()
        ..moveTo(13, 20)
        ..quadraticBezierTo(14, 13, 20, 13),
      color: soft,
      width: 2.2,
    );
  }

  void shield() {
    shape(
      Path()
        ..moveTo(32, 5)
        ..quadraticBezierTo(43, 12, 56, 13)
        ..lineTo(54, 34)
        ..quadraticBezierTo(50, 50, 32, 59)
        ..quadraticBezierTo(14, 50, 10, 34)
        ..lineTo(8, 13)
        ..quadraticBezierTo(21, 12, 32, 5)
        ..close(),
      fill: tint,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(32, 12)
        ..quadraticBezierTo(40, 17, 49, 18)
        ..lineTo(47, 33)
        ..quadraticBezierTo(44, 44, 32, 51),
      color: soft,
      width: 2,
    );
    circle(30, 30, 12, fill: paper, color: accent, width: 2);
    curve(
      Path()
        ..moveTo(23, 30)
        ..lineTo(28, 35)
        ..lineTo(38, 24),
      color: accent,
      width: 3,
    );
  }

  void scale() {
    rect(9, 6, 46, 52, radius: 10, fill: tint, width: 2.8);
    shape(
      Path()
        ..moveTo(17, 25)
        ..quadraticBezierTo(32, 7, 47, 25)
        ..lineTo(44, 32)
        ..lineTo(20, 32)
        ..close(),
      fill: paper,
      width: 2.2,
    );
    for (final tick in [
      (23.0, 21.0, 25.0, 24.0),
      (32.0, 17.0, 32.0, 21.0),
      (41.0, 21.0, 39.0, 24.0),
    ]) {
      line(tick.$1, tick.$2, tick.$3, tick.$4, color: soft, width: 1.5);
    }
    line(32, 28, 39, 20, color: accent, width: 2.3);
    circle(32, 28, 1.6, fill: accent, color: accent, width: 1);
    for (final x in [21.0, 38.0]) {
      rect(x, 39, 6, 11, radius: 3, fill: soft, color: soft, width: 1);
      circle(x + 2, 36, 1.4, fill: soft, color: soft, width: 1);
    }
    line(17, 54, 47, 54, color: soft, width: 1.4);
  }

  void moon() {
    shape(
      Path()
        ..moveTo(43, 9)
        ..cubicTo(24, 19, 31, 44, 53, 43)
        ..cubicTo(40, 66, 7, 53, 8, 31)
        ..cubicTo(8, 15, 25, 3, 43, 9)
        ..close(),
      fill: tint,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(15, 32)
        ..quadraticBezierTo(15, 45, 27, 48),
      color: soft,
      width: 2,
    );
    star(49, 19, 5);
    star(52, 32, 2.8);
    circle(31, 15, 1.5, fill: soft, color: soft, width: 1);
  }

  void star(double x, double y, double r) {
    shape(
      Path()
        ..moveTo(x, y - r)
        ..quadraticBezierTo(x + 1, y - 1, x + r, y)
        ..quadraticBezierTo(x + 1, y + 1, x, y + r)
        ..quadraticBezierTo(x - 1, y + 1, x - r, y)
        ..quadraticBezierTo(x - 1, y - 1, x, y - r)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.4,
    );
  }

  void sun() {
    circle(32, 32, 15, fill: tint, width: 2.8);
    circle(32, 32, 10, fill: paper, color: soft, width: 1.6);
    curve(
      Path()
        ..moveTo(25, 29)
        ..quadraticBezierTo(27, 25, 30, 24),
      color: accent,
      width: 2.3,
    );
    for (final ray in [
      (32.0, 5.0, 32.0, 10.0),
      (32.0, 54.0, 32.0, 59.0),
      (5.0, 32.0, 10.0, 32.0),
      (54.0, 32.0, 59.0, 32.0),
      (13.0, 13.0, 17.0, 17.0),
      (47.0, 47.0, 51.0, 51.0),
      (13.0, 51.0, 17.0, 47.0),
      (47.0, 17.0, 51.0, 13.0),
    ]) {
      line(ray.$1, ray.$2, ray.$3, ray.$4, color: accent, width: 2.7);
    }
  }

  void clock() {
    circle(32, 33, 24, fill: tint, width: 2.8);
    circle(32, 33, 18, fill: paper, color: soft, width: 1.7);
    line(32, 18, 32, 21, width: 1.8);
    line(32, 45, 32, 48, width: 1.8);
    line(17, 33, 20, 33, width: 1.8);
    line(44, 33, 47, 33, width: 1.8);
    curve(
      Path()
        ..moveTo(32, 24)
        ..lineTo(32, 33)
        ..lineTo(41, 38),
      color: accent,
      width: 3,
    );
    circle(32, 33, 2, fill: accent, color: accent, width: 1);
    line(26, 5, 38, 5, width: 2.6);
    line(32, 5, 32, 9, width: 2);
    line(48, 13, 52, 9, color: accent, width: 2.4);
  }

  void medicine() {
    rect(9, 8, 30, 48, radius: 6, fill: tint, width: 2.6);
    rect(14, 4, 20, 8, radius: 2, fill: soft, width: 2.2);
    for (final x in [19.0, 24.0, 29.0]) {
      line(x, 6, x, 9, color: paper, width: 1.3);
    }
    rect(9, 24, 30, 19, radius: 1, fill: paper, color: soft, width: 1.4);
    line(18, 33, 29, 33, color: accent, width: 3);
    line(23.5, 28, 23.5, 38, color: accent, width: 3);
    canvas.save();
    canvas.translate(47, 43);
    canvas.rotate(.55);
    rect(-7, -15, 14, 30, radius: 7, fill: paper, width: 2.4);
    shape(
      Path()
        ..moveTo(-7, 0)
        ..lineTo(7, 0)
        ..lineTo(7, 8)
        ..cubicTo(7, 17, -7, 17, -7, 8)
        ..close(),
      fill: soft,
      width: 2.2,
    );
    line(-3, -8, -3, -3, color: soft, width: 1.8);
    canvas.restore();
  }

  void pregnancy() {
    ground();
    shape(
      Path()
        ..moveTo(20, 19)
        ..cubicTo(19, 5, 40, 2, 41, 18)
        ..lineTo(42, 30)
        ..lineTo(19, 30)
        ..close(),
      fill: ink,
      width: 2,
    );
    shape(
      Path()
        ..moveTo(24, 21)
        ..quadraticBezierTo(35, 17, 38, 28)
        ..cubicTo(59, 34, 54, 51, 37, 49)
        ..lineTo(39, 58)
        ..lineTo(17, 58)
        ..lineTo(21, 43)
        ..lineTo(19, 29)
        ..close(),
      fill: soft,
    );
    head(29, 13);
    curve(
      Path()
        ..moveTo(27, 29)
        ..lineTo(28, 39)
        ..quadraticBezierTo(35, 44, 46, 42),
      color: paper,
      width: 6,
    );
    curve(
      Path()
        ..moveTo(27, 29)
        ..lineTo(28, 39)
        ..quadraticBezierTo(35, 44, 46, 42),
      width: 2,
    );
    curve(
      Path()
        ..moveTo(39, 30)
        ..quadraticBezierTo(47, 32, 48, 37),
      color: accent,
      width: 1.8,
    );
    line(23, 51, 35, 52, color: accent, width: 1.5);
  }

  void wallet() {
    shape(
      Path()
        ..moveTo(11, 22)
        ..lineTo(47, 8)
        ..lineTo(52, 30)
        ..lineTo(15, 38)
        ..close(),
      fill: soft,
    );
    shape(
      Path()
        ..moveTo(18, 18)
        ..lineTo(48, 12)
        ..lineTo(51, 25)
        ..lineTo(21, 31)
        ..close(),
      fill: paper,
      width: 1.5,
    );
    circle(35, 21, 4, fill: tint, color: accent, width: 1.5);
    rect(7, 24, 49, 32, radius: 6, fill: tint, width: 2.8);
    line(13, 29, 48, 29, color: soft, width: 1.4);
    rect(39, 34, 20, 12, radius: 4, fill: soft, width: 2.2);
    circle(46, 40, 2, fill: ink, color: ink, width: 1);
    line(13, 51, 29, 51, color: soft, width: 1.5);
  }
}
