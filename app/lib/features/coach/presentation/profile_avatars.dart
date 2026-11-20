import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Vector portraits share the same drawing in the picker and saved PNG.
class ProfileAvatar {
  const ProfileAvatar(
    this.name,
    this.background,
    this.skin,
    this.hair,
    this.shirt,
    this.style,
  );

  final String name;
  final Color background, skin, hair, shirt;
  final int style;

  static const presets = [
    ProfileAvatar(
      'سبز',
      Color(0xFFDDEFE4),
      Color(0xFFDFA776),
      Color(0xFF293D32),
      Color(0xFF19856A),
      0,
    ),
    ProfileAvatar(
      'آفتابی',
      Color(0xFFFFEDC9),
      Color(0xFFF2C8A5),
      Color(0xFF764938),
      Color(0xFFDA865C),
      1,
    ),
    ProfileAvatar(
      'آسمان',
      Color(0xFFDFEFF7),
      Color(0xFFAB7052),
      Color(0xFF263947),
      Color(0xFF488CA5),
      2,
    ),
    ProfileAvatar(
      'یاسی',
      Color(0xFFEEE5F5),
      Color(0xFFE4B28E),
      Color(0xFF7C6A9C),
      Color(0xFF675A83),
      3,
    ),
    ProfileAvatar(
      'مرجانی',
      Color(0xFFFBE3DB),
      Color(0xFFB47A58),
      Color(0xFF3D302D),
      Color(0xFFBF7062),
      4,
    ),
    ProfileAvatar(
      'زیتونی',
      Color(0xFFEAF0D6),
      Color(0xFFF1CCA4),
      Color(0xFF62503C),
      Color(0xFF7E9150),
      5,
    ),
  ];

  Future<Uint8List> png() async {
    final recorder = ui.PictureRecorder();
    ProfileAvatarPainter(this).paint(Canvas(recorder), const Size.square(320));
    final picture = recorder.endRecording();
    try {
      final image = await picture.toImage(320, 320);
      try {
        final data = (await image.toByteData(format: ui.ImageByteFormat.png))!;
        return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      } finally {
        image.dispose();
      }
    } finally {
      picture.dispose();
    }
  }
}

class ProfileAvatarPainter extends CustomPainter {
  const ProfileAvatarPainter(this.avatar);
  final ProfileAvatar avatar;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    final paint = Paint()..isAntiAlias = true;
    void oval(Rect rect, Color color) =>
        canvas.drawOval(rect, paint..color = color);
    void path(Path path, Color color) =>
        canvas.drawPath(path, paint..color = color);
    void line(Offset start, Offset end, Color color, double width) {
      canvas.drawLine(
        start,
        end,
        paint
          ..color = color
          ..strokeWidth = width
          ..strokeCap = StrokeCap.round,
      );
    }

