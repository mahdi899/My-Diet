import 'dart:typed_data';
import 'dart:ui' as ui;

import '../domain/coach_events.dart';

/// Decoded image cap from the coach contract, with a little room under 1.5MB.
const kCoachImageMaxBytes = 1400000;

class CompressedPhoto {
  const CompressedPhoto(this.bytes, this.mime);
  final Uint8List bytes;
  final String mime;
}

/// JPEG, PNG, WebP, or GIF from the file signature. Null when it is not one of those.
String? sniffImageMime(List<int> bytes) {
  if (bytes.length >= 3 &&
      bytes[0] == 0xFF &&
      bytes[1] == 0xD8 &&
      bytes[2] == 0xFF) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4E &&
      bytes[3] == 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 6 &&
      bytes[0] == 0x47 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46) {
    return 'image/gif';
  }
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50) {
    return 'image/webp';
  }
  return null;
}

/// Keeps a photo the server will accept. Small originals stay as they are.
Future<CompressedPhoto> compressFoodPhoto(Uint8List bytes) async {
  if (bytes.isEmpty) {
    throw const CoachTransportException(
      'عکس خالی است. یک عکس دیگر انتخاب کن.',
      retryable: false,
    );
  }
  final sniffed = sniffImageMime(bytes);
  if (sniffed != null && bytes.length <= kCoachImageMaxBytes) {
    return CompressedPhoto(bytes, sniffed);
  }
  try {
    var width = 1280;
    var encoded = await _pngAt(bytes, width);
    while (encoded.length > kCoachImageMaxBytes && width > 480) {
      width = (width * 0.72).round();
      encoded = await _pngAt(bytes, width);
    }
    if (sniffImageMime(encoded) == null ||
        encoded.length > kCoachImageMaxBytes) {
      throw const CoachTransportException(
        'عکس بزرگ است. یک عکس کوچک‌تر بفرست.',
        code: 'image_too_large',
        retryable: false,
      );
    }
    return CompressedPhoto(encoded, 'image/png');
  } on CoachTransportException {
    rethrow;
  } catch (_) {
    throw const CoachTransportException(
      'این عکس باز نشد. یک عکس دیگر انتخاب کن.',
      retryable: false,
    );
  }
}

Future<Uint8List> _pngAt(Uint8List bytes, int width) async {
  final codec = await ui.instantiateImageCodec(bytes, targetWidth: width);
  try {
    final frame = await codec.getNextFrame();
    try {
      final data = await frame.image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) {
        throw const CoachTransportException(
          'این عکس باز نشد. یک عکس دیگر انتخاب کن.',
          retryable: false,
        );
      }
      return data.buffer.asUint8List();
    } finally {
      frame.image.dispose();
    }
  } finally {
    codec.dispose();
  }
}
