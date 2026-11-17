part of 'diet_icon.dart';

extension _QuestionnaireIllustrations on _OnboardingIllustration {
  void questionnaireTopic(DietIconKind kind) {
    switch (kind) {
      case DietIconKind.balancedMeal:
      case DietIconKind.vegetarianMeal:
      case DietIconKind.veganMeal:
        nutritionPlate(kind);
      case DietIconKind.bloodSugar:
        glucoseMeter();
      case DietIconKind.bloodPressure:
        pressureMonitor();
      case DietIconKind.kidneys:
        kidneys();
      case DietIconKind.thyroid:
        thyroid();
      case DietIconKind.stomach:
        stomach();
      case DietIconKind.bloodDrop:
        bloodDrop();
      case DietIconKind.medicalNotes:
        medicalNotes();
      case DietIconKind.cookingPot:
        cookingPot();
      case DietIconKind.calendar:
        calendar();
      case DietIconKind.standing:
        standing();
      case DietIconKind.workout:
        workout();
      case DietIconKind.slowPace:
        turtle();
      case DietIconKind.steadyPace:
        footsteps();
      case DietIconKind.snack:
        snack();
      case DietIconKind.sweets:
        sweets();
      case DietIconKind.stress:
        stress();
      case DietIconKind.irregularMeals:
        calendar(irregular: true);
      case DietIconKind.sunrise:
        horizon(false);
      case DietIconKind.sunset:
        horizon(true);
      case DietIconKind.fastFood:
        fastFood();
      case DietIconKind.firstPlan:
      case DietIconKind.weightReturn:
      case DietIconKind.pausedPlan:
        planHistory(kind);
      case DietIconKind.goalReached:
        trophy();
      case DietIconKind.question:
        question();
      case DietIconKind.baby:
        babies();
      case DietIconKind.babyBottle:
        babyBottle();
      case DietIconKind.breastfeeding:
        breastfeeding();
      case DietIconKind.vitamin:
        vitamin();
      case DietIconKind.nausea:
        nausea();
      case DietIconKind.heartburn:
        stomach(burning: true);
      case DietIconKind.intestines:
        intestines();
      case DietIconKind.bed:
        bed();
      case DietIconKind.fruitBasket:
        fruitBasket();
      case DietIconKind.homeCooking:
        homeCooking();
      default:
        break;
    }
  }

  void badge(int count, {bool crossed = false}) {
    if (crossed) {
      line(9, 54, 55, 9, color: paper, width: 6);
      line(9, 54, 55, 9, color: accent, width: 2.5);
      return;
    }
    for (var i = 0; i < count.clamp(0, 4); i++) {
      circle(24 + i * 6, 59, 1.3, fill: accent, color: accent, width: 1);
    }
  }

  void nutritionPlate(DietIconKind kind) {
    circle(32, 32, 24, fill: paper, width: 2.5);
    circle(32, 32, 18, fill: tint, color: soft, width: 1.5);
    line(32, 15, 32, 49, color: soft, width: 1.4);
    line(33, 32, 49, 32, color: soft, width: 1.4);
    // Grain, vegetables and a protein source share a divided plate.
    for (final p in [(39.0, 39.0), (44.0, 38.0), (40.0, 44.0), (45.0, 43.0)]) {
      line(p.$1, p.$2, p.$1 + 1, p.$2 - 2, color: accent, width: 1.5);
    }
    shape(
      Path()
        ..moveTo(35, 27)
        ..quadraticBezierTo(34, 16, 45, 19)
        ..quadraticBezierTo(48, 27, 35, 27)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.4,
    );
    line(36, 26, 42, 21, color: paper, width: 1);
    if (kind == DietIconKind.balancedMeal) {
      shape(
        Path()
          ..moveTo(16, 28)
          ..cubicTo(14, 18, 29, 18, 28, 27)
          ..lineTo(25, 40)
          ..quadraticBezierTo(16, 44, 16, 35)
          ..close(),
        fill: soft,
        width: 1.8,
      );
      line(20, 26, 25, 28, color: accent, width: 1.5);
      line(19, 31, 24, 33, color: accent, width: 1.5);
    } else if (kind == DietIconKind.vegetarianMeal) {
      shape(
        Path()
          ..moveTo(22, 20)
          ..cubicTo(16, 20, 12, 32, 16, 38)
          ..cubicTo(22, 45, 31, 38, 28, 31)
          ..quadraticBezierTo(26, 20, 22, 20)
          ..close(),
        fill: paper,
        width: 1.8,
      );
      circle(22, 33, 4, fill: soft, color: accent, width: 1.4);
    } else {
      for (final p in [(21.0, 24.0), (19.0, 34.0)]) {
        shape(
          Path()
            ..moveTo(p.$1, p.$2 + 5)
            ..quadraticBezierTo(p.$1 - 7, p.$2 - 6, p.$1 + 7, p.$2 - 4)
            ..quadraticBezierTo(p.$1 + 8, p.$2 + 5, p.$1, p.$2 + 5)
            ..close(),
          fill: soft,
          color: accent,
          width: 1.6,
        );
        line(p.$1, p.$2 + 4, p.$1 + 3, p.$2 - 1, color: paper, width: 1);
      }
    }
    line(3, 18, 3, 47, width: 1.7);
    curve(
      Path()
        ..moveTo(1, 18)
        ..lineTo(1, 26)
        ..quadraticBezierTo(3, 29, 5, 26)
        ..lineTo(5, 18),
      width: 1.4,
    );
    curve(
      Path()
        ..moveTo(60, 47)
        ..lineTo(60, 18)
        ..quadraticBezierTo(64, 24, 62, 31)
        ..lineTo(60, 31),
      width: 1.7,
    );
  }

  void drop(double x, double y, double r, {Color? fill}) {
    shape(
      Path()
        ..moveTo(x, y - r)
        ..cubicTo(x - r * .4, y - r * .3, x - r, y, x - r, y + r * .35)
        ..cubicTo(x - r, y + r * 1.5, x + r, y + r * 1.5, x + r, y + r * .35)
        ..cubicTo(x + r, y, x + r * .4, y - r * .3, x, y - r)
        ..close(),
      fill: fill ?? soft,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(x - r * .5, y + r * .1)
        ..quadraticBezierTo(x - r * .7, y + r * .5, x - r * .3, y + r * .7),
      color: paper,
      width: 1.5,
    );
  }

  void glucoseMeter() {
    rect(23, 3, 12, 15, fill: paper, radius: 2, width: 2);
    line(27, 5, 27, 11, color: soft, width: 1.3);
    line(31, 5, 31, 11, color: soft, width: 1.3);
    rect(10, 14, 38, 45, fill: tint, radius: 8, width: 2.6);
    rect(16, 21, 26, 19, fill: paper, radius: 3, width: 1.8);
    line(20, 28, 24, 28, color: accent, width: 2);
    line(29, 28, 37, 28, color: accent, width: 2);
    line(20, 34, 35, 34, color: soft, width: 1.4);
    circle(29, 49, 4, fill: soft, color: accent, width: 1.8);
    drop(51, 43, 8);
  }

