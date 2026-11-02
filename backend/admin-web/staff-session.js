/* Shared, cookie-backed staff session. No tokens are persisted in browser storage. */
(() => {
  class StaffError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
  }
  function create({ role, onExpired = () => {} }) {
    let actorId=null;
    let token = null, expiresAt = 0, refreshing = null;
    const request = async (path, method = 'GET', body, headers = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/v1/' + path, {
          method, credentials: 'same-origin', signal: controller.signal,
          headers: { ...headers, 'Content-Type': 'application/json', 'x-sabzine-client': 'web',
            ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new StaffError(data.detail || data.message || 'دریافت اطلاعات انجام نشد.', response.status);
        return data;
      } catch (error) {
        if (error instanceof StaffError) throw error;
        throw new StaffError('ارتباط با سرور برقرار نشد. اتصال را بررسی کنید.');
      } finally { clearTimeout(timer); }
    };
    const clear = () => { token = null; actorId=null; expiresAt = 0; };
    const accept = session => {
      if (session.role !== role) {
        clear();
        throw new StaffError('این حساب اجازه ورود به این پنل را ندارد.', 403);
      }
      const expiry = Date.parse(session.sessionExpiresAt);
      if (!session.accessToken || !Number.isFinite(expiry) || expiry <= Date.now()) {
        clear(); throw new StaffError('نشست منقضی شده؛ دوباره وارد شوید.', 401);
      }
      token = session.accessToken;
      try{actorId=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||null;}catch{actorId=null;}
      expiresAt = expiry;
      return session;
    };
    const restore = () => refreshing ||= request('auth/refresh', 'POST', {}).then(accept).finally(() => { refreshing = null; });
    const api = async (path, method = 'GET', body, headers = {}) => {
      if (!token || Date.now() >= expiresAt) {
        clear(); onExpired(); throw new StaffError('برای ادامه وارد حساب شوید.', 401);
      }
      try { return await request(path, method, body, headers); }
      catch (error) {
        if (error.status !== 401) throw error;
        try { await restore(); }
        catch (failure) {
          if (failure.status === 401 || failure.status === 403) { clear(); onExpired(); }
          throw failure;
        }
        try { return await request(path, method, body, headers); }
        catch (failure) {
          if (failure.status === 401) { clear(); onExpired(); }
          throw failure;
        }
      }
    };
    return { api, accept, restore, clear,
      login: (path, body) => request(path, 'POST', body),
      async logout() { await api('auth/logout', 'POST'); clear(); },
      get actorId(){return actorId;},
      get active() { return !!token && Date.now() < expiresAt; },
    };
  }
  globalThis.SabzineStaff = { create, StaffError };
})();
