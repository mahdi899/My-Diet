import 'dart:typed_data';

import 'package:flutter/material.dart';

class ComparisonBoard extends StatelessWidget {
  const ComparisonBoard({
    super.key,
    required this.title,
    required this.current,
    required this.proposed,
  });
  final String title;
  final Uint8List current, proposed;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF3F7F4),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0A5C42),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'مقایسهٔ وضعیت فعلی با طرح پیشنهادی',
            style: TextStyle(fontSize: 13, color: Color(0xFF72827B)),
          ),
          const SizedBox(height: 20),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _panel(
                    'وضعیت فعلی اپ',
                    'اسکرین واقعی با دادهٔ دمو',
                    current,
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: _panel(
                    'طرح پیشنهادی',
                    'پیش‌نمایش مستقل؛ هنوز وارد اپ نشده',
                    proposed,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _panel(String label, String note, Uint8List bytes) => Column(
    children: [
      Text(
        label,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Color(0xFF0A5C42),
        ),
      ),
      const SizedBox(height: 4),
      Text(
        note,
        style: const TextStyle(fontSize: 10, color: Color(0xFF72827B)),
      ),
      const SizedBox(height: 12),
      Expanded(
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFDDE8DF)),
            borderRadius: BorderRadius.circular(24),
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.memory(bytes, fit: BoxFit.contain),
        ),
      ),
    ],
  );
}