  void pressureMonitor() {
    rect(5, 28, 39, 29, fill: tint, radius: 7, width: 2.6);
    rect(10, 33, 28, 15, fill: paper, radius: 3, width: 1.6);
    curve(
      Path()
        ..moveTo(14, 41)
        ..lineTo(19, 41)
        ..lineTo(21, 37)
        ..lineTo(25, 45)
        ..lineTo(28, 40)
        ..lineTo(34, 40),
      color: accent,
      width: 1.8,
    );
    circle(35, 52, 1.6, fill: accent, color: accent, width: 1);
    curve(
      Path()
        ..moveTo(44, 49)
        ..cubicTo(65, 55, 63, 26, 48, 26),
      color: accent,
      width: 2,
    );
    rect(24, 7, 28, 18, fill: soft, radius: 5, width: 2.3);
    line(34, 8, 34, 24, color: paper, width: 1.5);
    line(44, 8, 44, 24, color: paper, width: 1.5);
    line(10, 21, 17, 14, color: soft, width: 1.5);
  }

  void kidneys() {
    for (final mirror in [false, true]) {
      canvas.save();
      if (mirror) {
        canvas.translate(64, 0);
        canvas.scale(-1, 1);
      }
      shape(
        Path()
          ..moveTo(22, 9)
          ..cubicTo(5, 3, 0, 37, 14, 44)
          ..cubicTo(26, 51, 30, 37, 22, 32)
          ..cubicTo(13, 26, 32, 23, 22, 9)
          ..close(),
        fill: tint,
        width: 2.6,
      );
      curve(
        Path()
          ..moveTo(18, 16)
          ..cubicTo(10, 14, 8, 34, 16, 37),
        color: soft,
        width: 2,
      );
      curve(
        Path()
          ..moveTo(22, 26)
          ..quadraticBezierTo(29, 28, 28, 44)
          ..lineTo(28, 51),
        color: accent,
        width: 2,
      );
      canvas.restore();
    }
    shape(
      Path()
        ..moveTo(25, 51)
        ..quadraticBezierTo(32, 47, 39, 51)
        ..quadraticBezierTo(39, 61, 32, 61)
        ..quadraticBezierTo(25, 61, 25, 51)
        ..close(),
      fill: soft,
      width: 2,
    );
  }

  void thyroid() {
    curve(
      Path()
        ..moveTo(20, 5)
        ..lineTo(20, 17)
        ..quadraticBezierTo(17, 27, 7, 30)
        ..moveTo(44, 5)
        ..lineTo(44, 17)
        ..quadraticBezierTo(47, 27, 57, 30),
      color: soft,
      width: 2,
    );
    rect(28, 15, 8, 38, fill: paper, radius: 4, color: soft, width: 1.7);
    for (final y in [22.0, 29.0, 36.0, 43.0]) {
      line(29, y, 35, y, color: soft, width: 1.3);
    }
    shape(
      Path()
        ..moveTo(29, 30)
        ..cubicTo(18, 10, 10, 19, 13, 37)
        ..cubicTo(16, 51, 27, 51, 30, 39)
        ..lineTo(34, 39)
        ..cubicTo(37, 51, 48, 51, 51, 37)
        ..cubicTo(54, 19, 46, 10, 35, 30)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(21, 26)
        ..quadraticBezierTo(16, 35, 23, 41)
        ..moveTo(43, 26)
        ..quadraticBezierTo(48, 35, 41, 41),
      color: accent,
      width: 1.8,
    );
  }

  void stomach({bool burning = false}) {
    shape(
      Path()
        ..moveTo(25, 5)
        ..lineTo(25, 20)
        ..quadraticBezierTo(24, 29, 33, 29)
        ..cubicTo(38, 29, 35, 17, 46, 20)
        ..cubicTo(63, 25, 59, 48, 45, 54)
        ..cubicTo(26, 63, 10, 48, 12, 37)
        ..lineTo(12, 29)
        ..lineTo(19, 29)
        ..lineTo(19, 5)
        ..close(),
      fill: tint,
      width: 2.7,
    );
    curve(
      Path()
        ..moveTo(43, 27)
        ..cubicTo(53, 31, 49, 47, 39, 49),
      color: accent,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(18, 36)
        ..quadraticBezierTo(16, 44, 25, 49),
      color: soft,
      width: 2,
    );
    if (burning) {
      shape(
        Path()
          ..moveTo(35, 45)
          ..cubicTo(23, 39, 34, 29, 34, 24)
          ..quadraticBezierTo(43, 31, 40, 35)
          ..quadraticBezierTo(44, 33, 44, 31)
          ..cubicTo(51, 40, 42, 48, 35, 45)
          ..close(),
        fill: accent,
        color: accent,
        width: 1.6,
      );
      curve(
        Path()
          ..moveTo(36, 40)
          ..quadraticBezierTo(34, 38, 37, 35),
        color: paper,
        width: 1.5,
      );
    } else if (variant == 2) {
      line(4, 20, 10, 23, color: accent, width: 1.8);
      line(3, 28, 8, 28, color: accent, width: 1.8);
      line(54, 10, 51, 16, color: accent, width: 1.8);
    }
  }

  void bloodDrop() {
    drop(29, 28, 22, fill: tint);
    for (final p in [(22.0, 33.0), (36.0, 35.0), (29.0, 46.0)]) {
      canvas.drawOval(
        Rect.fromCenter(center: Offset(p.$1, p.$2), width: 11, height: 7),
        Paint()..color = soft,
      );
      canvas.drawOval(
        Rect.fromCenter(center: Offset(p.$1, p.$2), width: 11, height: 7),
        stroke(accent, 1.6),
      );
      line(p.$1 - 2, p.$2, p.$1 + 2, p.$2, color: paper, width: 1.4);
    }
  }

  void paperPage() {
    rect(9, 9, 42, 49, fill: tint, radius: 6, width: 2.5);
    rect(21, 5, 18, 9, fill: soft, radius: 3, width: 2);
    line(17, 28, 42, 28, color: soft, width: 1.7);
    line(17, 35, 35, 35, color: soft, width: 1.7);
    line(17, 42, 39, 42, color: soft, width: 1.7);
    line(17, 49, 30, 49, color: soft, width: 1.7);
  }

  void medicalNotes() {
    paperPage();
    line(19, 19, 28, 19, color: accent, width: 2.6);
    line(23.5, 15, 23.5, 23, color: accent, width: 2.6);
    circle(48, 46, 11, fill: paper, color: accent, width: 2.2);
    line(43, 46, 53, 46, color: accent, width: 2.4);
    line(48, 41, 48, 51, color: accent, width: 2.4);
  }

  void smallClock(double x, double y, double r, int minutes) {
    circle(x, y, r, fill: paper, width: 2);
    final angle = minutes / 60 * math.pi * 2 - math.pi / 2;
    line(
      x,
      y,
      x + math.cos(angle) * r * .65,
      y + math.sin(angle) * r * .65,
      color: accent,
      width: 1.7,
    );
    line(x, y, x - r * .3, y - r * .2, color: accent, width: 1.7);
  }

