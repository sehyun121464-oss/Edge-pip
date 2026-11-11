// detector.js 다음에 모든 프레임에 주입된다.
//
// 1단계 scan(): 이 파일의 마지막 값이 background로 돌아간다.
//   - 이 프레임에 PiP가 켜져 있으면 끄고 { inPip: true }
//   - 아니면 이 프레임의 최고 후보를 기억하고 { inPip: false, score }
// 2단계 enter(): background가 점수가 가장 높은 프레임에서만 호출한다.

(() => {
  if (!window.__edgePip) {
    const watched = new WeakSet();
    let candidate = null;

    const report = (msg) => {
      chrome.runtime.sendMessage(msg).catch(() => {});
    };
    // activation: 브라우저가 '사용자가 방금 조작했다'고 인정하는 상태인지 (PiP 허용 조건)
    const isActive = () => navigator.userActivation?.isActive ?? null;
    const reportError = (code, message) => report({ type: 'PIP_ERROR', code, message, activation: isActive() });

    // enter/leave 이벤트는 video 요소에서만 발생하고 버블링되지 않으므로 영상마다 한 번씩 등록
    const watch = (video) => {
      if (watched.has(video)) return;
      watched.add(video);
      video.addEventListener('enterpictureinpicture', () => report({ type: 'PIP_STATE', active: true }));
      video.addEventListener('leavepictureinpicture', () => report({ type: 'PIP_STATE', active: false }));
    };

    // F-05: 사이트가 막아 둔 PiP 허용
    const unblock = (video) => {
      if (video.disablePictureInPicture || video.hasAttribute('disablepictureinpicture')) {
        video.disablePictureInPicture = false;
        video.removeAttribute('disablepictureinpicture');
      }
    };

    const exit = async () => {
      try {
        await document.exitPictureInPicture();
      } catch (err) {
        reportError(err.name, err.message);
      }
    };

    const scan = () => {
      if (document.pictureInPictureElement) {
        exit();
        return { inPip: true };
      }
      candidate = null;
      const activation = isActive();
      if (!document.pictureInPictureEnabled) return { inPip: false, score: -1, activation };
      try {
        const best = window.__edgePipDetector.findBest();
        candidate = best?.video ?? null;
        let info;
        try {
          info = window.__edgePipDetector.describe();
        } catch {}
        return { inPip: false, score: best ? best.score : -1, activation, info };
      } catch (err) {
        // 한 프레임의 오류가 전체 선택을 망치지 않도록 하고, 원인은 background 로그로 보낸다.
        return { inPip: false, score: -1, activation, error: `${err?.name}: ${err?.message}` };
      }
    };

    const enter = async () => {
      const video = candidate;
      if (!video || !video.isConnected) {
        reportError('NO_VIDEO', '선택한 동영상이 페이지에서 사라졌습니다.');
        return;
      }
      unblock(video);
      watch(video);
      try {
        await video.requestPictureInPicture();
      } catch (err) {
        reportError(err.name, err.message);
      }
    };

    window.__edgePip = { scan, enter };
  }

  return window.__edgePip.scan();
})();
