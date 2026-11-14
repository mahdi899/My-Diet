String fa(Object value) => value.toString().replaceAllMapped(
  RegExp(r'\d'),
  (m) => '۰۱۲۳۴۵۶۷۸۹'[int.parse(m[0]!)],
);
String latinDigits(String value) => value
    .replaceAllMapped(RegExp('[۰-۹٠-٩]'), (m) {
      final digit = '۰۱۲۳۴۵۶۷۸۹'.indexOf(m[0]!);
      return '${digit >= 0 ? digit : '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!)}';
    })
    .replaceAll('٫', '.');
