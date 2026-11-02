# 임베디드 시각화 노트 (2026-2)

S32K312 임베디드 수업 1~6주차와 중간고사 힌트를 직접 눌러 보며 이해하는 페이지. 보드 허브에서 부품을 누르면 그 주차로 들어간다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 정적 사이트 생성
```

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해서 GitHub Pages에 배포한다.

## 구조

- `index.html`, `hub.js`, `hub.css`: 보드 허브
- `easy/index.html`: 5분 요약판 (파일 하나, 빌드 없이도 열림). 요약 N → 주차 페이지 N → 요약 N+1 순서로 서로 링크
- `weeks/*.html` + `weeks/*.js`, `weeks/*.css`: 주차별 페이지
- `weeks/board3d.html`, `weeks/board3d.css`, `weeks/board3d/`: 3D 보드 페이지 (three@0.128 고정). `core.js` 렌더러·카메라·라벨, `board.js` S32K312EVB-Q172 모델(NXP HWUM REV A3 사진의 배치를 본뜬 개념 모델), `modes.js` W1~W6 단계별 설명·애니메이션. 오른쪽 아래 `?m=w4&s=2` 같은 쿼리로 특정 주차·단계를 바로 열 수 있다
- `assets/js/`: 공통 위젯 (Stepper, Register, Quiz, 메모리 띠, 끌어서 바꾸는 숫자, 단어↔그림 연결, 페이지 이동)
- `assets/css/base.css`: 색 토큰과 공통 모양
- `reference/`: 노션 원문 사본. 로컬 대조용이라 저장소에는 올리지 않는다(.gitignore)