  void cookingPot() {
    if (variant == 15) {
      quickPrep();
      return;
    }
    if (variant == 30) {
      fryingPan();
      return;
    }
    if (variant >= 60) {
      slowCooking();
      return;
    }
    shape(
      Path()
        ..moveTo(9, 27)
        ..lineTo(52, 27)
        ..lineTo(49, 48)
        ..quadraticBezierTo(31, 60, 12, 48)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(11, 33)
        ..cubicTo(0, 28, 0, 44, 12, 41)
        ..moveTo(51, 33)
        ..cubicTo(63, 28, 63, 44, 50, 41),
      width: 2.2,
    );
    curve(
      Path()
        ..moveTo(7, 26)
        ..quadraticBezierTo(31, 7, 55, 26)
        ..close(),
      color: accent,
      width: 2.6,
    );
    rect(25, 11, 10, 5, fill: soft, radius: 2, width: 1.8);
    line(20, 36, 18, 44, color: paper, width: 2);
    smallClock(48, 48, 12, variant == 0 ? 30 : variant);
    curve(
      Path()
        ..moveTo(16, 16)
        ..quadraticBezierTo(12, 12, 16, 8),
      color: soft,
      width: 1.7,
    );
  }

  void quickPrep() {
    // A chopping board and fresh vegetables: preparation without long cooking.
    shape(
      Path()
        ..moveTo(24, 12)
        ..lineTo(24, 7)
        ..quadraticBezierTo(24, 3, 28, 3)
        ..lineTo(36, 3)
        ..quadraticBezierTo(40, 3, 40, 7)
        ..lineTo(40, 12)
        ..lineTo(49, 12)
        ..quadraticBezierTo(55, 12, 55, 18)
        ..lineTo(55, 54)
        ..quadraticBezierTo(55, 59, 49, 59)
        ..lineTo(13, 59)
        ..quadraticBezierTo(8, 59, 8, 54)
        ..lineTo(8, 18)
        ..quadraticBezierTo(8, 12, 13, 12)
        ..close(),
      fill: tint,
      width: 2.7,
    );
    line(29, 8, 35, 8, color: accent, width: 2);
    line(13, 52, 36, 52, color: soft, width: 1.5);
    // A recognizable knife, with a filled handle and a broad light blade.
    canvas.save();
    canvas.translate(43, 35);
    canvas.rotate(-.25);
    shape(
      Path()
        ..moveTo(-3, -17)
        ..quadraticBezierTo(7, -13, 4, 4)
        ..lineTo(-3, 4)
        ..close(),
      fill: paper,
      width: 2,
    );
    rect(-3, 4, 7, 14, fill: accent, radius: 2, width: 1.8);
    circle(.5, 10, 1, fill: paper, color: paper, width: .8);
    canvas.restore();
    for (final p in [(19.0, 39.0), (27.0, 30.0)]) {
      circle(p.$1, p.$2, 7, fill: soft, color: accent, width: 1.8);
      circle(p.$1, p.$2, 3.8, fill: paper, color: paper, width: 1);
      line(p.$1 - 1, p.$2 - 2, p.$1 + 1, p.$2 + 2, color: soft, width: 1.2);
    }
    shape(
      Path()
        ..moveTo(16, 25)
        ..quadraticBezierTo(11, 16, 22, 17)
        ..quadraticBezierTo(26, 25, 16, 25)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.4,
    );
    line(16, 25, 21, 20, color: paper, width: 1);
  }

  void fryingPan() {
    // A diagonal handle gives this option a different silhouette from both pots.
    shape(
      Path()
        ..moveTo(35, 22)
        ..lineTo(51, 5)
        ..quadraticBezierTo(54, 2, 58, 6)
        ..quadraticBezierTo(61, 9, 58, 12)
        ..lineTo(42, 29)
        ..close(),
      fill: soft,
      width: 2.6,
    );
    line(52, 9, 55, 9, color: paper, width: 1.8);
    circle(26, 37, 23, fill: tint, width: 2.8);
    circle(26, 37, 17, fill: paper, color: accent, width: 1.7);
    shape(
      Path()
        ..moveTo(17, 28)
        ..cubicTo(9, 28, 11, 41, 17, 43)
        ..cubicTo(22, 50, 32, 41, 27, 34)
        ..quadraticBezierTo(28, 25, 17, 28)
        ..close(),
      fill: tint,
      color: soft,
      width: 1.7,
    );
    circle(20, 36, 5, fill: soft, color: accent, width: 1.5);
    shape(
      Path()
        ..moveTo(30, 44)
        ..quadraticBezierTo(27, 32, 39, 31)
        ..quadraticBezierTo(42, 41, 30, 44)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.5,
    );
    line(31, 42, 36, 35, color: paper, width: 1.2);
    curve(
      Path()
        ..moveTo(6, 20)
        ..quadraticBezierTo(3, 17, 6, 13)
        ..moveTo(14, 16)
        ..quadraticBezierTo(11, 12, 14, 8),
      color: soft,
      width: 1.7,
    );
  }

  void slowCooking() {
    // A substantial lidded pot and visible steam convey a longer cooking time.
    shape(
      Path()
        ..moveTo(10, 32)
        ..lineTo(54, 32)
        ..lineTo(51, 51)
        ..quadraticBezierTo(32, 61, 13, 51)
        ..close(),
      fill: tint,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(10, 37)
        ..cubicTo(0, 32, 0, 47, 12, 45)
        ..moveTo(54, 37)
        ..cubicTo(64, 32, 64, 47, 52, 45),
      width: 2.4,
    );
    shape(
      Path()
        ..moveTo(8, 31)
        ..quadraticBezierTo(32, 11, 56, 31)
        ..close(),
      fill: soft,
      width: 2.5,
    );
    rect(27, 19, 10, 5, fill: paper, radius: 2, width: 1.8);
    line(21, 38, 19, 47, color: paper, width: 2.2);
    line(24, 53, 42, 53, color: soft, width: 1.5);
    for (final x in [18.0, 32.0, 46.0]) {
      curve(
        Path()
          ..moveTo(x, 15)
          ..cubicTo(x - 6, 10, x + 5, 8, x, 3),
        color: accent,
        width: 2,
      );
    }
  }

  void economyCoins() {
    // Savings: a compact stack of coins, rather than another wallet variant.
    for (final y in [47.0, 38.0, 29.0]) {
      shape(
        Path()
          ..moveTo(5, y)
          ..lineTo(5, y + 7)
          ..cubicTo(5, y + 14, 34, y + 14, 34, y + 7)
          ..lineTo(34, y)
          ..close(),
        fill: tint,
        width: 2.3,
      );
      canvas.drawOval(
        Rect.fromLTRB(5, y - 5, 34, y + 5),
        Paint()..color = soft,
      );
      canvas.drawOval(Rect.fromLTRB(5, y - 5, 34, y + 5), stroke(ink, 2.2));
      line(11, y + 6, 11, y + 8, color: accent, width: 1.3);
      line(18, y + 7, 18, y + 9, color: accent, width: 1.3);
    }
    circle(44, 42, 16, fill: paper, width: 2.7);
    circle(44, 42, 11, fill: tint, color: soft, width: 1.6);
    shape(
      Path()
        ..moveTo(40, 47)
        ..quadraticBezierTo(33, 34, 49, 34)
        ..quadraticBezierTo(55, 45, 40, 47)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.4,
    );
    line(40, 46, 47, 38, color: paper, width: 1.3);
    line(44, 12, 44, 18, color: soft, width: 1.6);
    line(41, 15, 47, 15, color: soft, width: 1.6);
  }

