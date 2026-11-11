(() => {
  const byId = id => document.getElementById(id);
  const status = byId('checkout-status');
  const select = byId('checkout-plan-choice');
  const price = new Intl.NumberFormat('fa-IR');
  let session;
  let order;
  let creating = false;
  let startingGateway = false;
  let method = 'gateway';
  let gatewayResult = new URLSearchParams(location.search).get('gateway');

  let refreshing;
  async function refreshSession() {
    if (!refreshing) refreshing = (async () => {
      const response = await fetch('/v1/auth/refresh', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-sabzine-client': 'web' },
        body: '{}', signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !data.accessToken || data.role !== 'user') return false;
      session.token = data.accessToken;
      sessionStorage.setItem('mydiet.checkout', JSON.stringify(session));
      return true;
    })().catch(() => false).finally(() => { refreshing = null; });
    return refreshing;
  }

  async function request(path = '', payload, retry = true) {
    const response = await fetch('/v1/me/onboarding-transfers' + path, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401) {
      if (retry && await refreshSession()) return request(path, payload, false);
      byId('checkout-return').hidden = false;
      throw new Error('نشست پرداخت منقضی شده است. برای ادامه، به آنبوردینگ برگردید و شماره همراه را دوباره تأیید کنید.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.messageFa || 'ارتباط با سرویس پرداخت برقرار نشد؛ دوباره تلاش کنید.');
    return data;
  }

  function render() {
    if (!order) return;
    const remaining = Math.max(0, Math.ceil((Date.parse(order.expires_at) - Date.now()) / 1000));
    byId('checkout-timer').textContent = [Math.floor(remaining / 60), remaining % 60].map(n => String(n).padStart(2, '0')).join(':');
    const payable = !order.confirmed_at && (remaining > 0 || order.gateway_started);
    byId('checkout-methods').hidden = !payable || order.gateway_started;
    byId('checkout-gateway').hidden = !payable || (!order.gateway_started && method !== 'gateway');
    byId('checkout-transfer').hidden = !payable || order.gateway_started || method !== 'transfer';
    byId('gateway-amount').textContent = price.format(order.amount_toman) + ' تومان';
    byId('checkout-plan').hidden = Boolean(order.confirmed_at);
    byId('copy-amount').textContent = price.format(order.amount_toman) + ' تومان · کپی مبلغ';
    window.demoTracking?.step(order.confirmed_at ? 'payment_success' :
      order.gateway_started || method === 'gateway' ? 'payment_gateway' : 'payment_transfer');
    status.hidden = false;
    if (order.confirmed_at) status.textContent = 'پرداخت شما تأیید شد.';
    else if (gatewayResult === 'cancelled') status.textContent = 'پرداخت آنلاین تکمیل نشد. می‌توانید دوباره به درگاه بروید.';
    else if (gatewayResult === 'pending') status.textContent = 'پرداخت هنوز تأیید نشده است. اگر مبلغ کسر شده، به پشتیبانی پیام دهید.';
    else if (order.gateway_started) status.textContent = 'منتظر تکمیل پرداخت در زیبال';
    else if (remaining && method === 'transfer') status.textContent = 'منتظر واریز و بررسی پشتیبانی';
    else if (remaining) { status.textContent = ''; status.hidden = true; }
    else status.textContent = 'مهلت واریز تمام شد. اگر واریز کرده‌اید با پشتیبانی تماس بگیرید.';
  }

  async function create(plan) {
    if (creating) return;
    creating = true;
    try {
      order = await request('', { plan, submissionId: session.submissionId });
      session.plan = order.plan;
      sessionStorage.setItem('mydiet.checkout', JSON.stringify(session));
      select.value = order.plan;
      byId('checkout-content').hidden = false;
      render();
    } catch (error) {
      status.hidden = false;
      status.textContent = error.message;
      if (!order) byId('checkout-return').hidden = false;
    } finally {
      creating = false;
    }
  }

  try { session = JSON.parse(sessionStorage.getItem('mydiet.checkout')); } catch {}
  if (!session?.token || !session?.submissionId) {
    status.textContent = 'برای ورود به صفحه پرداخت، ابتدا شماره همراه را تأیید کنید.';
    byId('checkout-return').hidden = false;
    return;
  }

  byId('checkout-methods').addEventListener('click', event => {
    const button = event.target.closest('button[data-method]');
    if (!button) return;
    method = button.dataset.method;
    for (const option of byId('checkout-methods').querySelectorAll('button')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    render();
  });
  byId('pay-gateway').addEventListener('click', async () => {
    if (!order || creating || startingGateway) return;
    startingGateway = true;
    const button = byId('pay-gateway');
    button.disabled = true;
    const label = button.innerHTML;
    button.textContent = 'در حال اتصال به زیبال…';
    try {
      const payment = await request('/' + encodeURIComponent(order.id) + '/zibal', {});
      location.assign(payment.url);
    } catch (error) {
      status.hidden = false;
      status.textContent = error.message;
      startingGateway = false;
      button.disabled = false;
      button.innerHTML = label;
    }
  });
  byId('checkout-plan').addEventListener('submit', event => {
    event.preventDefault();
    if (!startingGateway) {
      gatewayResult = null;
      void create(select.value);
    }
  });
  byId('copy-amount').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(order.amount_toman));
      byId('copy-amount').textContent = price.format(order.amount_toman) + ' تومان · کپی شد';
    } catch {
      status.hidden = false;
      status.textContent = 'کپی خودکار ممکن نیست. مبلغ را دستی وارد کنید.';
    }
  });
  setInterval(() => {
    if (order) {
      const remaining = Math.max(0, Math.ceil((Date.parse(order.expires_at) - Date.now()) / 1000));
      byId('checkout-timer').textContent = [Math.floor(remaining / 60), remaining % 60].map(n => String(n).padStart(2, '0')).join(':');
      if (!remaining && !byId('checkout-methods').hidden) render();
    }
  }, 1000);
  setInterval(async () => {
    if (!order || order.confirmed_at || creating) return;
    const id = order.id;
    try {
      const fresh = await request('/' + encodeURIComponent(id));
      if (!creating && order.id === id && fresh.confirmed_at) {
        order = fresh;
        render();
      }
    } catch {}
  }, 8000);
  const returnedOrder = new URLSearchParams(location.search).get('order');
  if (returnedOrder) {
    void request('/' + encodeURIComponent(returnedOrder)).then(data => {
      order = data;
      select.value = data.plan;
      byId('checkout-content').hidden = false;
      render();
    }).catch(error => {
      status.hidden = false;
      status.textContent = error.message;
      byId('checkout-return').hidden = false;
    });
  } else {
    void create(session.plan);
  }
})();
