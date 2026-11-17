// A local overlay in the existing above-composer portal. Does not access the prompt.
(() => {
  if (window.__localCodexCalendar) return;
  window.__localCodexCalendar = true;
  const tag = 'local-codex-usage-calendar';
  let data, error, scheduled = false;
  const liveUsage = new Map();
  let activeThread;
  let quota;
  let accountLabel = '正在读取账号…';
  let planType, accountType;
  const planNames = { free: 'Free', plus: 'Plus', pro: 'Pro', team: 'Team', business: 'Business', enterprise: 'Enterprise', edu: 'Edu' };
  const node = document.createElement('section');
  node.className = 'cuc-card';
  node.setAttribute('aria-label', 'Codex 使用日历');
  const compact = value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
  const number = value => new Intl.NumberFormat('zh-CN').format(value || 0);
  const iso = value => value.toISOString().slice(0, 10);
  function el(type, cls, text) {
    const item = document.createElement(type);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function render() {
    node.replaceChildren();
    const surface = el('div', 'cuc-foreground');
    const live = liveUsage.get(activeThread);
    const todayEntry = data?.days.find(day => day.date === data.today);
    const today = todayEntry?.total_tokens || 0;
    const meter = el('div', 'cuc-meter');
    meter.append(el('span', 'cuc-meter-label', live !== undefined ? '会话 TOKENS' : '今日 TOKENS'), el('strong', 'cuc-meter-value', live !== undefined ? compact(live) : data ? compact(today) : '—'));
    const account = el('span', 'cuc-account', accountLabel);
    account.title = accountLabel;
    const accountRow = el('div', 'cuc-account-row');
    const planLabel = accountType === 'apiKey' ? 'API' : planNames[planType] || '未知套餐';
    const plan = el('span', 'cuc-plan', planLabel);
    plan.title = accountType === 'apiKey' ? 'API Key 账号，不对应 ChatGPT 订阅套餐' : planNames[planType] ? `官方账号套餐：${planLabel}` : '官方接口未提供可识别的套餐信息';
    accountRow.append(account, plan);
    meter.append(accountRow);
    meter.title = live !== undefined ? `当前会话累计 ${number(live)} tokens · Codex 原生统计` : error ? `读取失败：${error}` : todayEntry ? `官方每日汇总 ${number(today)} tokens` : '官方尚未返回今天的每日记录';
    surface.append(meter);
    // Prefer the weekly window. Free accounts may only receive a shorter window.
    const week = quota?.windows?.find(item => item.minutes === 10080) ||
      (planType === 'free' ? quota?.windows?.find(item => Number.isFinite(item.minutes) && item.minutes > 0 && Number.isFinite(item.remaining)) : undefined);
    const quotaLabel = week?.minutes === 10080 || planType !== 'free' ? '周剩余额度' : '剩余额度';
    const stale = Number.isFinite(week?.resetsAt) && week.resetsAt * 1000 <= Date.now();
    const remaining = Number.isFinite(week?.remaining) ? Math.max(0, Math.min(100, week.remaining)) : null;
    const quotaView = el('div', 'cuc-quota');
    const available = remaining !== null && !stale;
    const emptyLabel = stale ? '待刷新' : quota ? '未提供' : '读取中';
    quotaView.append(el('span', 'cuc-meter-label', quotaLabel), el('strong', 'cuc-quota-value', available ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(remaining)}%` : emptyLabel));
    const deadline = Number.isFinite(week?.resetsAt) ? new Intl.DateTimeFormat('zh-CN', { timeZone: data?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(week.resetsAt * 1000)) : null;
    quotaView.append(el('span', 'cuc-deadline', stale ? '等待官方刷新' : deadline ? `${deadline} 重置` : quota && !week ? '官方未返回额度' : '等待官方上报'));
    quotaView.title = `${quota?.limitId || 'Codex'} · ${quotaLabel}${week ? ` · 官方 ${week.minutes} 分钟窗口` : ''}${deadline ? ` · ${deadline} 重置` : ''}`;
    surface.append(quotaView); node.append(surface);
    const bar = el('progress', 'cuc-card-progress');
    bar.max = 100; bar.value = remaining !== null && !stale ? remaining : 0;
    bar.hidden = !available;
    bar.setAttribute('aria-label', available ? `${quotaLabel} ${remaining}%` : `${quotaLabel}${emptyLabel}`);
    node.append(bar);
    if (data?.days?.length) {
      const end = new Date(`${data.today}T00:00:00Z`);
      const start = new Date(end); start.setUTCDate(start.getUTCDate() - start.getUTCDay() - 77);
      const limit = new Date(start); limit.setUTCDate(limit.getUTCDate() + 83);
      const max = Math.max(1, ...data.days.filter(day => day.date >= iso(start) && day.date <= iso(limit)).map(day => day.total_tokens));
      const map = new Map(data.days.map(day => [day.date, day]));
      const grid = el('div', 'cuc-grid'); grid.setAttribute('aria-label', '最近12周官方每日用量');
      const cursor = new Date(start);
      for (let col = 0; col < 12; col++) {
        const column = el('div', 'cuc-week');
        for (let row = 0; row < 7; row++) {
          const key = iso(cursor), value = map.get(key)?.total_tokens || 0;
          const level = value ? Math.min(4, Math.max(1, Math.ceil(value / max * 4))) : 0;
          const cell = el('button', `cuc-cell cuc-level-${level}`);
          cell.type = 'button'; cell.dataset.date = key; cell.disabled = key > data.today;
          const entry = map.get(key);
          cell.title = entry ? `${key} · ${compact(value)} tokens（${number(value)}） · 官方每日汇总` : `${key} · 暂无官方记录（不是已确认的 0 token）`;
          cell.setAttribute('aria-label', cell.title);
          column.append(cell); cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        grid.append(column);
      }
      node.prepend(grid);
    }
    if (error || !data?.days?.length) {
      const note = el('span', 'cuc-state', error ? '每日记录暂不可用' : data ? '暂无每日记录' : '正在读取官方记录');
      note.title = error || '等待 Codex 官方每日用量汇总'; node.append(note);
    }
  }
  function mount() {
    scheduled = false;
    // Newer Codex builds also use the generic portal marker inside message progress
    // and setup rows. Only the main composer portal has this inset class.
    const portals = [...document.querySelectorAll('[data-above-composer-portal][class*="--home-composer-inline-inset"]')];
    // Ignore hidden conversations but allow the initially empty portal to have zero height.
    const portal = portals.find(item => item.getBoundingClientRect().width > 0 ||
      (!item.childNodes.length && item.parentElement?.getBoundingClientRect().width > 0));
    if (portal && node.parentNode !== portal) portal.append(node);
    const thread = portal?.getAttribute('data-above-composer-conversation-id');
    if (thread !== activeThread) { activeThread = thread; render(); }
  }
  const observer = new MutationObserver(() => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(mount); }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', mount);
  window.addEventListener('message', event => {
    if (event.data?.type === 'local-codex-account') {
      accountLabel = typeof event.data.label === 'string' ? event.data.label : '账号暂不可用';
      planType = typeof event.data.planType === 'string' ? event.data.planType.trim().toLowerCase() : undefined;
      accountType = event.data.accountType;
      if (event.data.reset) { liveUsage.clear(); data = undefined; quota = undefined; }
      render(); mount(); return;
    }
    if (event.data?.type === 'local-codex-quota') {
      quota = event.data;
      render(); mount(); return;
    }
    if (event.data?.type === 'local-codex-native-usage') {
      if (!Number.isFinite(event.data.totalTokens) || event.data.totalTokens < 0 || typeof event.data.threadId !== 'string') return;
      liveUsage.set(event.data.threadId, event.data.totalTokens);
      if (liveUsage.size > 200) liveUsage.delete(liveUsage.keys().next().value);
      render(); mount(); return;
    }
    if (event.data?.type !== tag) return;
    if (event.data.data) { data = event.data.data; error = undefined; }
    else error = String(event.data.error || '未知错误');
    render(); mount();
  });
  render(); mount();
})();
