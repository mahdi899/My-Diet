import 'package:flutter/material.dart';

/// Design tokens of «رژیم من»: white surfaces, emerald primary,
/// lime/amber accents, big radii and soft shadows.
abstract final class AppColors {
  // Surfaces
  static const bg = Color(0xFFFFFFFF);
  static const bgDeep = bg;
  static const surface = Color(0xFFFFFFFF);
  static const surfaceWarm = surface;
  static const mint = Color(0xFFE6F4EA); // soft emerald tint
  static const line = Color(0xFFEBE4D3);

  // Brand
  static const emerald = Color(0xFF12A072);
  static const emeraldDeep = Color(0xFF0B7A55);
  static const emeraldDark = Color(0xFF0A5C42);
  static const lime = Color(0xFFB8E04A);
  static const amber = Color(0xFFF2B53D);
  static const coral = Color(0xFFFF7F5C);
  static const sky = Color(0xFF59B7E8);

  // Text
  static const ink = Color(0xFF1F2D26);
  static const inkSoft = Color(0xFF3E4F45);
  static const muted = Color(0xFF64756A);
  static const faint = Color(0xFFB3BDB2);

  // Semantic
  static const danger = Color(0xFFD64545);
  static const success = emerald;
  static const disabled = Color(0xFFE5E9E2);
  static const onDisabled = Color(0xFF64756A);
  static const dangerSurface = Color(0xFFFFEEEE);
  static const warningSurface = Color(0xFFFFF3D8);
  static const warningInk = Color(0xFF865714);
  static const selectedLine = Color(0xFFBEDDCA);
}

abstract final class AppRadius {
  static const double sm = 14;
  static const double md = 20;
  static const double lg = 24;
  static const double xl = 28;
  static const double xxl = 32;
  static const double pill = 999;
  static const double control = md;

  static BorderRadius circular(double r) => BorderRadius.circular(r);
  static const card = BorderRadius.all(Radius.circular(xl));
  static const sheet = BorderRadius.vertical(top: Radius.circular(xxl));
}

abstract final class AppShadows {
  /// Barely-there lift for list cards.
  static const soft = [
    BoxShadow(color: Color(0x0F1F2D26), blurRadius: 18, offset: Offset(0, 6)),
    BoxShadow(color: Color(0x081F2D26), blurRadius: 2, offset: Offset(0, 1)),
  ];

  /// For floating elements: hero cards, bars, sheets.
  static const lifted = [
    BoxShadow(color: Color(0x1A1F2D26), blurRadius: 32, offset: Offset(0, 14)),
    BoxShadow(color: Color(0x0D1F2D26), blurRadius: 6, offset: Offset(0, 2)),
  ];

  /// Emerald glow under primary CTAs.
  static const cta = [
    BoxShadow(color: Color(0x4012A072), blurRadius: 22, offset: Offset(0, 10)),
  ];
}

abstract final class AppGradients {
  static const cta = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFF1DBE8A), AppColors.emeraldDeep],
  );
  static const lime = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFFD2F06A), AppColors.emerald],
  );
  static const amber = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFFFFD36B), Color(0xFFF59E3A)],
  );
  static const warmBackground = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [AppColors.bg, AppColors.bg],
  );

  /// Dark scrim for text on photos.
  static const photoScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.35, 1],
    colors: [Color(0x00000000), Color(0xCC10201A)],
  );
}

abstract final class AppSpacing {
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 20, xxl = 28;
  static const page = EdgeInsets.symmetric(horizontal: 20);
  static const card = EdgeInsets.all(20);
  static const double section = 24;
  static const double controlHeight = 54;
  static const double touchTarget = 48;
}
