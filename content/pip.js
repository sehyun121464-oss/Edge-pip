// 아이콘·단축키를 누를 때마다 페이지에 주입된다.
// 처음 주입될 때만 window.__edgePip을 만들고, 매번 toggle()을 호출한다.

(() => {
  if (!window.__edgePip) {
    const MIN_WIDTH = 100;
    const watched = new WeakSet();

    const report = (msg) => {
      chrome.runtime.sendMessage(msg).catch(() => {});
    };
    const reportError = (code, message) => report({ type: 'PIP_ERROR', code, message });

    // 화면(뷰포트) 대비 영상이 보이는 면적 비율 (0~1)
    const visibleRatio = (video) => {
      const r = video.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return vw * vh > 0 ? (w * h) / (vw * vh) : 0;
    };

    // 설계서 6장 '주 동영상 선택 점수'
    const score = (video) =>
      (!video.paused && !video.ended ? 100 : 0) +
      visibleRatio(video) * 50 +
      (!video.muted && video.volume > 0 ? 20 : 0) +
      (video.duration >= 10 ? 10 : 0);

    const pickVideo = () => {
      const candidates = [...document.querySelectorAll('video')].filter(
        (v) => v.readyState > 0 && v.getBoundingClientRect().width >= MIN_WIDTH,
      );
      let best = null;
      let bestScore = -1;
      for (const v of candidates) {
        const s = score(v);
        if (s > bestScore) {
          best = v;
          bestScore = s;
        }
      }
      return best;
    };

    // enter/leave 이벤트는 video 요소에서만 발생하고 버블링되지 않으므로 영상마다 한 번씩 등록
    const watch = (video) => {
      if (watched.has(video)) return;
      watched.add(video);
      video.addEventListener('enterpictureinpicture', () => report({ type: 'PIP_STATE', active: true }));
      video.addEventListener('leavepictureinpicture', () => report({ type: 'PIP_STATE', active: false }));
    };

    const toggle = async () => {
      if (document.pictureInPictureElement) {
        try {
          await document.exitPictureInPicture();
        } catch (err) {
          reportError(err.name, err.message);
        }
        return;
      }

      if (!document.pictureInPictureEnabled) {
        reportError('NOT_SUPPORTED', '이 페이지에서는 PiP를 사용할 수 없습니다.');
        return;
      }

      const video = pickVideo();
      if (!video) {
        reportError('NO_VIDEO', '재생 가능한 동영상을 찾지 못했습니다.');
        return;
      }

      if (video.disablePictureInPicture) {
        // 강제 전환(F-05)은 2주차에 구현
        reportError('PIP_DISABLED', '사이트가 이 동영상의 PiP를 막아 두었습니다.');
        return;
      }

      watch(video);
      try {
        // await 이전에 호출해야 사용자 제스처가 유효하다
        await video.requestPictureInPicture();
      } catch (err) {
        reportError(err.name, err.message);
      }
    };

    window.__edgePip = { toggle };
  }

  window.__edgePip.toggle();
})();
