import 'package:flutter/material.dart';

/// Mock catalog for token wallet UI (no backend).
class PlanServiceOffer {
  const PlanServiceOffer({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.tokenCost,
    required this.icon,
    required this.successLine,
  });
  final String id;
  final String title;
  final String subtitle;
  final int tokenCost;
  final IconData icon;
  final String successLine;
}

class TokenPackageOffer {
  const TokenPackageOffer({
    required this.id,
    required this.tokens,
    required this.priceToman,
  });
  final String id;
  final int tokens;
  final int priceToman;
}

const kInitialTokenBalance = 100;

const planServiceOffers = <PlanServiceOffer>[
  PlanServiceOffer(
    id: 'new-plan',
    title: 'دریافت برنامه غذایی',
    subtitle: 'برنامهٔ شخصی‌سازی‌شده بر اساس پرسش‌نامهٔ تو',
    tokenCost: 200,
    icon: Icons.restaurant_menu_outlined,
    successLine: 'درخواست شما برای دریافت برنامه غذایی ارسال شد.',
  ),
  PlanServiceOffer(
    id: 'ai-change',
    title: 'تغییر برنامه غذایی با هوش مصنوعی',
    subtitle: 'اصلاح سریع برنامه با پیشنهادهای هوشمند',
    tokenCost: 50,
    icon: Icons.auto_awesome_outlined,
    successLine: 'درخواست تغییر برنامه با هوش مصنوعی ارسال شد.',
  ),
  PlanServiceOffer(
    id: 'expert-change',
    title: 'تغییر برنامه غذایی با متخصص',
    subtitle: 'بررسی و اصلاح برنامه توسط متخصص تغذیه',
    tokenCost: 100,
    icon: Icons.health_and_safety_outlined,
    successLine: 'درخواست تغییر برنامه با متخصص ارسال شد.',
  ),
];

const tokenPackageOffers = <TokenPackageOffer>[
  TokenPackageOffer(id: 'p50', tokens: 50, priceToman: 300000),
  TokenPackageOffer(id: 'p200', tokens: 200, priceToman: 500000),
  TokenPackageOffer(id: 'p300', tokens: 300, priceToman: 800000),
  TokenPackageOffer(id: 'p500', tokens: 500, priceToman: 1000000),
];

PlanServiceOffer? planServiceById(String? id) {
  if (id == null) return null;
  for (final o in planServiceOffers) {
    if (o.id == id) return o;
  }
  return null;
}

TokenPackageOffer? tokenPackageById(String? id) {
  if (id == null) return null;
  for (final o in tokenPackageOffers) {
    if (o.id == id) return o;
  }
  return null;
}

String formatToman(int amount) {
  final raw = amount.toString();
  final out = <String>[];
  for (var i = 0; i < raw.length; i++) {
    if (i > 0 && (raw.length - i) % 3 == 0) out.add(',');
    out.add(raw[i]);
  }
  return '${_faDigits(out.join())} تومان';
}

String _faDigits(String value) => value.replaceAllMapped(
  RegExp(r'\d'),
  (m) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(m[0]!)],
);

String formatTokenNumber(int value) =>
    formatToman(value).replaceAll(' تومان', '');

class MockWalletTransaction {
  const MockWalletTransaction({
    required this.operationId,
    required this.title,
    required this.tokens,
    required this.balanceAfter,
    required this.credit,
  });
  final String operationId, title;
  final int tokens, balanceAfter;
  final bool credit;
}
