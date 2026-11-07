import 'demo_store.dart';

String dateKey(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
int weekDayIndex(DateTime date) => (date.weekday + 1) % 7;
const persianWeekDays = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];
DateTime startOfWeek(DateTime date) =>
    DateTime(date.year, date.month, date.day - weekDayIndex(date));

// Integer conversion from the Gregorian day count to the Persian solar calendar.
(int, int, int) jalali(DateTime date) {
  final gy = date.year, gm = date.month, gd = date.day;
  const offsets = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  final gy2 = gm > 2 ? gy + 1 : gy;
  var days =
      355666 +
      365 * gy +
      (gy2 + 3) ~/ 4 -
      (gy2 + 99) ~/ 100 +
      (gy2 + 399) ~/ 400 +
      gd +
      offsets[gm - 1];
  var jy = -1595 + 33 * (days ~/ 12053);
  days %= 12053;
  jy += 4 * (days ~/ 1461);
  days %= 1461;
  if (days > 365) {
    jy += (days - 1) ~/ 365;
    days = (days - 1) % 365;
  }
  return days < 186
      ? (jy, 1 + days ~/ 31, 1 + days % 31)
      : (jy, 7 + (days - 186) ~/ 30, 1 + (days - 186) % 30);
}

String persianDate(DateTime date, {bool year = false}) {
  const months = [
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
  final j = jalali(date);
  return '${persianWeekDays[weekDayIndex(date)]}، ${fa(j.$3)} ${months[j.$2 - 1]}${year ? ' ${fa(j.$1)}' : ''}';
}

String dailyEncouragement(DateTime date) {
  const phrases = [
    'امروز فقط یک قدم بهتر از دیروز بردار؛ همین قدم‌های کوچک مسیرت را می‌سازند.',
    'قرار نیست بی‌نقص باشی؛ ادامه‌دادن از کامل‌بودن مهم‌تر است.',
    'به تلاشت افتخار کن؛ تغییرهای ماندگار آرام‌آرام ساخته می‌شوند.',
    'هر وعده یک فرصت تازه برای مراقبت از خودت است.',
    'با خودت مهربان باش؛ مسیر تو با دیگران فرق دارد.',
    'برای شروع دوباره، لازم نیست منتظر شنبه بمانی؛ امروز هم فرصت خوبی است.',
    'پیشرفت فقط یک عدد روی ترازو نیست؛ به حال بهترت هم توجه کن.',
    'یک انتخاب آگاهانهٔ کوچک، ارزش دیده‌شدن دارد.',
    'قدم‌های کوتاه و پیوسته، تو را به مقصد نزدیک‌تر می‌کنند.',
    'امروز برای خودت وقت بگذار؛ مراقبت از خودت ارزشمند است.',
    'به مسیرت اعتماد کن و موفقیت‌های کوچکت را جشن بگیر.',
  ];
  final ordinal = DateTime.utc(
    date.year,
    date.month,
    date.day,
  ).difference(DateTime.utc(2020)).inDays;
  return phrases[ordinal % phrases.length];
}
