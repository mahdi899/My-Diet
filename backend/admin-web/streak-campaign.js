/* Demo campaign store. It does not call the live reward API. */
  const resetRule = 'اگر یک روز وعده‌ها ثبت نشود، شمارش روزهای پیاپی از نو شروع می‌شود. ورود به برنامه یک روز را کامل نمی‌کند.';
  const todayRule = 'امروز همهٔ وعده‌های برنامه باید به‌عنوان مصرف‌شده ثبت شوند.';

  function addDays(iso, count) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
  }
  function diffDays(later, earlier) {
    return Math.round((Date.parse(later + 'T00:00:00Z') - Date.parse(earlier + 'T00:00:00Z')) / 86400000);
  }
  function freshCampaign() {
    return {
      version: 1,
      consecutiveDays: 7,
      milestones: [{ day: 7, amountToman: 200000 }],
      qualifyingRule: 'recorded_meals',
      startsOn: '2026-10-24',
      endsOn: null,
      effectiveOn: '2026-10-24',
      repeat: 'cycle',
      participantPolicy: 'finish_current_version',
    };
  }
  function createRepository() {
    let campaign = freshCampaign();
    const versions = [structuredClone(campaign)];
    const users = new Map();
    function user(id) {
      if (!users.has(id)) users.set(id, { qualified: new Set(), partial: new Set(), issued: new Set(), wallet: 0, ledger: [], lock: null, lockCycle: null });
      return users.get(id);
    }
    function normalize(input) {
      const days = Number(input.consecutiveDays);
      const milestones = (input.milestones || []).map(item => ({ day: Number(item.day), amountToman: Number(item.amountToman) }));
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('تعداد روزهای پیاپی باید بین ۱ و ۳۰ باشد.');
      if (!milestones.length || milestones.some(item => !Number.isInteger(item.day) || item.day < 1 || item.day > days || !Number.isInteger(item.amountToman) || item.amountToman < 0)) {
        throw new Error('مایل‌ستون‌های کمپین را بررسی کن.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn || '') || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn || '')) throw new Error('تاریخ شروع نامعتبر است.');
      if (input.endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) throw new Error('تاریخ پایان نامعتبر است.');
      return {
        consecutiveDays: days,
        milestones: milestones.sort((a, b) => a.day - b.day),
        qualifyingRule: 'recorded_meals',
        startsOn: input.startsOn,
        endsOn: input.endsOn || null,
        effectiveOn: input.effectiveOn,
        repeat: input.repeat === 'none' ? 'none' : 'cycle',
        participantPolicy: 'finish_current_version',
      };
    }
    function rulesFor(person, today) {
      const length = person.lock?.consecutiveDays || campaign.consecutiveDays;
      const anchor = (person.lock || campaign).startsOn;
      const elapsed = diffDays(today, anchor);
      const cycle = elapsed < 0 ? 0 : Math.floor(elapsed / length);
      const cycleStart = addDays(anchor, cycle * length);
      if (person.lockCycle && person.lockCycle !== cycleStart) {
        person.lock = null;
        person.lockCycle = null;
      }
      if (person.lock && person.lockCycle === cycleStart) return { rules: person.lock, cycleStart };
      const cycleEnd = addDays(cycleStart, length);
      const active = [...person.qualified, ...person.partial].some(date => date >= cycleStart && date < cycleEnd);
      if (!active) return { rules: campaign, cycleStart };
      person.lock = structuredClone(campaign);
      person.lockCycle = cycleStart;
      return { rules: person.lock, cycleStart };
    }
    function snapshot(id, today, claim) {
      const person = user(id);
      const { rules, cycleStart } = rulesFor(person, today);
      const dates = Array.from({ length: rules.consecutiveDays }, (_, index) => addDays(cycleStart, index));
      let consecutive = 0;
      const days = [];
      if (rules.repeat === 'none' && diffDays(cycleStart, rules.startsOn) > 0) {
        return { version: rules.version, days: [], consecutive: 0, requiredDays: rules.consecutiveDays, todayRequirements: todayRule, resetRule, milestones: rules.milestones, claimState: 'idle', grants: [], wallet: person.wallet };
      }
      for (const date of dates) {
        if (date < rules.effectiveOn || (rules.endsOn && date > rules.endsOn)) {
          days.push({ date, state: 'pending' });
          continue;
        }
        if (date > today) days.push({ date, state: 'pending' });
        else if (person.qualified.has(date)) {
          consecutive += 1;
          days.push({ date, state: 'qualified' });
        } else if (date === today && person.partial.has(date)) days.push({ date, state: 'pending_verification' });
        else if (date < today) {
          consecutive = 0;
          days.push({ date, state: 'missed' });
        } else days.push({ date, state: 'pending' });
      }
      const grants = [];
      let issued = false;
      for (const milestone of rules.milestones) {
        if (consecutive < milestone.day || milestone.amountToman <= 0) continue;
        const rewardId = `streak-reward-v${rules.version}-${cycleStart}-d${milestone.day}`;
        const index = milestone.day - 1;
        if (person.issued.has(rewardId)) {
          issued = true;
          if (days[index]?.state === 'qualified') days[index] = { date: days[index].date, state: 'rewarded' };
          continue;
        }
        if (!claim) continue;
        person.issued.add(rewardId);
        const operationId = milestone.day === rules.consecutiveDays ? `weekly-reward-${cycleStart}` : `weekly-reward-${cycleStart}-d${milestone.day}`;
        if (!person.ledger.some(item => item.operationId === operationId)) {
          person.wallet += milestone.amountToman;
          person.ledger.push({ operationId, amountToman: milestone.amountToman, day: milestone.day });
        }
        grants.push({ id: rewardId, day: milestone.day, amountToman: milestone.amountToman, weekKey: cycleStart });
        if (days[index]?.state === 'qualified') days[index] = { date: days[index].date, state: 'rewarded' };
      }
      return {
        version: rules.version,
        days,
        consecutive,
        requiredDays: rules.consecutiveDays,
        todayRequirements: todayRule,
        resetRule,
        milestones: rules.milestones,
        claimState: grants.length ? 'confirmed' : claim && issued ? 'duplicate' : 'idle',
        grants,
        wallet: person.wallet,
        ledger: person.ledger.map(item => ({ ...item })),
      };
    }
    return {
      current: () => structuredClone(campaign),
      versions: () => versions.map(item => structuredClone(item)),
      save(input) {
        const next = normalize(input);
        next.version = campaign.version + 1;
        campaign = next;
        versions.push(structuredClone(next));
        return structuredClone(next);
      },
      login: (id, today) => snapshot(id, today, false),
      recordDay(id, date, complete) {
        const person = user(id);
        if (complete) {
          person.qualified.add(date);
          person.partial.delete(date);
        } else {
          person.qualified.delete(date);
          person.partial.add(date);
        }
        return snapshot(id, date, false);
      },
      claim: (id, today) => snapshot(id, today, true),
      wallet: id => user(id).wallet,
    };
  }

  function campaignPage() {
    const repo = campaignPage.demo;
    const layout = element('div', null, 'settings-layout');
    const card = element('section', null, 'card form-card');
    const current = repo.current();
    card.append(sectionHead('کمپین روزهای پیاپی', 'نسخهٔ ' + current.version + ' در نمونهٔ همین مرورگر.', iconTile('calendar')));
    card.append(infoNote('این پیکربندی به سرور زنده فرستاده نمی‌شود. روز فقط با ثبت وعده‌ها واجد شرایط می‌شود و ورود کاربر روز را کامل نمی‌کند. پاداش واقعی باید در سرور، یک‌بار و بعد از تأیید، به کیف پول بنشیند.'));
    const form = element('form');
    const days = field(form, 'consecutiveDays', 'تعداد روزهای پیاپی', 'number', String(current.consecutiveDays));
    days.min = '1'; days.max = '30';
    const midDay = field(form, 'milestoneDay', 'روز مایل‌ستون میانی', 'number', '3'); midDay.required = false; midDay.min = '1';
    const midAmount = field(form, 'milestoneAmount', 'مبلغ مایل‌ستون میانی (تومان)', 'number', '0'); midAmount.required = false; midAmount.min = '0';
    const finalAmount = field(form, 'finalAmount', 'مبلغ روز پایانی (تومان)', 'number', String(current.milestones.at(-1).amountToman));
    finalAmount.min = '0';
    const starts = field(form, 'startsOn', 'شروع دوره', 'date', current.startsOn);
    const effective = field(form, 'effectiveOn', 'تاریخ اثر نسخه', 'date', current.effectiveOn);
    const ends = field(form, 'endsOn', 'پایان دوره', 'date', current.endsOn || ''); ends.required = false;
    const repeat = field(form, 'repeat', 'تکرار', 'select', current.repeat);
    repeat.append(Object.assign(element('option', 'هر دوره از نو'), { value: 'cycle' }), Object.assign(element('option', 'فقط یک دوره'), { value: 'none' }));
    repeat.value = current.repeat;
    form.append(infoNote('کسی که دوره را شروع کرده، تا پایان همان دوره روی نسخه‌ای که با آن شروع کرده می‌ماند.'));
    form.append(formFooter('انتشار نسخهٔ نمونه', 'check'));
    onForm(form, async body => {
      const milestones = [];
      const mid = Number(body.milestoneDay), midValue = Number(body.milestoneAmount);
      if (mid && midValue > 0) milestones.push({ day: mid, amountToman: midValue });
      milestones.push({ day: Number(body.consecutiveDays), amountToman: Number(body.finalAmount) });
      repo.save({
        consecutiveDays: Number(body.consecutiveDays),
        milestones,
        startsOn: body.startsOn,
        effectiveOn: body.effectiveOn,
        endsOn: body.endsOn || null,
        repeat: body.repeat,
      });
      notice('نسخهٔ جدید فقط در نمونه ذخیره شد.');
      await load();
    });
    card.append(form);
    const preview = element('div', null, 'info-note');
    const sample = repo.login('preview', '2026-10-24');
    preview.append(element('p', 'نمونهٔ ورود در ۲۴ مهر: ' + sample.consecutive + ' روز واجد شرایط. ' + sample.resetRule));
    const actions = element('div', null, 'form-submit');
    actions.append(button('ثبت ۷ روز نمونه', () => {
      for (let day = 0; day < 7; day += 1) repo.recordDay('preview', addDays('2026-10-24', day), true);
      const result = repo.claim('preview', '2026-10-30');
      notice(result.claimState === 'confirmed' ? 'پاداش نمونه یک‌بار ثبت شد.' : 'این پاداش قبلاً ثبت شده است.');
      load();
    }, { iconName: 'check' }));
    card.append(preview, actions);
    const history = element('section', null, 'card');
    history.append(sectionHead('نسخه‌های منتشرشده در نمونه', 'کاربران داخل دوره نسخهٔ قبلی را تمام می‌کنند.', iconTile('history')));
    for (const version of repo.versions()) {
      history.append(element('p', 'نسخهٔ ' + version.version + ' · ' + version.consecutiveDays + ' روز · از ' + version.effectiveOn));
    }
    layout.append(card, history);
    return layout;
  }
  campaignPage.demo = createRepository();
var SabzineStreak = { createRepository: createRepository, campaignPage: campaignPage };
