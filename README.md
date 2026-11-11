# Edge PiP

Microsoft Edge에서 재생 중인 동영상을 클릭 한 번 또는 단축키로 PiP 창에 띄우는 확장 프로그램입니다. 설계는 `Edge 동영상 PiP 프로그램 설계서.md`를 참고하세요.

## 현재 상태: 2주차 (v0.2.0)

- [x] F-01 툴바 아이콘 클릭으로 PiP 켜기/끄기
- [x] F-02 단축키 `Alt+P`로 PiP 켜기/끄기
- [x] PiP 중일 때 아이콘에 `ON` 배지, 실패하면 빨간 `!` 배지 2초 표시
- [x] F-03 주 동영상 선택 점수 (재생 중, 화면에 보이는 면적, 소리 켜짐, 길이), 모든 프레임 비교
- [x] F-04 iframe 안의 영상
- [x] Shadow DOM 안의 영상 (open, closed 모두)
- [x] F-05 `disablePictureInPicture`로 막힌 영상 강제 전환
- [ ] PiP 중 영상 요소가 교체될 때 재연결 → 보류 (아래 "알려진 제한" 참고)
- [ ] 팝업·설정 화면, 아이콘 → 3주차

## 동작 방식

1. 아이콘·단축키를 누르면 탭의 **모든 프레임**에 `content/detector.js`, `content/pip.js`를 주입합니다.
2. 각 프레임은 PiP가 켜져 있으면 끄고, 아니면 자기 프레임의 최고 점수를 돌려줍니다.
3. background가 점수가 가장 높은 프레임 하나를 골라 그 프레임에서만 PiP를 켭니다.

## 알려진 제한

- PiP 중에 사이트가 `<video>` 요소 자체를 지우고 새로 만들면 PiP가 닫힙니다. 브라우저가 사용자 클릭 없이는 PiP를 다시 열지 못하게 하므로 자동 재연결은 하지 않고, 단축키를 한 번 더 누르면 됩니다. (YouTube처럼 같은 요소에서 영상만 바꾸는 사이트는 PiP가 유지됩니다.)
- 다른 출처(도메인)의 iframe은 `activeTab` 권한만으로 접근되지 않을 수 있습니다. 실제 사이트 임베드 영상에서 확인이 필요합니다.

## 설치 (개발 모드)

1. Edge에서 `edge://extensions` 열기
2. 왼쪽 아래 **개발자 모드** 켜기
3. **압축 풀린 확장 로드** → 이 폴더(`edge_pip`) 선택
4. 툴바의 퍼즐 아이콘에서 Edge PiP를 고정하면 클릭하기 편합니다.

코드를 고친 뒤에는 `edge://extensions`에서 Edge PiP의 **다시 로드** 버튼을 누르세요.

## 테스트

`test/test.html`은 인터넷이나 영상 파일 없이 동작하는 테스트 페이지입니다.

1. `edge://extensions` → Edge PiP **세부 정보** → **파일 URL에 대한 액세스 허용** 켜기
2. `test/test.html`을 Edge로 열기
3. 페이지 위쪽 버튼으로 재생할 영상(①~⑤)을 하나 고르기
4. 아이콘을 클릭하거나 `Alt+P` → 고른 영상이 PiP로 떠야 함
5. 한 번 더 누르면 PiP가 꺼지고 `ON` 배지가 사라져야 함
6. ①~⑤ 각각 반복. 작은 영상(80px)은 어떤 경우에도 선택되면 안 됨

그다음 YouTube 같은 실제 사이트에서도 확인하세요.

## 단축키 변경

`edge://extensions/shortcuts`에서 바꿀 수 있습니다. 다른 확장 프로그램과 `Alt+P`가 겹치면 Edge가 단축키를 등록하지 않으니 이 화면에서 확인하세요.

## 폴더 구조

```
edge_pip/
├─ manifest.json
├─ background.js        # Service Worker: 클릭·단축키 처리, 배지
├─ content/
│  ├─ detector.js       # 동영상 수집(Shadow DOM 포함), 점수 계산
│  └─ pip.js            # 프레임별 스캔, PiP 진입/종료
├─ _locales/ (ko, en)
└─ test/
   ├─ test.html         # 테스트 페이지
   └─ frame.html        # 테스트용 iframe
```
