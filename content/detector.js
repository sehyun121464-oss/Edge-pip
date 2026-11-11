// 프레임 하나에서 동영상을 모두 찾아 주 동영상 후보를 고른다.
// 모든 프레임에 주입되며, 처음 주입될 때만 window.__edgePipDetector를 만든다.

(() => {
  if (window.__edgePipDetector) return;

  const MIN_WIDTH = 100;

  // 닫힌(closed) shadowRoot는 페이지 스크립트로는 못 열지만,
  // 확장 프로그램 콘텐츠 스크립트에는 chrome.dom.openOrClosedShadowRoot()가 있다.
  const shadowRootOf = (el) =>
    (chrome.dom?.openOrClosedShadowRoot ? chrome.dom.openOrClosedShadowRoot(el) : el.shadowRoot) ?? null;

  // document와 그 안의 모든 Shadow DOM에서 <video>를 수집
  const collectVideos = (root, out = []) => {
    for (const v of root.querySelectorAll('video')) out.push(v);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      const sr = shadowRootOf(el);
      if (sr) collectVideos(sr, out);
    }
    return out;
  };

  // 이 프레임의 화면(뷰포트) 안에서 실제로 보이는 면적(px²)
  const visibleArea = (video) => {
    const r = video.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return w * h;
  };

  // 설계서 6장 '주 동영상 선택 점수'.
  // 프레임끼리 점수를 비교해야 하므로 면적 비율은 프레임 뷰포트가 아닌 모니터 화면 기준으로 계산한다.
  const score = (video) => {
    const screenArea = Math.max(1, screen.width * screen.height);
    return (
      (!video.paused && !video.ended ? 100 : 0) +
      Math.min(1, visibleArea(video) / screenArea) * 50 +
      (!video.muted && video.volume > 0 ? 20 : 0) +
      (video.duration >= 10 ? 10 : 0)
    );
  };

  const isCandidate = (video) => {
    if (video.readyState === 0) return false;
    const r = video.getBoundingClientRect();
    return r.width >= MIN_WIDTH && r.height > 0;
  };

  const findBest = () => {
    let best = null;
    for (const video of collectVideos(document)) {
      if (!isCandidate(video)) continue;
      const s = score(video);
      if (!best || s > best.score) best = { video, score: s };
    }
    return best;
  };

  window.__edgePipDetector = { findBest };
})();
