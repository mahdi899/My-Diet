import 'digits.dart';

class Jalali {
  const Jalali(this.year, this.month, this.day);
  final int year, month, day;

  static const months = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ];

  /// Gregorian -> Jalali (arithmetic algorithm, valid for the current era).
  factory Jalali.fromDate(DateTime date) {
    final gy = date.year, gm = date.month, gd = date.day;
    const gDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    final gy2 = gm > 2 ? gy + 1 : gy;
    var days =
        355666 +
        365 * gy +
        ((gy2 + 3) ~/ 4) -
        ((gy2 + 99) ~/ 100) +
        ((gy2 + 399) ~/ 400) +
        gd +
        gDays[gm - 1];
    var jy = -1595 + 33 * (days ~/ 12053);
    days %= 12053;
    jy += 4 * (days ~/ 1461);
    days %= 1461;
    if (days > 365) {
      jy += (days - 1) ~/ 365;
      days = (days - 1) % 365;
    }
    final jm = days < 186 ? 1 + days ~/ 31 : 7 + (days - 186) ~/ 30;
    final jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return Jalali(jy, jm, jd);
  }

  String get monthName => months[month - 1];
  String format() => '${fa(day)} $monthName';
  String formatFull() => '${fa(day)} $monthName ${fa(year)}';
}

/// Saturday-first week names, matching the plan (day 0 = شنبه).
const weekdayNames = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

/// DateTime.weekday (Mon=1..Sun=7) -> Saturday-first index.
int saturdayIndex(DateTime date) => (date.weekday + 1) % 7;