    final a = avatar;
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, 100, 100),
      paint..color = a.background,
    );
    oval(
      const Rect.fromLTWH(8, 8, 77, 77),
      Colors.white.withValues(alpha: .28),
    );
    // Small botanical marks keep each portrait in the app's visual family.
    oval(
      const Rect.fromLTWH(80, 24, 5, 10),
      Colors.white.withValues(alpha: .7),
    );
    oval(const Rect.fromLTWH(85, 31, 8, 4), Colors.white.withValues(alpha: .7));
    line(
      const Offset(84, 31),
      const Offset(81, 40),
      a.shirt.withValues(alpha: .3),
      1,
    );
    if (a.style == 1 || a.style == 3 || a.style == 4) {
      oval(const Rect.fromLTWH(24, 15, 52, 72), a.hair);
    }
    path(
      Path()
        ..moveTo(14, 105)
        ..quadraticBezierTo(13, 76, 40, 74)
        ..lineTo(60, 74)
        ..quadraticBezierTo(87, 76, 86, 105)
        ..close(),
      a.shirt,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(43, 63, 14, 19),
        const Radius.circular(7),
      ),
      paint..color = a.skin,
    );
    oval(const Rect.fromLTWH(26, 41, 10, 15), a.skin);
    oval(const Rect.fromLTWH(64, 41, 10, 15), a.skin);
    oval(const Rect.fromLTWH(30, 21, 40, 49), a.skin);
    if (a.style == 3) {
      path(
        Path()
          ..moveTo(24, 55)
          ..quadraticBezierTo(18, 10, 50, 13)
          ..quadraticBezierTo(81, 10, 77, 59)
          ..lineTo(68, 47)
          ..quadraticBezierTo(65, 29, 52, 27)
          ..quadraticBezierTo(42, 37, 31, 35)
          ..lineTo(31, 59)
          ..close(),
        a.hair,
      );
      path(
        Path()
          ..moveTo(26, 63)
          ..quadraticBezierTo(50, 89, 74, 62)
          ..lineTo(70, 86)
          ..quadraticBezierTo(50, 96, 28, 84)
          ..close(),
        a.hair,
      );
    } else if (a.style == 1 || a.style == 4) {
      path(
        Path()
          ..moveTo(27, 46)
          ..quadraticBezierTo(20, 11, 50, 16)
          ..quadraticBezierTo(78, 11, 73, 44)
          ..quadraticBezierTo(57, 41, 48, 28)
          ..quadraticBezierTo(42, 38, 28, 40)
          ..close(),
        a.hair,
      );
    } else {
      path(
        Path()
          ..moveTo(29, 43)
          ..lineTo(27, 29)
          ..quadraticBezierTo(22, 15, 43, 16)
          ..quadraticBezierTo(57, 9, 71, 22)
          ..lineTo(70, 43)
          ..lineTo(63, 32)
          ..quadraticBezierTo(43, 38, 35, 29)
          ..close(),
        a.hair,
      );
      if (a.style == 2) {
        for (var i = 0; i < 5; i++) {
          oval(
            Rect.fromLTWH(27 + i * 8, 15 + (i.isEven ? 0 : -3), 16, 17),
            a.hair,
          );
        }
      }
    }
    const ink = Color(0xFF332F2C);
    line(
      const Offset(38, 43),
      const Offset(44, 42),
      a.style == 3 ? ink : a.hair,
      1.6,
    );
    line(
      const Offset(56, 42),
      const Offset(62, 43),
      a.style == 3 ? ink : a.hair,
      1.6,
    );
    oval(const Rect.fromLTWH(40, 47, 2.5, 3.5), ink);
    oval(const Rect.fromLTWH(57.5, 47, 2.5, 3.5), ink);
    oval(
      const Rect.fromLTWH(34, 53, 8, 4),
      const Color(0xFFD77B70).withValues(alpha: .35),
    );
    oval(
      const Rect.fromLTWH(58, 53, 8, 4),
      const Color(0xFFD77B70).withValues(alpha: .35),
    );
    line(
      const Offset(50, 49),
      const Offset(48.5, 54),
      const Color(0xFFA9674A).withValues(alpha: .55),
      1,
    );
    if (a.style == 5) {
      path(
        Path()
          ..moveTo(33, 56)
          ..quadraticBezierTo(50, 71, 67, 56)
          ..quadraticBezierTo(63, 74, 50, 73)
          ..quadraticBezierTo(36, 70, 33, 56),
        a.hair,
      );
    }
    final smile = Path()
      ..moveTo(44, 59)
      ..quadraticBezierTo(50, 64, 56, 59);
    canvas.drawPath(
      smile,
      Paint()
        ..color = a.style == 5 ? a.skin : ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round,
    );
    if (a.style == 0 || a.style == 4) {
      final glasses = Paint()
        ..color = ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(35, 44, 12, 10),
          const Radius.circular(4),
        ),
        glasses,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          const Rect.fromLTWH(53, 44, 12, 10),
          const Radius.circular(4),
        ),
        glasses,
      );
      line(const Offset(47, 47), const Offset(53, 47), ink, 1.2);
    }
    if (a.style != 3) {
      path(
        Path()
          ..moveTo(37, 76)
          ..lineTo(50, 87)
          ..lineTo(63, 76)
          ..lineTo(58, 75)
          ..quadraticBezierTo(50, 82, 42, 75)
          ..close(),
        Colors.white.withValues(alpha: .75),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(ProfileAvatarPainter oldDelegate) =>
      avatar != oldDelegate.avatar;
}
