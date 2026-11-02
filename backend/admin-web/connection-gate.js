/* Connection gate. A real /health/live request decides the state. HTTP 404 means the server answered. */
function classifyResponse(status, aborted) {
  if (aborted) return 'timeout';
  if (status === 401) return 'expired';
  if (status === 503 || (typeof status === 'number' && status >= 500)) return 'unavailable';
  if (status == null) return 'offline';
  return null;
}

async function probe(fetchImpl) {
  var fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) return 'offline';
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (controller) controller.abort(); }, 5000);
  try {
    var response = await fetchFn('/health/live', {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    return classifyResponse(response.status, false);
  } catch (error) {
    if (error && error.name === 'AbortError') return 'timeout';
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

var connectionTitles = {
  offline: 'ارتباط برقرار نیست',
  unavailable: 'سرویس موقتاً در دسترس نیست',
  timeout: 'پاسخ سرور به‌موقع نرسید',
  expired: 'نشست پایان یافته',
};

var connectionFault = null;

function paintConnection(doc, fault, checking) {
  var screen = doc.getElementById('connection-screen');
  if (!screen) return;
  screen.hidden = !fault;
  var title = doc.getElementById('connection-title');
  if (title) title.textContent = checking ? 'در حال بررسی اتصال' : (connectionTitles[fault] || '');
  var button = doc.getElementById('connection-retry');
  if (button) {
    button.disabled = !!checking;
    button.textContent = checking ? 'در حال بررسی اتصال' : 'تلاش دوباره';
  }
}

function ensureConnection(doc) {
  if (doc.getElementById('connection-screen')) return;
  var style = doc.createElement('style');
  style.textContent = '#connection-screen{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:#f7f8f0;color:#233c2d;text-align:center;padding:28px}#connection-screen[hidden]{display:none}#connection-screen h1{font-size:22px;font-weight:600}#connection-screen button{background:#205638;color:#fff;border:0;border-radius:12px;padding:12px 18px;font:inherit;cursor:pointer}#connection-screen button:disabled{opacity:.6}';
  doc.head.appendChild(style);
  var screen = doc.createElement('section');
  screen.id = 'connection-screen';
  screen.hidden = true;
  screen.setAttribute('role', 'alertdialog');
  screen.setAttribute('aria-labelledby', 'connection-title');
  screen.innerHTML = '<div><strong style="color:#205638;font-size:28px">سبزینه</strong><h1 id="connection-title"></h1><p>برنامهٔ ذخیره‌شده به‌صورت آفلاین نمایش داده نمی‌شود.</p><button id="connection-retry" type="button">تلاش دوباره</button></div>';
  doc.body.appendChild(screen);
}

async function refreshConnection(doc, fetchImpl) {
  paintConnection(doc, connectionFault, true);
  connectionFault = await probe(fetchImpl);
  paintConnection(doc, connectionFault, false);
}

function installConnection(doc, fetchImpl) {
  var root = doc || (typeof document !== 'undefined' ? document : null);
  if (!root || !root.body) return;
  ensureConnection(root);
  var button = root.getElementById('connection-retry');
  if (button) button.onclick = function () { refreshConnection(root, fetchImpl); };
  refreshConnection(root, fetchImpl);
}

var SabzineConnection = {
  classifyResponse: classifyResponse,
  probe: probe,
  install: installConnection,
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { installConnection(); });
  } else {
    installConnection();
  }
}
