String fa(Object? value) =>
    value.toString().replaceAllMapped(RegExp('[0-9٠-٩]'), (m) {
      final char = m[0]!;
      final digit = '0123456789'.indexOf(char);
      return '۰۱۲۳۴۵۶۷۸۹'[digit >= 0 ? digit : '٠١٢٣٤٥٦٧٨٩'.indexOf(char)];
    });
String latinDigits(String value) => value
    .replaceAllMapped(RegExp('[۰-۹٠-٩]'), (m) {
      final digit = '۰۱۲۳۴۵۶۷۸۹'.indexOf(m[0]!);
      return '${digit >= 0 ? digit : '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!)}';
    })
    .replaceAll('٫', '.');
