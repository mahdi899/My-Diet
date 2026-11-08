const _fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/// Persian digits for any number or text.
String fa(Object? value) {
  final text = value.toString();
  final out = StringBuffer();
  for (final unit in text.codeUnits) {
    if (unit >= 0x30 && unit <= 0x39) {
      out.write(_fa[unit - 0x30]);
    } else {
      out.write(String.fromCharCode(unit));
    }
  }
  return out.toString();
}

/// Latin digits from Persian or Arabic-Indic input, so typed numbers parse.
String latin(String text) {
  final out = StringBuffer();
  for (final unit in text.codeUnits) {
    if (unit >= 0x6F0 && unit <= 0x6F9) {
      out.writeCharCode(unit - 0x6F0 + 0x30);
    } else if (unit >= 0x660 && unit <= 0x669) {
      out.writeCharCode(unit - 0x660 + 0x30);
    } else {
      out.writeCharCode(unit);
    }
  }
  return out.toString();
}

/// 1250000 -> ۱,۲۵۰,۰۰۰
String money(int value) {
  final digits = value.abs().toString();
  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) grouped.write(',');
    grouped.write(digits[i]);
  }
  return fa('${value < 0 ? '-' : ''}$grouped');
}

/// 68.0 -> ۶۸ ; 68.5 -> ۶۸٫۵
String faNumber(num value) {
  final text = value == value.roundToDouble()
      ? value.round().toString()
      : value.toStringAsFixed(1);
  return fa(text.replaceAll('.', '٫'));
}
