const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
(async () => {
  const data = { today: '2026-11-14', timeZone: 'Asia/Shanghai', source: 'official', days: [{ date: '2026-11-14', total_tokens: 3300000 }], files: 1 };
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 380, height: 760 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      :root{--vscode-editor-background:#181818;--vscode-foreground:#ddd;--vscode-widget-border:#363636;--vscode-descriptionForeground:#aaa;--vscode-font-family:system-ui}*{box-sizing:border-box}body{margin:0;background:#181818;color:#ddd;font:13px system-ui}main{height:100vh;padding:16px;display:flex;flex-direction:column}h1{font-size:16px;margin:0}article{flex:1;padding-top:28px;line-height:1.8;color:#aaa}.fixture-label{font-size:10px;color:#777;margin-top:8px}#composer{border:1px solid #444;border-radius:12px;padding:16px;color:#888;min-height:90px}.portal:empty{display:none}footer{font-size:10px;color:#888;padding-top:10px}
      </style></head><body><main><h1>Codex</h1><div class="fixture-label">嵌入布局验证 · 模拟官方返回数据</div><article>使用日历将出现在聊天输入框上方。</article><div id="slot"><div class="portal" data-above-composer-portal></div></div><div id="composer" contenteditable="true" role="textbox">输入消息…</div><footer>本机补丁预览</footer></main></body></html>`);
    await page.evaluate(() => {
      document.querySelector('.portal').classList.add('px-[var(--home-composer-inline-inset)]');
      const progress = document.createElement('div');
      progress.setAttribute('data-above-composer-portal', '');
      progress.setAttribute('data-above-composer-progress-content', '');
      progress.textContent = '进度区域';
      document.querySelector('article').append(progress);
    });
    await page.addStyleTag({ path: path.join(root, 'embedded/calendar.css') });
    await page.addScriptTag({ path: path.join(root, 'embedded/calendar.js') });
    await page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-usage-calendar', data } })), data);
    await page.locator('.cuc-card').waitFor();
    await page.evaluate(() => {
      document.querySelector('#slot .portal').setAttribute('data-above-composer-conversation-id', 'live');
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-native-usage', threadId: 'live', totalTokens: 3300000 } }));
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-quota', limitId: 'codex', windows: [{ minutes: 10080, remaining: 75, resetsAt: 2000000000 }] } }));
    });
    assert.equal(await page.locator('.cuc-meter-value').innerText(), '3.3M');
    assert.equal(await page.locator('.cuc-quota-value').innerText(), '75%');
    assert.equal(await page.locator('.cuc-card-progress').evaluate(node => node.value), 75);
    assert.equal(await page.locator('.cuc-cell').count(), 84);
    assert.equal(await page.getByRole('button', { name: '展开日历', exact: true }).count(), 0);
    const geometry = await page.evaluate(() => {
      const card = document.querySelector('.cuc-card').getBoundingClientRect();
      const bar = document.querySelector('.cuc-card-progress').getBoundingClientRect();
      const input = document.querySelector('#composer').getBoundingClientRect();
      return { height: card.height, bottom: card.bottom, barBottom: bar.bottom, inputTop: input.top };
    });
    assert.ok(geometry.height >= 60 && geometry.height <= 76);
    assert.ok(Math.abs(geometry.bottom - geometry.barBottom) < 2);
    assert.ok(geometry.bottom <= geometry.inputTop);
    assert.match(await page.locator('.cuc-cell:not([disabled])').first().getAttribute('title'), /tokens/);
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-account', label: 'long.account.name@example.com' } })));
    assert.equal(await page.locator('.cuc-account').innerText(), 'long.account.name@example.com');
    assert.equal(await page.locator('.cuc-account').getAttribute('title'), 'long.account.name@example.com');
    for (const [planType, expected] of [['free', 'Free'], ['plus', 'Plus'], ['pro', 'Pro'], [null, '未知套餐'], ['new-tier', '未知套餐']]) {
      await page.evaluate(planType => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-account', label: 'long.account.name@example.com', planType, accountType: 'chatgpt' } })), planType);
      assert.equal(await page.locator('.cuc-plan').innerText(), expected);
    }
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-account', label: 'API Key 账号', accountType: 'apiKey' } })));
    assert.equal(await page.locator('.cuc-plan').innerText(), 'API');
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-account', label: 'long.account.name@example.com', planType: 'pro', accountType: 'chatgpt' } })));
    assert.ok(await page.locator('.cuc-meter').evaluate(node => Math.abs(node.querySelector('.cuc-account').getBoundingClientRect().width - node.querySelector('.cuc-meter-label').getBoundingClientRect().width) < 1), 'account width matches usage label');
    await page.screenshot({ path: path.join(root, 'embedded-preview.png') });
    for (const width of [280, 420]) {
      await page.setViewportSize({ width, height: 760 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.evaluate(() => {
      const slot = document.querySelector('#slot');
      slot.innerHTML = '<div data-above-composer-portal class="px-[var(--home-composer-inline-inset)]" data-above-composer-conversation-id="other"></div>';
    });
    await page.locator('#slot .cuc-card').waitFor();
    assert.equal(await page.locator('.cuc-card').count(), 1);
    assert.equal(await page.locator('.cuc-cell').count(), 84);
    assert.equal(await page.locator('.cuc-meter-label').first().innerText(), '今日 TOKENS');
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-usage-calendar', error: 'offline' } })));
    assert.match(await page.locator('.cuc-state').innerText(), /每日记录暂不可用/);
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'local-codex-account', label: '正在读取账号…', reset: true } })));
    assert.equal(await page.locator('.cuc-plan').innerText(), '未知套餐');
    assert.equal(await page.locator('#composer').innerText(), '输入消息…');
    assert.deepEqual(errors, []);
    console.log('PASS: fixed 72px card, historical background, native live usage, quota and reset, bottom progress, no expand control, narrow layouts, remount and error state.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