  void unlimitedBudget() {
    // A fan of banknotes with a large infinity mark is readable at card size.
    shape(
      Path()
        ..moveTo(13, 26)
        ..lineTo(20, 5)
        ..lineTo(55, 18)
        ..lineTo(48, 36)
        ..close(),
      fill: tint,
      width: 2.3,
    );
    shape(
      Path()
        ..moveTo(9, 25)
        ..lineTo(41, 8)
        ..lineTo(53, 30)
        ..lineTo(20, 44)
        ..close(),
      fill: soft,
      width: 2.3,
    );
    line(23, 15, 37, 9, color: paper, width: 1.5);
    rect(4, 27, 56, 29, fill: paper, radius: 4, width: 2.8);
    rect(9, 32, 46, 19, fill: tint, radius: 2, color: soft, width: 1.3);
    curve(
      Path()
        ..moveTo(32, 41)
        ..cubicTo(26, 28, 13, 34, 18, 44)
        ..cubicTo(23, 53, 33, 34, 40, 35)
        ..cubicTo(52, 34, 48, 51, 40, 47)
        ..quadraticBezierTo(35, 46, 32, 41),
      color: accent,
      width: 3.1,
    );
    line(11, 36, 11, 39, color: ink, width: 1.5);
    line(53, 44, 53, 47, color: ink, width: 1.5);
  }

  void calendar({bool irregular = false}) {
    rect(7, 10, 49, 46, fill: tint, radius: 6, width: 2.6);
    line(8, 23, 55, 23, width: 2);
    for (final x in [19.0, 44.0]) {
      rect(x, 5, 4, 12, fill: paper, radius: 2, width: 1.8);
    }
    for (var i = 0; i < 7; i++) {
      final x = 17.0 + (i % 4) * 10;
      final y = 33.0 + (i ~/ 4) * 12;
      circle(
        x,
        y,
        2.4,
        fill: i < (variant == 0 ? 3 : variant) ? accent : paper,
        color: i < (variant == 0 ? 3 : variant) ? accent : soft,
        width: 1.3,
      );
    }
    if (irregular) {
      smallClock(49, 48, 12, 40);
      curve(
        Path()
          ..moveTo(13, 42)
          ..lineTo(23, 32)
          ..moveTo(13, 32)
          ..lineTo(23, 42),
        color: accent,
        width: 1.8,
      );
    }
  }

  void standing() {
    ground();
    shape(
      Path()
        ..moveTo(22, 34)
        ..lineTo(32, 34)
        ..lineTo(30, 56)
        ..lineTo(23, 56)
        ..close(),
      fill: ink,
    );
    shape(
      Path()
        ..moveTo(32, 34)
        ..lineTo(42, 34)
        ..lineTo(41, 56)
        ..lineTo(34, 56)
        ..close(),
      fill: soft,
    );
    rect(20, 55, 12, 4, fill: paper, radius: 1.5, width: 1.8);
    rect(33, 55, 12, 4, fill: paper, radius: 1.5, width: 1.8);
    shape(
      Path()
        ..moveTo(24, 18)
        ..quadraticBezierTo(32, 14, 40, 18)
        ..lineTo(43, 36)
        ..quadraticBezierTo(32, 40, 21, 36)
        ..close(),
      fill: accent,
    );
    curve(
      Path()
        ..moveTo(24, 22)
        ..lineTo(18, 34)
        ..lineTo(19, 41)
        ..moveTo(40, 22)
        ..lineTo(46, 34)
        ..lineTo(45, 41),
      color: paper,
      width: 5,
    );
    curve(
      Path()
        ..moveTo(24, 22)
        ..lineTo(18, 34)
        ..lineTo(19, 41)
        ..moveTo(40, 22)
        ..lineTo(46, 34)
        ..lineTo(45, 41),
      width: 2,
    );
    head(31, 9);
  }

