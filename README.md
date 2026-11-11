# Edge PiP

Microsoft Edge에서 재생 중인 동영상을 클릭 한 번 또는 단축키로 PiP 창에 띄우는 확장 프로그램입니다. 설계는 `Edge 동영상 PiP 프로그램 설계서.md`를 참고하세요.

## 현재 상태: 1주차 (v0.1.0)

- [x] F-01 툴바 아이콘 클릭으로 PiP 켜기/끄기
- [x] F-02 단축키 `Alt+P`로 PiP 켜기/끄기
- [x] PiP 중일 때 아이콘에 `ON` 배지, 실패하면 빨간 `!` 배지 2초 표시
- [x] 주 동영상 선택 점수 (재생 중, 화면에 보이는 면적, 소리 켜짐, 길이)
- [ ] iframe·Shadow DOM 안의 영상, `disablePictureInPicture` 강제 전환 → 2주차
- [ ] 팝업·설정 화면, 아이콘 → 3주차

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
3. 아이콘을 클릭하거나 `Alt+P` → "MAIN VIDEO" 영상이 PiP로 떠야 함
4. 한 번 더 누르면 PiP가 꺼지고 `ON` 배지가 사라져야 함

그다음 YouTube 같은 실제 사이트에서도 확인하세요.

## 단축키 변경

`edge://extensions/shortcuts`에서 바꿀 수 있습니다. 다른 확장 프로그램과 `Alt+P`가 겹치면 Edge가 단축키를 등록하지 않으니 이 화면에서 확인하세요.

## 폴더 구조

```
edge_pip/
├─ manifest.json
├─ background.js        # Service Worker: 클릭·단축키 처리, 배지
├─ content/
│  └─ pip.js            # 주 동영상 선택, PiP 진입/종료
├─ _locales/ (ko, en)
└─ test/test.html       # 테스트 페이지
```
