(() => {
  const byId = id => document.getElementById(id);
  const status = byId('checkout-status');
  const select = byId('checkout-plan-choice');
  const price = new Intl.NumberFormat('fa-IR');
  let session;
  let order;
  let creating = false;

  async function request(path = '', payload) {
    const response = await fetch('/v1/me/onboarding-transfers' + path, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
    if (response.status === 401) byId('checkout-return').hidden = false;
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'ارتباط با سرویس پرداخت برقرار نشد');
    return data;
  }

  function render() {
    if (!order) return;
    const remaining = Math.max(0, Math.ceil((Date.parse(order.expires_at) - Date.now()) / 1000));
    byId('checkout-timer').textContent = [Math.floor(remaining / 60), remaining % 60].map(n => String(n).padStart(2, '0')).join(':');
    byId('checkout-transfer').hidden = Boolean(order.confirmed_at) || !remaining;
    byId('checkout-plan').hidden = Boolean(order.confirmed_at);
    byId('copy-amount').textContent = price.format(order.amount_toman) + ' تومان · کپی مبلغ';
    status.textContent = order.confirmed_at ? 'پرداخت شما تأیید شد.' : remaining
      ? 'منتظر واریز و بررسی پشتیبانی'
      : 'مهلت واریز تمام شد. اگر واریز کرده‌اید با پشتیبانی تماس بگیرید.';
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

  byId('checkout-plan').addEventListener('submit', event => {
    event.preventDefault();
    void create(select.value);
  });
  byId('copy-amount').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(order.amount_toman));
      byId('copy-amount').textContent = price.format(order.amount_toman) + ' تومان · کپی شد';
    } catch {
      status.textContent = 'کپی خودکار ممکن نیست. مبلغ را دستی وارد کنید.';
    }
  });
  setInterval(() => {
    if (order) {
      const remaining = Math.max(0, Math.ceil((Date.parse(order.expires_at) - Date.now()) / 1000));
      byId('checkout-timer').textContent = [Math.floor(remaining / 60), remaining % 60].map(n => String(n).padStart(2, '0')).join(':');
      if (!remaining && !byId('checkout-transfer').hidden) render();
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
  void create(session.plan);
})();
