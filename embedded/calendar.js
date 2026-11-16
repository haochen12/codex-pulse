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
    const today = data?.days.find(day => day.date === data.today)?.total_tokens || 0;
    const meter = el('div', 'cuc-meter');
    meter.append(el('span', 'cuc-meter-label', live !== undefined ? '会话 TOKENS' : '今日 TOKENS'), el('strong', 'cuc-meter-value', live !== undefined ? compact(live) : data ? compact(today) : '—'));
    const account = el('span', 'cuc-account', accountLabel);
    account.title = accountLabel;
    meter.append(account);
    meter.title = live !== undefined ? `当前会话累计 ${number(live)} tokens · Codex 原生统计` : error ? `读取失败：${error}` : `官方每日汇总 ${number(today)} tokens`;
    surface.append(meter);
    const week = quota?.windows?.find(item => item.minutes === 10080);
    const stale = Number.isFinite(week?.resetsAt) && week.resetsAt * 1000 <= Date.now();
    const remaining = Number.isFinite(week?.remaining) ? Math.max(0, Math.min(100, week.remaining)) : null;
    const quotaView = el('div', 'cuc-quota');
    quotaView.append(el('span', 'cuc-meter-label', '周剩余额度'), el('strong', 'cuc-quota-value', remaining !== null && !stale ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(remaining)}%` : '待更新'));
    const deadline = Number.isFinite(week?.resetsAt) ? new Intl.DateTimeFormat('zh-CN', { timeZone: data?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(week.resetsAt * 1000)) : null;
    quotaView.append(el('span', 'cuc-deadline', deadline ? `${deadline} 重置` : '等待官方上报'));
    quotaView.title = `${quota?.limitId || 'Codex'} · 周剩余额度${deadline ? ` · ${deadline} 重置` : ''}`;
    surface.append(quotaView); node.append(surface);
    const bar = el('progress', 'cuc-card-progress');
    bar.max = 100; bar.value = remaining !== null && !stale ? remaining : 0;
    bar.setAttribute('aria-label', remaining !== null && !stale ? `周剩余额度 ${remaining}%` : '周剩余额度等待更新');
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
          cell.title = `${key} · ${number(value)} tokens · 官方每日汇总`;
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
