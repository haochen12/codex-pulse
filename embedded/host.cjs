// Official Codex App Server methods only. No local rollout parsing.
const vscode = require('vscode');
const views = new Set();
const providerName = 'local-usage-calendar';
let timer, busy = false, last, quotaMessage, connection, provider, nextId = 0;
let accountMessage, accountEpoch = 0;
const requests = new Map();
function request(method) {
  if (!connection) return Promise.reject(new Error('等待 Codex 官方连接就绪'));
  return new Promise((resolve, reject) => {
    const id = String(++nextId);
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error('官方用量接口请求超时')); }, 20000);
    requests.set(id, { resolve, reject, timeout });
    try { connection.sendRequest(providerName, id, method, {}); }
    catch (error) { clearTimeout(timeout); requests.delete(id); reject(error); }
  });
}
function connect(source) {
  if (source === connection) return;
  provider?.dispose();
  for (const item of requests.values()) { clearTimeout(item.timeout); item.reject(new Error('Codex 连接已切换')); }
  requests.clear();
  connection = source;
  provider = source.registerProvider(providerName, {
    onResult(message) {
      const item = requests.get(String(message.id));
      if (!item) return;
      requests.delete(String(message.id)); clearTimeout(item.timeout);
      if (message.error) item.reject(new Error(message.error.message || '官方用量接口不可用'));
      else item.resolve(message.result);
    },
    onFatalError() { for (const item of requests.values()) { clearTimeout(item.timeout); item.reject(new Error('Codex 连接已断开')); } requests.clear(); }
  });
  if (views.size) tick();
}
async function tick() {
  if (busy || !views.size || !connection) return;
  busy = true;
  const epoch = accountEpoch;
  try {
    const [usage, limits, identity] = await Promise.allSettled([request('account/usage/read'), request('account/rateLimits/read'), request('account/read')]);
    if (epoch !== accountEpoch) return;
    const account = identity.status === 'fulfilled' ? identity.value?.account : null;
    accountMessage = { type: 'local-codex-account', label: typeof account?.email === 'string' && account.email ? account.email : account?.type === 'apiKey' ? 'API Key 账号' : identity.status === 'rejected' ? '账号暂不可用' : '未提供账号名称' };
    accountMessage.planType = typeof account?.planType === 'string' ? account.planType : null;
    accountMessage.accountType = account?.type || null;
    for (const view of views) { try { view.postMessage(accountMessage).catch(() => {}); } catch {} }
    if (limits.status === 'fulfilled') nativeUsage('account/rateLimits/updated', limits.value);
    if (usage.status === 'rejected') throw usage.reason;
    if (!Array.isArray(usage.value.dailyUsageBuckets)) throw new Error('官方接口暂未返回每日用量，未使用本地日志补算');
    const days = usage.value.dailyUsageBuckets.map(day => ({ ...day, _tokens: day.tokens ?? day.total_tokens ?? day.totalTokens })).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.startDate) && Number.isFinite(day._tokens) && day._tokens >= 0).map(day => ({ date: day.startDate, total_tokens: day._tokens })).sort((a,b) => a.date.localeCompare(b.date));
    const zone = vscode.workspace.getConfiguration('codexUsage').get('timeZone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = ['year','month','day'].map(key => parts.find(part => part.type === key).value).join('-');
    last = { type: 'local-codex-usage-calendar', data: { days, files: days.length, errors: [], timeZone: zone, today, updatedAt: new Date().toISOString(), source: 'official' } };
  } catch (error) { last = { type: 'local-codex-usage-calendar', error: error.message }; }
  finally { busy = false; if (epoch !== accountEpoch && views.size) setTimeout(tick, 0); }
  for (const view of views) { try { await view.postMessage(last); } catch {} }
}
function attach(webview, onDispose) {
  if (views.has(webview)) return;
  views.add(webview);
  const initial = setTimeout(() => {
    if (last) webview.postMessage(last).catch(() => {});
    if (quotaMessage) webview.postMessage(quotaMessage).catch(() => {});
    if (accountMessage) webview.postMessage(accountMessage).catch(() => {});
    tick();
  }, 2000);
  onDispose(() => {
    clearTimeout(initial); views.delete(webview);
    if (!views.size) { clearInterval(timer); timer = undefined; }
  });
  if (!timer) timer = setInterval(tick, 60000);
}
function nativeUsage(method, params, source) {
  if (method === 'account/updated') {
    accountEpoch++;
    accountMessage = { type: 'local-codex-account', label: '正在读取账号…', reset: true };
    for (const view of views) { try { view.postMessage(accountMessage).catch(() => {}); } catch {} }
    setTimeout(tick, 0);
  }
  if (source) connect(source);
  if (method === 'account/updated' || method === 'account/rateLimits/updated') {
    const limits = method === 'account/updated' ? null : params?.rateLimits;
    const windows = [];
    for (const key of ['primary', 'secondary']) {
      const window = limits?.[key];
      if (!Number.isFinite(window?.usedPercent)) continue;
      windows.push({ remaining: Math.max(0, Math.min(100, 100 - window.usedPercent)), minutes: window.windowDurationMins, resetsAt: window.resetsAt });
    }
    quotaMessage = { type: 'local-codex-quota', windows, limitId: limits?.limitName || limits?.limitId || 'Codex' };
    for (const view of views) { try { view.postMessage(quotaMessage).catch(() => {}); } catch {} }
    return;
  }
  if (method !== 'thread/tokenUsage/updated' || !params?.threadId) return;
  const total = params.tokenUsage?.total;
  if (!Number.isFinite(total?.totalTokens) || total.totalTokens < 0) return;
  const message = { type: 'local-codex-native-usage', threadId: params.threadId, totalTokens: total.totalTokens };
  for (const view of views) {
    try { view.postMessage(message).catch(() => {}); } catch {}
  }
}
module.exports = { attach, nativeUsage };
