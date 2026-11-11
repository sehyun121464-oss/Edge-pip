// Service Worker: 아이콘 클릭·단축키를 받아 현재 탭에 PiP 토글 스크립트를 주입하고,
// 콘텐츠 스크립트의 상태 보고에 따라 아이콘 배지를 갱신한다.

const BADGE_ON = 'ON';
const BADGE_ERROR = '!';
const ERROR_BADGE_MS = 2000;

// ── 진단 로그 ────────────────────────────────────────────────
// 서비스 워커가 잠들었다 깨어나도 남도록 storage.session에 최근 기록을 보관한다.
// 서비스 워커 콘솔에서 showLog() / clearLog() 로 확인.
const LOG_MAX = 100;
const swStartedAt = Date.now();
let logChain = Promise.resolve();

function log(event, data = {}) {
  const entry = { time: new Date().toISOString().slice(11, 23), event, ...data };
  console.log('[Edge PiP]', event, data);
  // 기록은 PiP 동작을 지연시키지 않도록 기다리지 않는다.
  logChain = logChain.then(async () => {
    try {
      const { pipLog = [] } = await chrome.storage.session.get('pipLog');
      pipLog.push(entry);
      await chrome.storage.session.set({ pipLog: pipLog.slice(-LOG_MAX) });
    } catch {}
  });
}

globalThis.showLog = async () => {
  const { pipLog = [] } = await chrome.storage.session.get('pipLog');
  console.table(pipLog);
  return pipLog;
};
globalThis.clearLog = () => chrome.storage.session.remove('pipLog');

log('sw-start');

// 마지막 트리거 시각 (PiP 진입까지 걸린 시간 계산용)
let lastTrigger = { tabId: null, at: 0 };
const sinceTrigger = () => Date.now() - lastTrigger.at;

// ── 이벤트 ──────────────────────────────────────────────────

// 탭별 PiP 상태 (오류 배지를 2초 띄운 뒤 원래 배지로 되돌리기 위해 보관)
const pipActiveTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#0F6CBD' });
});

chrome.action.onClicked.addListener((tab) => togglePip(tab, 'click'));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-pip') return;
  if (!tab) {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  }
  togglePip(tab, 'shortcut');
});

async function togglePip(tab, source) {
  lastTrigger = { tabId: tab?.id ?? null, at: Date.now() };
  log('trigger', { source, tabId: tab?.id, swAgeMs: Date.now() - swStartedAt });
  if (!tab?.id) {
    log('no-tab');
    return;
  }
  const tabId = tab.id;

  // 1단계: 모든 프레임(iframe 포함)에 탐지 스크립트를 주입하고 각 프레임의 최고 점수를 받는다.
  // 사용자 제스처(클릭·단축키) 직후에 주입해야 프레임에 PiP 허용 상태가 생긴다.
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content/detector.js', 'content/pip.js'],
    });
  } catch (err) {
    // edge:// 페이지, Add-ons 스토어 등 주입이 막힌 페이지
    log('inject-failed', { message: err?.message ?? String(err) });
    flashError(tabId);
    return;
  }

  const frames = results.filter((r) => r?.result);
  const scanLog = {
    ms: sinceTrigger(),
    frames: results.length,
    scores: frames
      .filter((r) => r.result.inPip || r.result.score >= 0)
      .map((r) => `${r.frameId}:${r.result.inPip ? 'PiP' : Math.round(r.result.score)}${r.result.activation ? '' : '(비활성)'}`)
      .join(' '),
  };
  // 결과 없이 끝난 프레임(스크립트 예외)과 프레임 안에서 잡힌 오류도 남긴다.
  const failed = results.filter((r) => !r?.result).map((r) => r?.frameId);
  if (failed.length) scanLog.noResult = failed.join(' ');
  const errors = frames.filter((r) => r.result.error).map((r) => `${r.frameId}: ${r.result.error}`);
  if (errors.length) scanLog.errors = errors.join(' | ');
  log('scan', scanLog);

  // 진단: 프레임마다 본 영상·iframe 목록 (영상이나 iframe이 하나라도 있는 프레임만)
  for (const r of frames) {
    const info = r.result.info;
    if (!info || (!info.videos.length && !info.iframes.length)) continue;
    log('frame', {
      frameId: r.frameId,
      host: info.host,
      videos: info.videos.join(' / ') || '-',
      iframes: info.iframes.join(' / ') || '-',
    });
  }

  // PiP가 켜져 있던 프레임은 1단계에서 이미 껐다.
  if (frames.some((r) => r.result.inPip)) return;

  let best = null;
  for (const r of frames) {
    if (r.result.score >= 0 && (!best || r.result.score > best.result.score)) best = r;
  }
  if (!best) {
    log('no-video');
    flashError(tabId);
    return;
  }

  // 2단계: 점수가 가장 높은 프레임에서만 PiP 진입
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [best.frameId] },
      func: () => window.__edgePip.enter(),
    });
  } catch (err) {
    log('enter-inject-failed', { message: err?.message ?? String(err) });
    flashError(tabId);
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  const tabId = sender.tab?.id;
  if (tabId == null) return;

  switch (msg?.type) {
    case 'PIP_STATE':
      if (msg.active) pipActiveTabs.add(tabId);
      else pipActiveTabs.delete(tabId);
      log(msg.active ? 'pip-on' : 'pip-off', { tabId, frameId: sender.frameId, ms: sinceTrigger() });
      setBadge(tabId);
      break;
    case 'PIP_ERROR':
      log('error', {
        tabId,
        frameId: sender.frameId,
        code: msg.code,
        message: msg.message,
        activation: msg.activation,
        ms: sinceTrigger(),
      });
      flashError(tabId);
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => pipActiveTabs.delete(tabId));

function setBadge(tabId) {
  const text = pipActiveTabs.has(tabId) ? BADGE_ON : '';
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#0F6CBD' }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
}

function flashError(tabId) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#C42B1C' }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: BADGE_ERROR }).catch(() => {});
  setTimeout(() => setBadge(tabId), ERROR_BADGE_MS);
}
