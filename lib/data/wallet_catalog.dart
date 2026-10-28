import 'package:flutter/material.dart';

/// Mock catalog for monetary wallet UI (no backend).
class PlanServiceOffer {
  const PlanServiceOffer({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.priceToman,
    required this.icon,
    required this.successLine,
  });
  final String id;
  final String title;
  final String subtitle;
  final int priceToman;
  final IconData icon;
  final String successLine;
}

class WalletChargeOffer {
  const WalletChargeOffer({
    required this.id,
    required this.amountToman,
    required this.priceToman,
  });
  final String id;
  final int amountToman;
  final int priceToman;
}

const kInitialWalletBalance = 0;

const planServiceOffers = <PlanServiceOffer>[
  PlanServiceOffer(
    id: 'new-plan',
    title: 'دریافت برنامه غذایی',
    subtitle: 'برنامهٔ شخصی‌سازی‌شده بر اساس پرسش‌نامهٔ تو',
    priceToman: 500000,
    icon: Icons.restaurant_menu_outlined,
    successLine: 'درخواست شما برای دریافت برنامه غذایی ارسال شد.',
  ),
  PlanServiceOffer(
    id: 'ai-change',
    title: 'تغییر برنامه غذایی با هوش مصنوعی',
    subtitle: 'اصلاح سریع برنامه با پیشنهادهای هوشمند',
    priceToman: 150000,
    icon: Icons.auto_awesome_outlined,
    successLine: 'درخواست تغییر برنامه با هوش مصنوعی ارسال شد.',
  ),
  PlanServiceOffer(
    id: 'expert-change',
    title: 'تغییر برنامه غذایی با متخصص',
    subtitle: 'بررسی و اصلاح برنامه توسط متخصص تغذیه',
    priceToman: 250000,
    icon: Icons.health_and_safety_outlined,
    successLine: 'درخواست تغییر برنامه با متخصص ارسال شد.',
  ),
];

const walletChargeOffers = <WalletChargeOffer>[
  WalletChargeOffer(id: 'p50', amountToman: 200000, priceToman: 200000),
  WalletChargeOffer(id: 'p200', amountToman: 500000, priceToman: 500000),
  WalletChargeOffer(id: 'p300', amountToman: 800000, priceToman: 800000),
  WalletChargeOffer(id: 'p500', amountToman: 1000000, priceToman: 1000000),
];

PlanServiceOffer? planServiceById(String? id) {
  if (id == null) return null;
  for (final o in planServiceOffers) {
    if (o.id == id) return o;
  }
  return null;
}

WalletChargeOffer? walletChargeById(String? id) {
  if (id == null) return null;
  for (final o in walletChargeOffers) {
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

String formatMoneyNumber(int value) =>
    formatToman(value).replaceAll(' تومان', '');

class MockWalletTransaction {
  const MockWalletTransaction({
    required this.operationId,
    required this.title,
    required this.amountToman,
    required this.balanceAfter,
    required this.credit,
  });
  final String operationId, title;
  final int amountToman, balanceAfter;
  final bool credit;
}
