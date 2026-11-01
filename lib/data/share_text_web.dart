import 'dart:js_interop';

@JS('navigator')
external JSObject get _navigator;
extension type _ShareNavigator(JSObject _) implements JSObject {
  external JSFunction? get share;
}
@JS()
extension type _ShareData._(JSObject _) implements JSObject {
  external factory _ShareData({String title, String text});
}

Future<bool> shareShoppingText(String text) async {
  final share = _ShareNavigator(_navigator).share;
  if (share == null) return false;
  // A rejected/cancelled share is not reported as successfully delivered.
  final promise =
      share.callAsFunction(
            _navigator,
            _ShareData(title: 'لیست خرید سبزینه', text: text),
          )
          as JSPromise<JSAny?>;
  await promise.toDart;
  return true;
}
