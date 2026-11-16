import '../../domain/common/number_format.dart';
import '../../domain/common/digits.dart';
export '../../domain/common/digits.dart' show fa;
export '../../domain/common/number_format.dart';

String latin(String text) => latinDigits(text);

/// 1250000 -> ۱٬۲۵۰٬۰۰۰
String money(int value) =>
    persianNumber(value, fractionDigits: 0, grouped: true);

/// 68.0 -> ۶۸ ; 68.5 -> ۶۸٫۵
String faNumber(num value) => persianNumber(value);
