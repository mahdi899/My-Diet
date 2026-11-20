import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_avatars.dart';
import 'package:sabzine_flutter/features/coach/presentation/personal_details.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_photo_picker.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_sheet.dart';
import 'package:sabzine_flutter/presentation/widgets/ui.dart';

import 'customer_auth_test.dart' show TokenMemory, issued;
import 'profile_photo_crop_test.dart' show cropTestPhoto;

Widget host(DemoStore store) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (_, child) =>
        Directionality(textDirection: TextDirection.rtl, child: child!),
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: TextButton(
            onPressed: () => showCoachProfileSheet(context),
            child: const Text('پروفایل'),
          ),
        ),
      ),
    ),
  ),
);

Future<void> openPicker(WidgetTester t, DemoStore store) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(host(store));
  await t.tap(find.text('پروفایل'));
  await t.pumpAndSettle();
  await t.tap(find.byKey(const ValueKey('profile-photo-edit')));
  await t.pumpAndSettle();
}

Future<void> saveAvatar(WidgetTester t, int index) async {
  await t.tap(find.byKey(ValueKey('profile-avatar-$index')));
  await t.pump();
  await t.ensureVisible(find.byKey(const ValueKey('profile-photo-save')));
  await t.runAsync(() async {
    await t.tap(find.byKey(const ValueKey('profile-photo-save')));
    await Future<void>.delayed(const Duration(milliseconds: 120));
  });
  await t.pumpAndSettle();
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets(
    'gallery photos are cropped and only saved after confirmation in the profile sheet',
    (t) async {
      final store = DemoStore()..loginDemoUser();
      addTearDown(store.dispose);
      late Directory directory;
      late File file;
      await t.runAsync(() async {
        directory = await Directory.systemTemp.createTemp('profile-picker-');
        file = await File(
          '${directory.path}/gallery.png',
        ).writeAsBytes(await cropTestPhoto());
      });
      addTearDown(() async {
        await file.delete();
        await directory.delete();
      });
      const picker = MethodChannel('plugins.flutter.io/image_picker');
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(picker, (_) async => file.path);
      addTearDown(() => messenger.setMockMethodCallHandler(picker, null));
      await openPicker(t, store);
      await t.runAsync(() async {
        await t.tap(find.text('انتخاب عکس از گالری'));
        await Future<void>.delayed(const Duration(milliseconds: 80));
      });
      await t.pump(const Duration(milliseconds: 400));
      await t.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 80)),
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
      expect(find.byType(ProfilePhotoPicker), findsOneWidget);
      expect(store.profilePhoto, isNull);
      await t.ensureVisible(find.byKey(const ValueKey('profile-photo-save')));
      await t.tap(find.byKey(const ValueKey('profile-photo-save')));
      await t.pumpAndSettle();
      expect(store.profilePhoto, isNotNull);
      expect(find.byType(ProfilePhotoPicker), findsNothing);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'an avatar saves from the profile sheet without changing account fields and restores after restart',
    (t) async {
      Map<String, dynamic>? saved;
      String? serverPhoto;
      final auth = CustomerAuth(
        baseUrl: 'https://fixture.test',
        storage: TokenMemory(),
        client: MockClient((request) async {
          if (request.url.path.startsWith('/v1/auth/')) {
            return http.Response(jsonEncode(issued()), 200);
          }
          if (request.method == 'PATCH') {
            saved = jsonDecode(request.body) as Map<String, dynamic>;
            serverPhoto = saved!['photo'] as String;
          }
          return http.Response(
            jsonEncode({
              'details': {'photo': serverPhoto},
            }),
            200,
          );
        }),
      );
      final store = DemoStore(customerAuth: auth);
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await store.verifyLoginCode('09123456789', '123456');
      await openPicker(t, store);
      expect(find.byType(ProfilePhotoPicker), findsOneWidget);
      expect(
        find
            .byType(Tooltip)
            .evaluate()
            .where(
              (e) =>
                  (e.widget as Tooltip).message?.startsWith('آواتار ') ?? false,
            ),
        hasLength(6),
      );
      await saveAvatar(t, 3);
      expect(saved!.keys, ['photo']);
      expect(store.profilePhoto, serverPhoto);
      expect(find.byType(ProfilePhotoPicker), findsNothing);
      expect(
        t.widget<PersonAvatar>(find.byType(PersonAvatar)).photo,
        serverPhoto,
      );
      store.profilePhoto = null;
      await store.loadHomePhoto();
      expect(store.profilePhoto, serverPhoto);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'a photo-only account still loads measurements from onboarding in personal details',
    (t) async {
      late String photo;
      await t.runAsync(() async {
        photo = base64Encode(await cropTestPhoto());
      });
      final auth = CustomerAuth(
        baseUrl: 'https://fixture.test',
        storage: TokenMemory(),
        client: MockClient((request) async {
          if (request.url.path.startsWith('/v1/auth/')) {
            return http.Response(jsonEncode(issued()), 200);
          }
          return http.Response(
            jsonEncode(
              request.url.path.endsWith('/onboarding')
                  ? {
                      'nextStep': 'enter_app',
                      'profile': {
                        'track': 'healthy',
                        'bmi': 22,
                        'weightKg': 60,
                        'heightCm': 165,
                        'age': 28,
                        'bmrKcal': 1400,
                        'tdeeKcal': 1900,
                        'targetKcal': 1900,
                        'proteinG': 90,
                        'carbsG': 240,
                        'fatG': 65,
                      },
                    }
                  : {
                      'details': {'photo': photo},
                    },
            ),
            200,
          );
        }),
      );
      final store = DemoStore(customerAuth: auth);
      addTearDown(() {
        store.dispose();
        auth.dispose();
      });
      await store.verifyLoginCode('09123456789', '123456');
      await t.pumpWidget(MaterialApp(home: PersonalDetails(store: store)));
      await t.pumpAndSettle();
      expect(
        t
            .widget<TextFormField>(
              find.byKey(const ValueKey('personal-details-field-1')),
            )
            .controller!
            .text,
        '28',
      );
      expect(
        t
            .widget<TextFormField>(
              find.byKey(const ValueKey('personal-details-field-3')),
            )
            .controller!
            .text,
        '165.0',
      );
      expect(
        t
            .widget<TextFormField>(
              find.byKey(const ValueKey('personal-details-field-4')),
            )
            .controller!
            .text,
        '60.0',
      );
      expect(
        (t.widget<CircleAvatar>(find.byType(CircleAvatar)).backgroundImage!
                as MemoryImage)
            .bytes,
        base64Decode(photo),
      );
      expect(find.text('خواندن اطلاعات ذخیره‌شده ممکن نشد.'), findsNothing);
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('local avatar saves preserve personal details and are restored', (
    t,
  ) async {
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    final key = 'personal_details:${store.feedbackOwner}';
    const fields = ['سارا', '28', '09123456789', '165', '60'];
    FlutterSecureStorage.setMockInitialValues({
      key: jsonEncode({'fields': fields, 'photo': null}),
    });
    await openPicker(t, store);
    await saveAvatar(t, 0);
    final photo = store.profilePhoto;
    final cache =
        jsonDecode((await const FlutterSecureStorage().read(key: key))!) as Map;
    expect(cache['fields'], fields);
    expect(cache['photo'], photo);
    final restored = DemoStore()..loginDemoUser();
    addTearDown(restored.dispose);
    expect(restored.canLoadProfilePhoto, isTrue);
    await restored.loadHomePhoto();
    expect(restored.profilePhoto, photo);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('cancel leaves the current photo unchanged', (t) async {
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    await t.runAsync(() async {
      store.profilePhoto = base64Encode(await ProfileAvatar.presets[1].png());
    });
    final original = store.profilePhoto;
    await openPicker(t, store);
    await t.tap(find.byKey(const ValueKey('profile-avatar-2')));
    await t.pump();
    await t.tap(find.byTooltip('بستن'));
    await t.pumpAndSettle();
    expect(store.profilePhoto, original);
    expect(find.byType(ProfilePhotoPicker), findsNothing);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets('failed save stays open for retry on a narrow screen', (t) async {
    t.view.physicalSize = const Size(320, 720);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    var saves = 0;
    Uint8List? saved;
    await t.pumpWidget(
      MaterialApp(
        theme: appTheme(),
        builder: (_, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
        home: Scaffold(
          body: RepaintBoundary(
            key: const ValueKey('preview'),
            child: ProfilePhotoPicker(
              onSave: (bytes) async {
                saves++;
                if (saves == 1) throw StateError('offline');
                saved = bytes;
              },
            ),
          ),
        ),
      ),
    );
    await saveAvatar(t, 5);
    expect(find.text('عکس ذخیره نشد. دوباره امتحان کن.'), findsOneWidget);
    expect(saved, isNull);
    expect(t.takeException(), isNull);
    await saveAvatar(t, 5);
    expect(saves, 2);
    expect(saved!.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'all designed avatars produce distinct square photos within the account size limit',
    (t) async {
      final images = <String>{};
      await t.runAsync(() async {
        for (final avatar in ProfileAvatar.presets) {
          final bytes = await avatar.png();
          images.add(base64Encode(bytes));
          expect(base64Encode(bytes).length, lessThan(450000));
          final codec = await ui.instantiateImageCodec(bytes);
          final frame = await codec.getNextFrame();
          expect(frame.image.width, 320);
          expect(frame.image.height, 320);
          frame.image.dispose();
          codec.dispose();
        }
      });
      expect(images, hasLength(6));
    },
  );
}
