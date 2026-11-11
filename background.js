// Service Worker: 아이콘 클릭·단축키를 받아 현재 탭에 PiP 토글 스크립트를 주입하고,
// 콘텐츠 스크립트의 상태 보고에 따라 아이콘 배지를 갱신한다.

const BADGE_ON = 'ON';
const BADGE_ERROR = '!';
const ERROR_BADGE_MS = 2000;

// 탭별 PiP 상태 (오류 배지를 2초 띄운 뒤 원래 배지로 되돌리기 위해 보관)
const pipActiveTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#0F6CBD' });
});

chrome.action.onClicked.addListener((tab) => togglePip(tab));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-pip') return;
  if (!tab) {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  togglePip(tab);
});

async function togglePip(tab) {
  if (!tab?.id) return;
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
    console.warn('[Edge PiP] 스크립트 주입 실패:', err?.message ?? err);
    flashError(tabId);
    return;
  }

  const frames = results.filter((r) => r?.result);

  // PiP가 켜져 있던 프레임은 1단계에서 이미 껐다.
  if (frames.some((r) => r.result.inPip)) return;

  let best = null;
  for (const r of frames) {
    if (r.result.score >= 0 && (!best || r.result.score > best.result.score)) best = r;
  }
  if (!best) {
    console.warn('[Edge PiP] NO_VIDEO: 재생 가능한 동영상을 찾지 못했습니다.');
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
    console.warn('[Edge PiP] PiP 진입 실패:', err?.message ?? err);
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
      setBadge(tabId);
      break;
    case 'PIP_ERROR':
      console.warn(`[Edge PiP] ${msg.code}: ${msg.message}`);
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