  void workout() {
    shape(
      Path()
        ..moveTo(8, 34)
        ..lineTo(20, 30)
        ..lineTo(29, 38)
        ..lineTo(43, 44)
        ..quadraticBezierTo(55, 46, 57, 53)
        ..lineTo(57, 58)
        ..lineTo(6, 58)
        ..quadraticBezierTo(3, 44, 8, 34)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    line(8, 52, 54, 52, color: accent, width: 1.8);
    line(24, 37, 20, 42, color: accent, width: 1.8);
    line(30, 40, 26, 45, color: accent, width: 1.8);
    line(36, 43, 32, 48, color: accent, width: 1.8);
    canvas.save();
    canvas.translate(34, 18);
    canvas.rotate(-.4);
    line(-17, 0, 17, 0, width: 2.6);
    rect(-15, -8, 6, 16, fill: soft, radius: 2, width: 2);
    rect(9, -8, 6, 16, fill: soft, radius: 2, width: 2);
    canvas.restore();
  }

  void turtle() {
    ground();
    shape(
      Path()
        ..moveTo(9, 44)
        ..cubicTo(9, 13, 47, 13, 48, 44)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(13, 44)
        ..lineTo(20, 34)
        ..lineTo(35, 34)
        ..lineTo(44, 44)
        ..moveTo(20, 34)
        ..lineTo(23, 24)
        ..moveTo(35, 34)
        ..lineTo(33, 23),
      color: accent,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(48, 38)
        ..cubicTo(59, 28, 67, 45, 56, 48)
        ..lineTo(46, 47)
        ..close(),
      fill: soft,
      width: 2.2,
    );
    circle(57, 39, 1, fill: ink, color: ink, width: 1);
    rect(15, 45, 6, 9, fill: soft, radius: 2, width: 1.8);
    rect(36, 45, 6, 9, fill: soft, radius: 2, width: 1.8);
    line(4, 44, 9, 41, color: accent, width: 2);
  }

  void footsteps() {
    for (final entry in [(21.0, 37.0, -.25), (45.0, 21.0, .28)]) {
      canvas.save();
      canvas.translate(entry.$1, entry.$2);
      canvas.rotate(entry.$3);
      shape(
        Path()
          ..moveTo(-7, -7)
          ..cubicTo(-10, -21, 11, -22, 10, -8)
          ..quadraticBezierTo(10, -1, 4, 3)
          ..quadraticBezierTo(0, 5, 3, 13)
          ..quadraticBezierTo(-4, 19, -8, 11)
          ..quadraticBezierTo(-3, 1, -7, -7)
          ..close(),
        fill: tint,
        width: 2.4,
      );
      curve(
        Path()
          ..moveTo(-3, -11)
          ..quadraticBezierTo(1, -16, 5, -11),
        color: accent,
        width: 1.7,
      );
      curve(
        Path()
          ..moveTo(-5, 9)
          ..lineTo(0, 11),
        color: accent,
        width: 1.7,
      );
      canvas.restore();
    }
  }

  void apple(double x, double y, double r) {
    shape(
      Path()
        ..moveTo(x, y - r * .55)
        ..cubicTo(
          x - r * 1.5,
          y - r * 1.4,
          x - r * 1.2,
          y + r * .65,
          x - r * .2,
          y + r,
        )
        ..lineTo(x + r * .2, y + r)
        ..cubicTo(
          x + r * 1.2,
          y + r * .65,
          x + r * 1.5,
          y - r * 1.4,
          x,
          y - r * .55,
        )
        ..close(),
      fill: tint,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(x, y - r * .4)
        ..quadraticBezierTo(x - r * .3, y - r * 1.2, x + r * .2, y - r * 1.4),
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(x + r * .1, y - r * .8)
        ..quadraticBezierTo(x + r * .3, y - r * 1.7, x + r * .9, y - r * 1.2)
        ..quadraticBezierTo(x + r * .9, y - r * .5, x + r * .1, y - r * .8)
        ..close(),
      fill: accent,
      color: accent,
      width: 1,
    );
    curve(
      Path()
        ..moveTo(x - r * .5, y - r * .2)
        ..lineTo(x - r * .6, y + r * .3),
      color: paper,
      width: 1.6,
    );
  }

  void snack() {
    apple(23, 24, 14);
    shape(
      Path()
        ..moveTo(22, 39)
        ..lineTo(59, 39)
        ..quadraticBezierTo(55, 59, 40, 58)
        ..quadraticBezierTo(26, 57, 22, 39)
        ..close(),
      fill: soft,
      width: 2.4,
    );
    for (final p in [(30.0, 37.0), (40.0, 36.0), (50.0, 37.0)]) {
      shape(
        Path()
          ..moveTo(p.$1 - 4, p.$2)
          ..quadraticBezierTo(p.$1 - 5, p.$2 - 12, p.$1, p.$2 - 9)
          ..quadraticBezierTo(p.$1 + 7, p.$2 - 4, p.$1 + 4, p.$2)
          ..close(),
        fill: paper,
        width: 1.5,
      );
    }
    line(30, 46, 50, 46, color: paper, width: 1.6);
    if (variant > 0) badge(variant);
  }

  void sweets() {
    shape(
      Path()
        ..moveTo(15, 32)
        ..lineTo(50, 32)
        ..lineTo(46, 56)
        ..lineTo(20, 56)
        ..close(),
      fill: soft,
      width: 2.5,
    );
    for (final x in [24.0, 32.0, 40.0]) {
      line(x, 38, x + 1, 51, color: paper, width: 1.6);
    }
    shape(
      Path()
        ..moveTo(12, 31)
        ..cubicTo(8, 24, 18, 18, 22, 21)
        ..cubicTo(15, 13, 30, 6, 35, 16)
        ..cubicTo(43, 9, 52, 17, 47, 22)
        ..cubicTo(60, 23, 55, 34, 48, 34)
        ..close(),
      fill: tint,
      width: 2.4,
    );
    circle(32, 9, 4, fill: accent, color: accent, width: 1.6);
    line(32, 5, 35, 2, color: ink, width: 1.5);
    line(20, 27, 25, 27, color: accent, width: 1.3);
    line(37, 24, 42, 25, color: accent, width: 1.3);
    badge(variant, crossed: variant == 5);
  }

  void stress() {
    canvas.save();
    canvas.translate(-5, 10);
    canvas.scale(.8, .8);
    portrait(DietIconKind.person);
    canvas.restore();
    shape(
      Path()
        ..moveTo(40, 6)
        ..cubicTo(35, 0, 52, 0, 53, 7)
        ..cubicTo(64, 4, 65, 19, 56, 19)
        ..lineTo(47, 19)
        ..lineTo(40, 25)
        ..lineTo(41, 18)
        ..cubicTo(32, 21, 31, 8, 40, 6)
        ..close(),
      fill: paper,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(46, 6)
        ..lineTo(42, 12)
        ..lineTo(49, 12)
        ..lineTo(45, 17),
      color: accent,
      width: 2,
    );
  }

  void horizon(bool evening) {
    circle(31, 32, 16, fill: tint, width: 2.6);
    rect(4, 34, 56, 20, fill: paper, color: paper, width: 1);
    line(5, 35, 58, 35, width: 2.6);
    line(11, 42, 51, 42, color: soft, width: 2);
    line(19, 49, 43, 49, color: soft, width: 1.7);
    for (final r in [
      (31.0, 7.0, 31.0, 11.0),
      (10.0, 16.0, 14.0, 20.0),
      (49.0, 20.0, 53.0, 16.0),
    ]) {
      line(r.$1, r.$2, r.$3, r.$4, color: accent, width: 2);
    }
    canvas.save();
    canvas.translate(52, 50);
    if (!evening) {
      canvas.rotate(math.pi);
    }
    curve(
      Path()
        ..moveTo(-4, -1)
        ..lineTo(0, 3)
        ..lineTo(4, -1)
        ..moveTo(0, 3)
        ..lineTo(0, -7),
      color: accent,
      width: 2,
    );
    canvas.restore();
  }

  void fastFood() {
    if (variant == 1) {
      rareFastFood();
      return;
    }
    if (variant == 2) {
      weeklyFastFood();
      return;
    }
    if (variant == 4) {
      dailyFastFood();
      return;
    }
    shape(
      Path()
        ..moveTo(7, 28)
        ..cubicTo(8, 5, 43, 5, 44, 28)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    for (final p in [(17.0, 19.0), (27.0, 16.0), (35.0, 21.0)]) {
      line(p.$1, p.$2, p.$1 + 2, p.$2 - 1, color: accent, width: 1.5);
    }
    rect(6, 31, 39, 7, fill: soft, radius: 3, width: 2);
    curve(
      Path()
        ..moveTo(7, 41)
        ..lineTo(16, 44)
        ..lineTo(24, 41)
        ..lineTo(34, 44)
        ..lineTo(44, 41),
      color: accent,
      width: 2.5,
    );
    shape(
      Path()
        ..moveTo(7, 46)
        ..lineTo(44, 46)
        ..quadraticBezierTo(44, 55, 37, 55)
        ..lineTo(14, 55)
        ..quadraticBezierTo(7, 55, 7, 46)
        ..close(),
      fill: tint,
      width: 2.4,
    );
    for (final fry in [(48.0, 12.0), (54.0, 8.0), (59.0, 15.0)]) {
      rect(fry.$1, fry.$2, 3, 24, fill: soft, radius: 1, width: 1.3);
    }
    shape(
      Path()
        ..moveTo(45, 31)
        ..lineTo(62, 31)
        ..lineTo(59, 53)
        ..lineTo(49, 53)
        ..close(),
      fill: paper,
      width: 2,
    );
    if (variant == 3) {
      for (var day = 0; day < 7; day++) {
        rect(
          6 + day * 8,
          59,
          5,
          3,
          radius: 1,
          fill: day < 4 ? accent : paper,
          color: day < 4 ? accent : soft,
          width: .9,
        );
      }
    } else {
      badge(variant, crossed: variant == 5);
    }
  }

  void burger(double x, double y, double width) {
    canvas.save();
    canvas.translate(x, y);
    canvas.scale(width / 40);
    shape(
      Path()
        ..moveTo(2, 17)
        ..cubicTo(3, -1, 37, -1, 38, 17)
        ..close(),
      fill: tint,
      width: 2.3,
    );
    for (final seed in [(11.0, 11.0), (21.0, 7.0), (30.0, 12.0)]) {
      line(
        seed.$1,
        seed.$2,
        seed.$1 + 2,
        seed.$2 - 1,
        color: accent,
        width: 1.3,
      );
    }
    rect(1, 20, 38, 6, fill: soft, radius: 2.5, width: 2);
    curve(
      Path()
        ..moveTo(2, 29)
        ..lineTo(9, 32)
        ..lineTo(18, 28)
        ..lineTo(27, 32)
        ..lineTo(38, 29),
      color: accent,
      width: 2.3,
    );
    shape(
      Path()
        ..moveTo(2, 35)
        ..lineTo(38, 35)
        ..quadraticBezierTo(38, 42, 31, 42)
        ..lineTo(9, 42)
        ..quadraticBezierTo(2, 42, 2, 35)
        ..close(),
      fill: tint,
      width: 2.3,
    );
    canvas.restore();
  }

  void rareFastFood() {
    // An occasional individual meal: a single burger with a prominent clock.
    burger(6, 6, 45);
    smallClock(49, 49, 12, 45);
    line(7, 56, 22, 56, color: soft, width: 1.6);
  }

  void weeklyFastFood() {
    // The weekly schedule is the main silhouette; two marked days remain large.
    rect(7, 10, 46, 46, fill: tint, radius: 6, width: 2.6);
    line(8, 23, 52, 23, width: 2);
    for (final x in [18.0, 42.0]) {
      rect(x, 5, 4, 12, fill: paper, radius: 2, width: 1.8);
    }
    rect(14, 29, 8, 8, fill: accent, color: accent, radius: 2, width: 1.4);
    rect(28, 29, 8, 8, fill: accent, color: accent, radius: 2, width: 1.4);
    rect(14, 43, 8, 8, fill: paper, color: soft, radius: 2, width: 1.2);
    // A white backing keeps the food cue separate from the calendar grid.
    circle(47, 49, 16, fill: paper, color: paper, width: 1);
    burger(34, 35, 27);
  }

  void dailyFastFood() {
    // A takeaway order with repeat arrows conveys an everyday habit.
    shape(
      Path()
        ..moveTo(14, 18)
        ..lineTo(49, 18)
        ..lineTo(53, 57)
        ..quadraticBezierTo(32, 63, 11, 57)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(23, 20)
        ..lineTo(23, 13)
        ..cubicTo(23, 1, 41, 1, 41, 13)
        ..lineTo(41, 20),
      width: 2.4,
    );
    line(15, 23, 48, 23, color: soft, width: 1.5);
    burger(21, 28, 24);
    curve(
      Path()
        ..moveTo(5, 38)
        ..cubicTo(0, 18, 14, 6, 28, 8),
      color: accent,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(23, 3)
        ..lineTo(29, 8)
        ..lineTo(23, 13),
      color: accent,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(58, 27)
        ..cubicTo(65, 46, 51, 61, 36, 59),
      color: accent,
      width: 2.8,
    );
    curve(
      Path()
        ..moveTo(41, 54)
        ..lineTo(35, 59)
        ..lineTo(41, 63),
      color: accent,
      width: 2.8,
    );
  }

  void planHistory(DietIconKind kind) {
    if (kind == DietIconKind.firstPlan) {
      firstDiet();
    } else if (kind == DietIconKind.pausedPlan) {
      interruptedJourney();
    } else {
      returnedWeight();
    }
  }

  void firstDiet() {
    // A fresh open plan with a growing sprout: starting a new diet.
    shape(
      Path()
        ..moveTo(5, 22)
        ..quadraticBezierTo(17, 16, 32, 24)
        ..quadraticBezierTo(47, 16, 59, 22)
        ..lineTo(59, 55)
        ..quadraticBezierTo(45, 51, 32, 59)
        ..quadraticBezierTo(19, 51, 5, 55)
        ..close(),
      fill: tint,
      width: 2.7,
    );
    shape(
      Path()
        ..moveTo(9, 18)
        ..quadraticBezierTo(20, 15, 32, 22)
        ..lineTo(32, 55)
        ..quadraticBezierTo(20, 48, 9, 51)
        ..close(),
      fill: paper,
      width: 2,
    );
    shape(
      Path()
        ..moveTo(32, 22)
        ..quadraticBezierTo(44, 15, 55, 18)
        ..lineTo(55, 51)
        ..quadraticBezierTo(44, 48, 32, 55)
        ..close(),
      fill: paper,
      width: 2,
    );
    line(14, 32, 25, 34, color: soft, width: 1.7);
    line(14, 39, 25, 41, color: soft, width: 1.7);
    line(39, 36, 49, 34, color: soft, width: 1.7);
    line(39, 43, 49, 41, color: soft, width: 1.7);
    curve(
      Path()
        ..moveTo(32, 25)
        ..quadraticBezierTo(31, 15, 35, 8),
      color: accent,
      width: 2.4,
    );
    shape(
      Path()
        ..moveTo(32, 17)
        ..cubicTo(21, 18, 20, 8, 22, 5)
        ..cubicTo(31, 4, 35, 10, 32, 17)
        ..close(),
      fill: soft,
      color: accent,
      width: 1.8,
    );
    shape(
      Path()
        ..moveTo(33, 13)
        ..cubicTo(31, 4, 41, 1, 48, 3)
        ..cubicTo(48, 12, 40, 17, 33, 13)
        ..close(),
      fill: accent,
      color: accent,
      width: 1.8,
    );
    line(35, 13, 43, 7, color: paper, width: 1.3);
  }

  void returnedWeight() {
    // The subject is weight itself, with a broad return arrow above the scale.
    rect(10, 21, 42, 38, fill: tint, radius: 8, width: 2.7);
    shape(
      Path()
        ..moveTo(17, 35)
        ..quadraticBezierTo(31, 21, 45, 35)
        ..lineTo(42, 42)
        ..lineTo(20, 42)
        ..close(),
      fill: paper,
      width: 2,
    );
    line(31, 37, 37, 30, color: accent, width: 2.3);
    circle(31, 37, 1.4, fill: accent, color: accent, width: 1);
    line(23, 33, 24, 35, color: soft, width: 1.3);
    line(31, 29, 31, 32, color: soft, width: 1.3);
    for (final x in [21.0, 36.0]) {
      rect(x, 47, 5, 7, fill: soft, color: soft, radius: 2, width: 1);
    }
    curve(
      Path()
        ..moveTo(9, 15)
        ..cubicTo(10, 1, 51, 0, 55, 16),
      color: accent,
      width: 3.4,
    );
    curve(
      Path()
        ..moveTo(47, 11)
        ..lineTo(55, 18)
        ..lineTo(61, 9),
      color: accent,
      width: 3.4,
    );
  }

  void interruptedJourney() {
    // A route that reaches a clear pause point, rather than another paper badge.
    final route = Path()
      ..moveTo(11, 55)
      ..cubicTo(3, 36, 51, 45, 30, 29)
      ..cubicTo(7, 15, 31, 7, 43, 16);
    curve(route, color: soft, width: 9);
    curve(route, color: accent, width: 2.2);
    circle(11, 55, 4, fill: paper, color: ink, width: 2);
    circle(46, 20, 15, fill: paper, color: ink, width: 2.7);
    circle(46, 20, 11, fill: tint, color: soft, width: 1.3);
    line(42, 14, 42, 26, color: accent, width: 3.6);
    line(50, 14, 50, 26, color: accent, width: 3.6);
    line(44, 50, 50, 50, color: soft, width: 1.6);
    line(47, 47, 47, 53, color: soft, width: 1.6);
  }

  void trophy() {
    shape(
      Path()
        ..moveTo(17, 8)
        ..lineTo(47, 8)
        ..lineTo(45, 29)
        ..quadraticBezierTo(32, 46, 19, 29)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(17, 14)
        ..cubicTo(-2, 8, 1, 32, 21, 33)
        ..moveTo(47, 14)
        ..cubicTo(66, 8, 63, 32, 43, 33),
      color: accent,
      width: 2.4,
    );
    line(32, 38, 32, 51, width: 3);
    rect(22, 51, 20, 6, fill: soft, radius: 2, width: 2);
    star(32, 23, 7);
    line(10, 48, 10, 54, color: soft, width: 1.5);
    line(7, 51, 13, 51, color: soft, width: 1.5);
    circle(54, 45, 2, fill: soft, color: soft, width: 1);
  }

  void question() {
    shape(
      Path()
        ..moveTo(14, 8)
        ..lineTo(48, 8)
        ..quadraticBezierTo(58, 8, 58, 18)
        ..lineTo(58, 41)
        ..quadraticBezierTo(58, 49, 49, 49)
        ..lineTo(23, 49)
        ..lineTo(9, 58)
        ..lineTo(12, 47)
        ..quadraticBezierTo(5, 44, 5, 36)
        ..lineTo(5, 18)
        ..quadraticBezierTo(5, 8, 14, 8)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    curve(
      Path()
        ..moveTo(24, 23)
        ..cubicTo(24, 10, 44, 14, 41, 24)
        ..quadraticBezierTo(39, 28, 32, 31)
        ..lineTo(32, 35),
      color: accent,
      width: 3,
    );
    circle(32, 41, 1.7, fill: accent, color: accent, width: 1);
  }

  void babyFace(double x, double y, double r) {
    circle(x - r, y, 2.5, fill: paper, width: 1.5);
    circle(x + r, y, 2.5, fill: paper, width: 1.5);
    circle(x, y, r, fill: paper, width: 2.1);
    curve(
      Path()
        ..moveTo(x - 2, y - r + 3)
        ..cubicTo(x + 7, y - r - 2, x + 7, y - r + 8, x + 1, y - r + 5),
      color: accent,
      width: 1.6,
    );
    circle(x - r * .35, y, 1, fill: ink, color: ink, width: .8);
    circle(x + r * .35, y, 1, fill: ink, color: ink, width: .8);
    curve(
      Path()
        ..moveTo(x - 3, y + 5)
        ..quadraticBezierTo(x, y + 8, x + 3, y + 5),
      color: accent,
      width: 1.4,
    );
  }

  void babies() {
    if (variant == 2) {
      babyFace(18, 22, 12);
      babyFace(46, 39, 12);
    } else if (variant == 3) {
      babyFace(32, 16, 10);
      babyFace(16, 43, 10);
      babyFace(48, 43, 10);
    } else {
      shape(
        Path()
          ..moveTo(9, 40)
          ..quadraticBezierTo(32, 24, 55, 40)
          ..lineTo(48, 56)
          ..quadraticBezierTo(32, 64, 16, 56)
          ..close(),
        fill: tint,
        width: 2.4,
      );
      curve(
        Path()
          ..moveTo(16, 38)
          ..lineTo(45, 56),
        color: soft,
        width: 2,
      );
      babyFace(32, 25, 17);
      if (variant == 4) {
        circle(52, 49, 9, fill: paper, color: accent, width: 2);
        line(48, 49, 56, 49, color: accent, width: 2);
        line(52, 45, 52, 53, color: accent, width: 2);
      }
    }
  }

  void babyBottle() {
    canvas.save();
    canvas.translate(32, 32);
    canvas.rotate(.3);
    canvas.translate(-32, -32);
    shape(
      Path()
        ..moveTo(25, 14)
        ..lineTo(25, 9)
        ..cubicTo(25, 0, 39, 0, 39, 9)
        ..lineTo(39, 14)
        ..close(),
      fill: soft,
      width: 2.3,
    );
    rect(20, 14, 24, 8, fill: paper, radius: 2, width: 2);
    rect(18, 22, 28, 36, fill: tint, radius: 7, width: 2.6);
    shape(
      Path()
        ..moveTo(20, 40)
        ..quadraticBezierTo(32, 35, 44, 40)
        ..lineTo(44, 51)
        ..quadraticBezierTo(32, 62, 20, 51)
        ..close(),
      fill: soft,
      color: soft,
      width: 1.2,
    );
    for (final y in [29.0, 35.0, 41.0, 47.0]) {
      line(35, y, 40, y, color: accent, width: 1.5);
    }
    line(23, 29, 23, 38, color: paper, width: 1.6);
    canvas.restore();
    if (variant == 2) {
      circle(13, 46, 10, fill: paper, color: accent, width: 1.8);
      line(9, 46, 17, 46, color: accent, width: 2);
    }
  }

  void breastfeeding() {
    ground();
    shape(
      Path()
        ..moveTo(17, 18)
        ..cubicTo(17, 0, 43, 0, 43, 20)
        ..lineTo(46, 37)
        ..lineTo(15, 37)
        ..close(),
      fill: ink,
      width: 2,
    );
    shape(
      Path()
        ..moveTo(19, 24)
        ..quadraticBezierTo(32, 20, 43, 28)
        ..lineTo(50, 58)
        ..lineTo(12, 58)
        ..lineTo(15, 34)
        ..close(),
      fill: soft,
      width: 2.4,
    );
    head(28, 15);
    shape(
      Path()
        ..moveTo(23, 40)
        ..quadraticBezierTo(43, 28, 56, 43)
        ..quadraticBezierTo(53, 58, 35, 52)
        ..close(),
      fill: paper,
      width: 2.3,
    );
    curve(
      Path()
        ..moveTo(22, 30)
        ..lineTo(22, 43)
        ..quadraticBezierTo(35, 55, 51, 49),
      color: paper,
      width: 6,
    );
    curve(
      Path()
        ..moveTo(22, 30)
        ..lineTo(22, 43)
        ..quadraticBezierTo(35, 55, 51, 49),
      width: 2,
    );
    babyFace(44, 38, 7);
    curve(
      Path()
        ..moveTo(30, 41)
        ..lineTo(35, 48),
      color: accent,
      width: 1.5,
    );
    if (variant == 1) badge(1);
  }

  void vitamin() {
    rect(17, 7, 29, 10, fill: soft, radius: 3, width: 2.3);
    rect(13, 17, 37, 42, fill: tint, radius: 7, width: 2.6);
    for (final x in [24.0, 31.0, 38.0]) {
      line(x, 10, x, 14, color: paper, width: 1.4);
    }
    rect(14, 28, 35, 21, fill: paper, radius: 2, color: soft, width: 1.5);
    if (variant == 1) {
      shape(
        Path()
          ..moveTo(28, 43)
          ..quadraticBezierTo(22, 30, 40, 32)
          ..quadraticBezierTo(39, 44, 28, 43)
          ..close(),
        fill: accent,
        color: accent,
        width: 1.4,
      );
      line(28, 43, 36, 35, color: paper, width: 1.4);
    } else if (variant == 2) {
      drop(32, 37, 6);
    } else if (variant == 3) {
      circle(32, 38, 5, fill: tint, color: accent, width: 1.6);
      for (final r in [
        (32.0, 29.0, 32.0, 31.0),
        (32.0, 45.0, 32.0, 47.0),
        (23.0, 38.0, 25.0, 38.0),
        (39.0, 38.0, 41.0, 38.0),
      ]) {
        line(r.$1, r.$2, r.$3, r.$4, color: accent, width: 1.4);
      }
    } else {
      line(26, 38, 38, 38, color: accent, width: 3);
      line(32, 32, 32, 44, color: accent, width: 3);
    }
  }

  void nausea() {
    shape(
      Path()
        ..moveTo(11, 56)
        ..lineTo(11, 40)
        ..quadraticBezierTo(10, 33, 18, 31)
        ..lineTo(18, 24)
        ..cubicTo(13, 5, 41, 1, 42, 20)
        ..lineTo(46, 27)
        ..lineTo(41, 29)
        ..lineTo(39, 35)
        ..lineTo(34, 36)
        ..lineTo(34, 42)
        ..lineTo(43, 55)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    curve(
      Path()
        ..moveTo(28, 23)
        ..lineTo(33, 25),
      color: accent,
      width: 2,
    );
    curve(
      Path()
        ..moveTo(27, 33)
        ..quadraticBezierTo(30, 30, 33, 33),
      width: 1.7,
    );
    curve(
      Path()
        ..moveTo(6, 14)
        ..quadraticBezierTo(2, 18, 7, 22)
        ..moveTo(49, 13)
        ..quadraticBezierTo(55, 17, 50, 22),
      color: soft,
      width: 1.7,
    );
    if (variant == 2) {
      shape(
        Path()
          ..moveTo(39, 42)
          ..lineTo(61, 42)
          ..quadraticBezierTo(58, 60, 50, 60)
          ..quadraticBezierTo(42, 60, 39, 42)
          ..close(),
        fill: paper,
        width: 2,
      );
      curve(
        Path()
          ..moveTo(43, 34)
          ..quadraticBezierTo(49, 36, 48, 40),
        color: accent,
        width: 2,
      );
    }
  }

  void intestines() {
    rect(9, 9, 46, 47, fill: tint, radius: 11, width: 2.6);
    curve(
      Path()
        ..moveTo(20, 16)
        ..lineTo(44, 16)
        ..quadraticBezierTo(48, 16, 48, 21)
        ..lineTo(48, 45)
        ..quadraticBezierTo(48, 50, 42, 50)
        ..lineTo(33, 50)
        ..lineTo(33, 60),
      color: accent,
      width: 3,
    );
    curve(
      Path()
        ..moveTo(19, 21)
        ..lineTo(35, 21)
        ..cubicTo(45, 21, 45, 29, 36, 29)
        ..lineTo(25, 29)
        ..cubicTo(15, 29, 15, 37, 26, 37)
        ..lineTo(36, 37)
        ..cubicTo(46, 37, 44, 45, 35, 45)
        ..lineTo(20, 45),
      width: 2.4,
    );
    if (variant == 1) {
      line(5, 22, 5, 41, color: soft, width: 1.7);
    }
    if (variant == 2) {
      curve(
        Path()
          ..moveTo(40, 57)
          ..lineTo(45, 61)
          ..lineTo(50, 57),
        color: accent,
        width: 1.8,
      );
    }
  }

  void bed() {
    rect(6, 32, 52, 20, fill: tint, radius: 4, width: 2.5);
    rect(9, 26, 19, 14, fill: paper, radius: 4, width: 2);
    shape(
      Path()
        ..moveTo(29, 26)
        ..lineTo(51, 26)
        ..quadraticBezierTo(58, 26, 58, 33)
        ..lineTo(58, 42)
        ..lineTo(29, 42)
        ..close(),
      fill: soft,
      width: 2,
    );
    line(6, 22, 6, 57, width: 2.5);
    line(58, 42, 58, 57, width: 2.5);
    line(6, 48, 58, 48, color: accent, width: 1.6);
    for (var i = 0; i < (variant == 0 ? 2 : variant); i++) {
      star(17 + i * 11, 11 + (i.isEven ? 0 : 3), 2.5);
    }
    if (variant == 1) {
      curve(
        Path()
          ..moveTo(39, 19)
          ..lineTo(44, 15)
          ..lineTo(49, 19),
        color: accent,
        width: 1.6,
      );
    }
  }

  void fruitBasket() {
    final amount = variant.clamp(0, 3);
    if (amount > 0) apple(21, 26, 12);
    if (amount > 1) {
      circle(43, 29, 10, fill: soft, color: accent, width: 2);
      line(43, 19, 45, 16, color: ink, width: 1.5);
    }
    if (amount > 2) {
      shape(
        Path()
          ..moveTo(29, 22)
          ..quadraticBezierTo(23, 6, 39, 6)
          ..quadraticBezierTo(46, 18, 29, 22)
          ..close(),
        fill: accent,
        color: accent,
        width: 1.8,
      );
    }
    shape(
      Path()
        ..moveTo(6, 34)
        ..lineTo(59, 34)
        ..lineTo(51, 57)
        ..lineTo(14, 57)
        ..close(),
      fill: tint,
      width: 2.5,
    );
    line(11, 43, 55, 43, color: soft, width: 1.7);
    line(13, 50, 53, 50, color: soft, width: 1.7);
    for (final x in [21.0, 32.0, 43.0]) {
      line(x, 35, x, 56, color: accent, width: 1.4);
    }
    if (amount == 0) {
      curve(
        Path()
          ..moveTo(23, 24)
          ..lineTo(41, 24),
        color: soft,
        width: 2,
      );
    }
  }

  void homeCooking() {
    shape(
      Path()
        ..moveTo(5, 28)
        ..lineTo(31, 7)
        ..lineTo(58, 28)
        ..lineTo(54, 32)
        ..lineTo(54, 57)
        ..lineTo(10, 57)
        ..lineTo(10, 32)
        ..close(),
      fill: tint,
      width: 2.6,
    );
    rect(21, 31, 23, 18, fill: paper, radius: 5, width: 2.1);
    line(19, 30, 46, 30, color: accent, width: 2.4);
    line(26, 25, 37, 25, color: accent, width: 2.4);
    curve(
      Path()
        ..moveTo(25, 19)
        ..quadraticBezierTo(20, 15, 25, 12)
        ..moveTo(36, 21)
        ..quadraticBezierTo(32, 18, 36, 15),
      color: soft,
      width: 1.6,
    );
    line(16, 37, 21, 37, width: 2);
    line(44, 37, 49, 37, width: 2);
    line(26, 45, 38, 45, color: soft, width: 1.6);
  }
}
