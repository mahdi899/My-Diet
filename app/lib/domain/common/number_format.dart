import 'digits.dart';

/// Display only: storage, API values and editable input keep their own types.
/// Trailing zeroes are removed unless fixed [fractionDigits] is requested.
String persianNumber(
  num value, {
  int maximumFractionDigits = 1,
  int? fractionDigits,
  bool grouped = false,
}) {
  final precision = fractionDigits ?? maximumFractionDigits;
  var text = value.toStringAsFixed(precision);
  if (fractionDigits == null && text.contains('.')) {
    text = text
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }
  // Rounding very small negative values must not display a negative zero.
  if (num.tryParse(text) == 0) text = text.replaceFirst('-', '');
  final negative = text.startsWith('-');
  final parts = (negative ? text.substring(1) : text).split('.');
  var whole = parts.first;
  if (grouped) {
    whole = whole.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]}٬',
    );
  }
  return fa(
    '${negative ? '-' : ''}$whole${parts.length == 2 ? '٫${parts[1]}' : ''}',
  );
}

/// Preserve meaningful recipe fractions (e.g. ۰٫۲۵), without extra zeroes.
String persianQuantity(num value, String unit) =>
    '${persianNumber(value, maximumFractionDigits: 6)}${unit.trim().isEmpty ? '' : ' ${fa(unit.trim())}'}';
