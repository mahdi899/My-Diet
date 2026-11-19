import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/personal_details.dart';

import 'customer_auth_test.dart' show TokenMemory, issued;
import 'profile_photo_crop_test.dart' show cropTestPhoto;

Widget personalHost(DemoStore store) => MaterialApp(
  theme: appTheme(),
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: PersonalDetails(store: store),
  ),
);

void main() {
  testWidgets(
    'a selected gallery photo is cropped before the account saves it',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      late final Directory directory;
      late final File file;
      await t.runAsync(() async {
        directory = await Directory.systemTemp.createTemp('profile-crop-test-');
        file = File('${directory.path}/gallery.png');
        await file.writeAsBytes(await cropTestPhoto());
      });
      addTearDown(() async {
        await file.delete();
        await directory.delete();
      });
      const picker = MethodChannel('plugins.flutter.io/image_picker');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(picker, (_) async => file.path);
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(picker, null);
      });
      Map<String, dynamic>? saved;
      final auth = CustomerAuth(
        baseUrl: 'https://fixture.test',
        storage: TokenMemory(),
        client: MockClient((request) async {
          if (request.url.path.startsWith('/v1/auth/')) {
            return http.Response(jsonEncode(issued()), 200);
          }
          if (request.method == 'PATCH') {
            saved = jsonDecode(request.body) as Map<String, dynamic>;
            return http.Response(
              jsonEncode({'details': saved}),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }
          return http.Response(
            jsonEncode({
              'details': {
                'name': 'سارا',
                'age': 28,
                'contactPhone': '',
                'height': 165,
                'weight': 60,
                'photo': null,
              },
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final store = DemoStore(customerAuth: auth);
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await store.verifyLoginCode('09123456789', '123456');
      await t.pumpWidget(personalHost(store));
      await t.pumpAndSettle();
      await t.runAsync(() async {
        await t.tap(find.text('تغییر عکس پروفایل'));
        await Future<void>.delayed(const Duration(milliseconds: 50));
      });
      await t.pump(const Duration(milliseconds: 400));
      await t.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 50)),
      );
      await t.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('profile-photo-viewport')),
        findsOneWidget,
      );
      expect(store.profilePhoto, isNull);
      await t.runAsync(() async {
        await t.tap(find.byKey(const ValueKey('profile-photo-confirm')));
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await t.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('profile-photo-viewport')),
        findsNothing,
      );
      final preview =
          t.widget<CircleAvatar>(find.byType(CircleAvatar)).backgroundImage!
              as MemoryImage;
      await t.runAsync(() async {
        final codec = await PaintingBinding.instance
            .instantiateImageCodecWithSize(
              await ImmutableBuffer.fromUint8List(preview.bytes),
            );
        final image = (await codec.getNextFrame()).image;
        expect(image.width, image.height);
        image.dispose();
        codec.dispose();
      });
      await t.scrollUntilVisible(
        find.text('ذخیره تغییرات'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('ذخیره تغییرات'));
      await t.pumpAndSettle();
      expect(saved!['photo'], base64Encode(preview.bytes));
      expect(store.profilePhoto, saved!['photo']);
      expect(saved!['contactPhone'], '09123456789');
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'the login number replaces old contact details and survives restart',
    (t) async {
      final memory = TokenMemory();
      Map<String, dynamic>? saved;
      final auth = CustomerAuth(
        baseUrl: 'https://fixture.test',
        storage: memory,
        client: MockClient((request) async {
          if (request.url.path.startsWith('/v1/auth/')) {
            return http.Response(jsonEncode(issued()), 200);
          }
          if (request.method == 'PATCH') {
            saved = jsonDecode(request.body) as Map<String, dynamic>;
            return http.Response(
              jsonEncode({'details': saved}),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }
          return http.Response(
            jsonEncode({
              'details': {
                'name': 'سارا',
                'age': 28,
                'contactPhone': '09129999999',
                'height': 165,
                'weight': 60,
                'photo': null,
              },
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final first = DemoStore(customerAuth: auth);
      await first.verifyLoginCode('09123456789', '123456');
      expect(first.sessionPhone, '09123456789');
      final restartedAuth = CustomerAuth(
        baseUrl: auth.baseUrl,
        storage: memory,
        client: MockClient(
          (request) async => request.url.path.startsWith('/v1/auth/')
              ? http.Response(jsonEncode(issued()), 200)
              : http.Response(jsonEncode({'details': null}), 200),
        ),
      );
      final restarted = DemoStore(customerAuth: restartedAuth);
      await restarted.restoreUserSession();
      expect(restarted.sessionPhone, '09123456789');
      addTearDown(() {
        first.dispose();
        auth.dispose();
        restarted.dispose();
        restartedAuth.dispose();
      });
      await t.pumpWidget(personalHost(first));
      await t.pumpAndSettle();
      final phone = t.widget<TextFormField>(
        find.byKey(const ValueKey('personal-details-field-2')),
      );
      expect(phone.controller!.text, '09123456789');
      expect(
        t
            .widget<TextField>(
              find.descendant(
                of: find.byKey(const ValueKey('personal-details-field-2')),
                matching: find.byType(TextField),
              ),
            )
            .readOnly,
        isTrue,
      );
      await t.scrollUntilVisible(
        find.text('ذخیره تغییرات'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.text('ذخیره تغییرات'));
      await t.pumpAndSettle();
      expect(saved!['contactPhone'], '09123456789');
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'local cached contact cannot override the phone used to sign in',
    (t) async {
      final store = DemoStore()..login(AppRole.user, phone: '09351234567');
      addTearDown(store.dispose);
      FlutterSecureStorage.setMockInitialValues({
        'personal_details:${store.feedbackOwner}': jsonEncode({
          'fields': ['سارا', '28', '09129999999', '165', '60'],
          'photo': null,
        }),
      });
      await t.pumpWidget(personalHost(store));
      await t.pumpAndSettle();
      final phone = t.widget<TextFormField>(
        find.byKey(const ValueKey('personal-details-field-2')),
      );
      expect(phone.controller!.text, '09351234567');
      expect(
        t
            .widget<TextField>(
              find.descendant(
                of: find.byKey(const ValueKey('personal-details-field-2')),
                matching: find.byType(TextField),
              ),
            )
            .readOnly,
        isTrue,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}
