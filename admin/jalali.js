/* Jalali date field. The submitted value stays a Gregorian YYYY-MM-DD. */
(() => {
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const week = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  function div(a, b) { return ~~(a / b); }

  function gregorianToJalali(gy, gm, gd) {
    const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + gdm[gm - 1];
    let jy = -1595 + (33 * div(days, 12053));
    days %= 12053;
    jy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      jy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    if (days < 186) return [jy, 1 + div(days, 31), 1 + (days % 31)];
    return [jy, 7 + div(days - 186, 30), 1 + ((days - 186) % 30)];
  }

  function jalaliToGregorian(jy, jm, jd) {
    let year = jy + 1595;
    let days = -355668 + (365 * year) + (div(year, 33) * 8) + div((year % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) {
      gy += div(days - 1, 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    const lengths = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 1;
    for (; gm <= 12 && gd > lengths[gm]; gm++) gd -= lengths[gm];
    return [gy, gm, gd];
  }

  function monthLength(jy, jm) {
    if (jm < 7) return 31;
    if (jm < 12) return 30;
    const [gy, gm, gd] = jalaliToGregorian(jy, 12, 30);
    const back = gregorianToJalali(gy, gm, gd);
    return back[0] === jy && back[1] === 12 && back[2] === 30 ? 30 : 29;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(gy, gm, gd) { return `${gy}-${pad(gm)}-${pad(gd)}`; }
  function fa(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

  function jalaliField(parent, name, label) {
    const wrap = document.createElement('div');
    wrap.className = 'jalali-field';
    const caption = document.createElement('span');
    caption.className = 'jalali-caption';
    caption.textContent = label;
    wrap.append(caption);
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = name;
    hidden.required = true;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jalali-trigger secondary';
    button.textContent = 'انتخاب تاریخ تولد';
    const pop = document.createElement('div');
    pop.className = 'jalali-pop';
    pop.hidden = true;
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const today = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    let viewYear = today[0];
    let viewMonth = today[1];
    let yearPage = Math.max(1300, today[0] - 11);
    let mode = 'days';
    let picked = null;

    function step(labelText, disabled, run) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'secondary';
      control.textContent = labelText;
      control.disabled = disabled;
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (control.disabled) return;
        run();
        render();
      };
      return control;
    }

    function heading(text, nextMode) {
      if (!nextMode) {
        const title = document.createElement('strong');
        title.className = 'jalali-title';
        title.textContent = text;
        return title;
      }
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'jalali-title';
      control.textContent = text;
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        mode = nextMode;
        if (nextMode === 'years') yearPage = Math.min(Math.max(1300, viewYear - 11), Math.max(1300, today[0] - 11));
        render();
      };
      return control;
    }

    function choiceButton(text, selected, disabled, run) {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = text;
      control.disabled = disabled;
      if (selected) control.className = 'is-picked';
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (control.disabled) return;
        run();
      };
      return control;
    }

    function render() {
      pop.replaceChildren();
      const head = document.createElement('div');
      head.className = 'jalali-head';
      if (mode === 'days') {
        head.append(
          step('قبل', viewYear < 1300 || (viewYear === 1300 && viewMonth === 1), () => {
            if (viewMonth === 1) { viewMonth = 12; viewYear--; } else viewMonth--;
          }),
          heading(`${months[viewMonth - 1]} ${fa(viewYear)}`, 'months'),
          step('بعد', viewYear > today[0] || (viewYear === today[0] && viewMonth >= today[1]), () => {
            if (viewMonth === 12) { viewMonth = 1; viewYear++; } else viewMonth++;
          }),
        );
      } else if (mode === 'months') {
        head.append(
          step('قبل', viewYear <= 1300, () => { viewYear--; }),
          heading(fa(viewYear), 'years'),
          step('بعد', viewYear >= today[0], () => { viewYear++; }),
        );
      } else {
        const last = Math.min(today[0], yearPage + 11);
        head.append(
          step('قبل', yearPage <= 1300, () => { yearPage = Math.max(1300, yearPage - 12); }),
          heading(`${fa(yearPage)} – ${fa(last)}`, null),
          step('بعد', last >= today[0], () => { yearPage = Math.min(today[0] - 11, yearPage + 12); }),
        );
      }
      const body = document.createElement('div');
      if (mode === 'months') {
        body.className = 'jalali-months';
        months.forEach((name, index) => {
          const month = index + 1;
          const future = viewYear > today[0] || (viewYear === today[0] && month > today[1]);
          body.append(choiceButton(name, picked && picked[0] === viewYear && picked[1] === month, future, () => {
            viewMonth = month;
            mode = 'days';
            render();
          }));
        });
      } else if (mode === 'years') {
        body.className = 'jalali-years';
        for (let year = yearPage; year < yearPage + 12; year++) {
          const future = year > today[0];
          const past = year < 1300;
          body.append(choiceButton(fa(year), viewYear === year, future || past, () => {
            viewYear = year;
            if (viewYear === today[0] && viewMonth > today[1]) viewMonth = today[1];
            mode = 'months';
            render();
          }));
        }
      } else {
        body.className = 'jalali-days';
        for (const name of week) {
          const cell = document.createElement('span');
          cell.textContent = name;
          body.append(cell);
        }
        const [gy, gm, gd] = jalaliToGregorian(viewYear, viewMonth, 1);
        const start = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
        const offset = (start + 1) % 7;
        for (let i = 0; i < offset; i++) body.append(document.createElement('span'));
        const length = monthLength(viewYear, viewMonth);
        for (let day = 1; day <= length; day++) {
          const civil = jalaliToGregorian(viewYear, viewMonth, day);
          const value = iso(...civil);
          body.append(choiceButton(fa(day), picked && picked[0] === viewYear && picked[1] === viewMonth && picked[2] === day, value > todayIso, () => {
            picked = [viewYear, viewMonth, day];
            hidden.value = value;
            button.textContent = `${fa(viewYear)}/${fa(viewMonth)}/${fa(day)}`;
            pop.hidden = true;
            button.setAttribute('aria-expanded', 'false');
          }));
        }
      }
      pop.append(head, body);
    }

    button.onclick = () => {
      pop.hidden = !pop.hidden;
      button.setAttribute('aria-expanded', String(!pop.hidden));
      if (!pop.hidden) render();
    };
    pop.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', event => {
      if (!event.target.isConnected || wrap.contains(event.target)) return;
      pop.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    });
    wrap.append(button, hidden, pop);
    parent.append(wrap);
    return hidden;
  }

  function tehranParts(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const pick = type => {
      const found = parts.find(part => part.type === type);
      return found ? found.value : '00';
    };
    return {
      gy: Number(pick('year')), gm: Number(pick('month')), gd: Number(pick('day')),
      hour: pick('hour') === '24' ? 0 : Number(pick('hour')), minute: Number(pick('minute')),
    };
  }

  function dateTimeField(ariaLabel) {
    const wrap = document.createElement('div');
    wrap.className = 'jalali-field tracking-jalali';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'jalali-trigger secondary';
    trigger.setAttribute('aria-label', ariaLabel);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    const pop = document.createElement('div');
    pop.className = 'jalali-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', ariaLabel);
    const now = tehranParts(new Date());
    const today = gregorianToJalali(now.gy, now.gm, now.gd);
    const todayKey = today[0] * 10000 + today[1] * 100 + today[2];
    let viewYear = today[0], viewMonth = today[1], yearPage = Math.max(1400, today[0] - 11), mode = 'days';
    let picked = null, hour = now.hour, minute = now.minute, notify = () => {}, silent = false;

    function key(year, month, day) { return year * 10000 + month * 100 + day; }
    function caption() {
      if (!picked) return 'انتخاب تاریخ';
      return `${fa(picked[0])}/${fa(picked[1])}/${fa(picked[2])}  ${fa(pad(hour))}:${fa(pad(minute))}`;
    }
    function emit() {
      trigger.textContent = caption();
      if (!silent && picked) notify();
    }
    function date() {
      if (!picked) return null;
      const civil = jalaliToGregorian(picked[0], picked[1], picked[2]);
      const value = new Date(`${iso(civil[0], civil[1], civil[2])}T${pad(hour)}:${pad(minute)}:00+03:30`);
      return Number.isNaN(value.getTime()) ? null : value;
    }
    function setDate(value) {
      const parts = tehranParts(value);
      const jalali = gregorianToJalali(parts.gy, parts.gm, parts.gd);
      silent = true;
      picked = jalali;
      hour = parts.hour;
      minute = parts.minute;
      viewYear = jalali[0];
      viewMonth = jalali[1];
      trigger.textContent = caption();
      silent = false;
    }
    function step(text, disabled, run) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'secondary';
      control.textContent = text;
      control.disabled = disabled;
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (!control.disabled) { run(); render(); }
      };
      return control;
    }
    function heading(text, nextMode) {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'jalali-title';
      control.textContent = text;
      if (!nextMode) control.disabled = true;
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (!nextMode) return;
        mode = nextMode;
        if (nextMode === 'years') yearPage = Math.min(Math.max(1400, viewYear - 11), Math.max(1400, today[0] - 11));
        render();
      };
      return control;
    }
    function choice(text, selected, disabled, run) {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = text;
      control.disabled = disabled;
      if (selected) control.className = 'is-picked';
      control.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (!control.disabled) run();
      };
      return control;
    }
    function timeSelect(max, current, change) {
      const select = document.createElement('select');
      for (let n = 0; n < max; n++) {
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = fa(pad(n));
        if (n === current) option.selected = true;
        select.append(option);
      }
      select.addEventListener('change', () => change(Number(select.value)));
      return select;
    }
    function render() {
      pop.replaceChildren();
      const head = document.createElement('div');
      head.className = 'jalali-head';
      if (mode === 'days') {
        head.append(
          step('قبل', viewYear < 1400 || (viewYear === 1400 && viewMonth === 1), () => {
            if (viewMonth === 1) { viewMonth = 12; viewYear--; } else viewMonth--;
          }),
          heading(`${months[viewMonth - 1]} ${fa(viewYear)}`, 'months'),
          step('بعد', viewYear > today[0] || (viewYear === today[0] && viewMonth >= today[1]), () => {
            if (viewMonth === 12) { viewMonth = 1; viewYear++; } else viewMonth++;
          }),
        );
      } else if (mode === 'months') {
        head.append(
          step('سال قبل', viewYear <= 1400, () => { viewYear--; }),
          heading(fa(viewYear), 'years'),
          step('سال بعد', viewYear >= today[0], () => { viewYear++; }),
        );
      } else {
        const last = Math.min(today[0], yearPage + 11);
        head.append(
          step('قبل', yearPage <= 1400, () => { yearPage = Math.max(1400, yearPage - 12); }),
          heading(`${fa(yearPage)} تا ${fa(last)}`),
          step('بعد', last >= today[0], () => { yearPage = Math.min(Math.max(1400, today[0] - 11), yearPage + 12); }),
        );
      }
      const body = document.createElement('div');
      if (mode === 'months') {
        body.className = 'jalali-months';
        months.forEach((name, index) => {
          const month = index + 1;
          const futureMonth = viewYear > today[0] || (viewYear === today[0] && month > today[1]);
          body.append(choice(name, picked && picked[0] === viewYear && picked[1] === month, futureMonth, () => {
            viewMonth = month;
            mode = 'days';
            render();
          }));
        });
      } else if (mode === 'years') {
        body.className = 'jalali-years';
        for (let year = yearPage; year < yearPage + 12; year++) {
          body.append(choice(fa(year), viewYear === year, year > today[0] || year < 1400, () => {
            viewYear = year;
            if (viewYear === today[0] && viewMonth > today[1]) viewMonth = today[1];
            mode = 'months';
            render();
          }));
        }
      } else {
        body.className = 'jalali-days';
        for (const name of week) {
          const cell = document.createElement('span');
          cell.textContent = name;
          body.append(cell);
        }
        const [gy, gm, gd] = jalaliToGregorian(viewYear, viewMonth, 1);
        const offset = (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
        for (let i = 0; i < offset; i++) body.append(document.createElement('span'));
        for (let day = 1; day <= monthLength(viewYear, viewMonth); day++) {
          body.append(choice(fa(day), picked && key(...picked) === key(viewYear, viewMonth, day), key(viewYear, viewMonth, day) > todayKey, () => {
            picked = [viewYear, viewMonth, day];
            emit();
            render();
          }));
        }
        const time = document.createElement('div');
        time.className = 'tracking-jalali-time';
        const hourLabel = document.createElement('label');
        hourLabel.append('ساعت', timeSelect(24, hour, value => { hour = value; emit(); }));
        const minuteLabel = document.createElement('label');
        minuteLabel.append('دقیقه', timeSelect(60, minute, value => { minute = value; emit(); }));
        time.append(hourLabel, minuteLabel);
        pop.append(head, body, time);
        return;
      }
      pop.append(head, body);
    }
    function close() {
      pop.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    trigger.onclick = event => {
      event.stopPropagation();
      pop.hidden = !pop.hidden;
      trigger.setAttribute('aria-expanded', String(!pop.hidden));
      if (!pop.hidden) render();
    };
    pop.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', event => {
      if (!event.target.isConnected || wrap.contains(event.target)) return;
      close();
    });
    trigger.textContent = caption();
    wrap.append(trigger, pop);
    return { wrap, date, setDate, close, set onChange(fn) { notify = fn; } };
  }

  globalThis.SabzineJalali = { jalaliField, dateTimeField, gregorianToJalali, jalaliToGregorian };
})();
