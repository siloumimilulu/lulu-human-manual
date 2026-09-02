# 루루의 인간 사용설명서 — 배포 안내

## 지금 이 폴더의 구조
```
index.html          ← 벨루미(시청자)용 모바일 화면. Firebase와 실제로 연결됨.
obs/index.html       ← 방송용 화면. 아직 Firebase 연결 전(목데이터로 동작).
js/firebase.js       ← 두 페이지가 함께 쓰는 Firebase 초기화 + 헬퍼.
firestore.rules       ← Firestore 보안 규칙 초안.
storage.rules          ← Storage 보안 규칙 초안.
```

## 1. GitHub 저장소에 반영하기
로컬에 저장소를 이미 클론해두셨다면, 이 폴더의 내용을 그 폴더에 그대로
덮어쓴 다음:

```bash
cd lulu-human-manual   # 클론해둔 저장소 폴더
git add .
git commit -m "Firebase 연동: 신청 제출 + 등록 코드 조회"
git push
```

아직 로컬에 클론 안 하셨다면:

```bash
git clone https://github.com/siloumimilulu/lulu-human-manual.git
cd lulu-human-manual
# 이 outputs 폴더의 파일들을 여기로 복사한 뒤
git add .
git commit -m "Firebase 연동: 신청 제출 + 등록 코드 조회"
git push
```

## 2. GitHub Pages 켜기
저장소 Settings → Pages → Source를 "Deploy from a branch"로,
Branch는 main(또는 기본 브랜치) / root로 선택. 몇 분 안에
`https://siloumimilulu.github.io/lulu-human-manual/` 로 열립니다.

## 3. Firebase에 배포 주소 등록
그 주소가 정해지면 Firebase 콘솔 → Authentication → Settings →
인증된 도메인에 `siloumimilulu.github.io`를 추가하세요. (전체 경로가
아니라 도메인만 넣으면 됩니다.)

## 4. Firestore / Storage 규칙 적용
`firestore.rules`, `storage.rules` 안의 `LULU_EMAIL_여기에_입력`을
실제 루루 운영자 계정 이메일로 바꾼 뒤, Firebase 콘솔의
Firestore → 규칙 탭, Storage → 규칙 탭에 각각 붙여넣고 게시하세요.
(아직 운영자 계정을 안 만드셨다면 Authentication → Sign-in method →
이메일/비밀번호를 켜고 본인 계정 하나만 만들면 됩니다.)

## 지금 상태
- 신청 폼 제출(index.html) → Firestore `applications/{등록코드}` 문서로 실제 저장됨
- 기록 화면의 코드 조회 → Firestore에서 실제로 찾아서 처방전을 보여줌
- `obs/index.html`은 아직 목데이터. 루루 운영자 계정 이메일을 확정하면
  다음 단계로 선반 실시간 구독 + 도장 찍기(HUMAN 번호 발급) + 녹음 업로드를
  실제로 연결합니다.
