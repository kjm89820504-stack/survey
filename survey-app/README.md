# 설문노트

화이트톤 반응형 설문 웹앱. React + Vite / Vercel Functions / Firebase Authentication / Firebase Realtime Database.

## 제공 기능

- 관리자 이메일 로그인, 설문 생성·복제·수정, 순서 이동, 필수 항목 설정
- 단일/복수 객관식, 주관식, 숫자, 0~10 범위의 사용자 지정 척도
- 링크·PNG QR 배포, 수집 시작/마감/재개
- 페이지별 응답, 현재 탭 임시 저장, 서버 기준 경과 시간 자동 측정
- 응답 수, 평균 시간, 문항별 빈도·비율·원점수 평균, 주관식 응답 확인
- 실제 `.xlsx` 다운로드: 원본 응답 / 문항 통계 / 척도 점수 / 해석 안내
- PWA manifest·아이콘·서비스 워커. 설치 없이 브라우저에서 이용. 홈 화면 추가는 선택 사항이며 브라우저별 지원이 다릅니다. 오프라인 제출은 지원하지 않습니다.

## 1. 실행해 보기

Node.js 22 이상 권장.

```sh
npm install
npm run dev
```

개발 서버에서 Firebase 값이 없으면 **로컬 체험 모드**입니다. 체험 데이터는 브라우저 localStorage에만 저장되고 다른 기기와 공유되지 않습니다. 실제 운영 데이터와 섞이지 않습니다. 운영 빌드에서 환경변수가 누락되면 서비스 준비 화면을 표시합니다. 공개 체험 사이트가 필요할 때만 `VITE_DEMO_MODE=true`를 사용합니다.

```sh
npm test
npm run build
```

`npm run dev`는 프런트엔드 체험용입니다. Firebase를 연결한 API까지 로컬 실행하려면 Vercel CLI의 `vercel dev`를 사용하거나 Vercel Preview에 배포하세요.

## 2. Firebase 준비

1. Firebase Console에서 프로젝트 및 웹 앱을 등록합니다.
2. Authentication → Sign-in method에서 **이메일/비밀번호**와 **익명** 로그인을 활성화합니다. 응답자는 화면에서 회원가입하지 않으며 익명 인증이 자동으로 진행됩니다.
3. Authentication → Users에서 관리자 이메일 계정을 생성하고 UID를 복사합니다. 웹앱에 회원가입 기능은 없습니다.
4. Realtime Database를 생성하고 URL을 복사합니다. **Firestore가 아닙니다.**
5. Database → Rules에 `database.rules.json` 내용을 적용합니다. 모든 브라우저 직접 읽기/쓰기를 차단하며, 서버의 Admin SDK만 접근합니다. 공개 테스트 규칙을 사용하지 마세요.
6. 프로젝트 설정 → 서비스 계정에서 Admin SDK 서비스 계정 키를 발급합니다. JSON 파일을 GitHub에 올리지 말고 아래 환경변수에 해당 필드만 입력합니다.
7. Authentication → Settings → Authorized domains에 Vercel 운영 도메인을 추가합니다.

## 3. GitHub → Vercel 배포

1. **이 survey-app 폴더의 내용만** GitHub 저장소에 올립니다. 원래 작업 폴더의 다른 연구 문서는 포함하지 않습니다. `node_modules`, `.pnpm-store`, `dist`, `.env`는 제외되어 있습니다.
2. Vercel → Add New Project에서 저장소를 가져옵니다. 저장소 루트에 이 폴더를 넣었다면 Root Directory는 `survey-app`, 이 폴더 내용만 올렸다면 루트입니다.
3. Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`.
4. Install Command를 **`npm install`**로 지정할 수 있습니다. 또는 동봉한 pnpm lockfile과 pnpm-workspace.yaml을 이용합니다.
5. Environment Variables를 입력합니다. Firebase 웹 앱 설정의 값과 서비스 계정의 값은 **동일한 프로젝트**여야 합니다.

| 환경변수 | 입력값 | 노출 범위 |
|---|---|---|
| VITE_FIREBASE_API_KEY | 웹 앱 apiKey | 브라우저 공개 설정 |
| VITE_FIREBASE_AUTH_DOMAIN | 웹 앱 authDomain | 브라우저 공개 설정 |
| VITE_FIREBASE_PROJECT_ID | 웹 앱 projectId | 브라우저 공개 설정 |
| FIREBASE_PROJECT_ID | 서비스 계정 project_id | 서버 전용 |
| FIREBASE_CLIENT_EMAIL | 서비스 계정 client_email | 서버 전용 |
| FIREBASE_PRIVATE_KEY | 서비스 계정 private_key 전체 PEM | 서버 전용 비밀 |
| FIREBASE_DATABASE_URL | Realtime Database URL | 서버 전용 |
| ADMIN_UIDS | 관리자 UID, 여러 명은 쉼표 구분 | 서버 전용 |

`FIREBASE_PRIVATE_KEY`는 BEGIN/END 줄을 포함합니다. 실제 줄바꿈 또는 리터럴 `\n` 형식을 모두 처리합니다. 따옴표로 감싸지 마세요. 서버 전용 값에 `VITE_`를 붙이지 마세요. Preview와 Production 중 사용할 환경을 선택하고, 변경한 뒤 반드시 재배포합니다.

6. Deploy 후 관리자 로그인 → 템플릿 선택 → 필요 문항/안내 수정 → 저장 → 응답 수집 시작 → 링크 또는 QR 배포.
7. 배포 도메인에서 별도의 브라우저/스마트폰으로 응답을 한 건 제출하고 관리자 결과 및 엑셀을 확인한 뒤 실제 연구에 사용하세요. 이 저장소에는 Firebase 자격증명이 없어 실제 클라우드 연동 검증은 아직 하지 않았습니다.

## 4. DB 용량 최소화

```text
surveys/{surveyId} → 제목·설명·문항·상태 (설문당 1회)
responses/{surveyId}/{firebaseUid} → { a: [응답값…], d: 소요초, t: 제출 Unix초 }
```

- 선택지 문자열이나 질문 전체를 응답마다 복사하지 않고 **선택지 인덱스(0부터)** 또는 척도 숫자를 저장합니다.
- 필드명은 `a`, `d`, `t` 세 개입니다. 별도의 로그·통계·QR·엑셀·기기 정보·IP를 DB에 저장하지 않습니다.
- 설문 시작 시 서명된 시작 토큰을 발급하므로 시작 기록용 DB 쓰기가 없습니다.
- 작성 중 답안은 sessionStorage에 저장하며 최종 제출 때만 DB에 기록합니다. 탭 종료 시 임시 답안이 없어질 수 있습니다.
- UID를 응답 키로 사용하고 트랜잭션으로 같은 익명 계정의 중복 제출을 막습니다. 같은 요청 재시도는 응답을 추가하지 않습니다.
- 분석은 200건 단위로 전체 완료 응답을 순차 읽은 후 브라우저에서 계산합니다. 상시 실시간 구독을 하지 않습니다. 현재 설문 목록은 설문 정의 전체를 읽으므로 설문 수가 매우 많아지면 목록 메타데이터 분리가 다음 최적화 지점입니다.
- 주관식은 문항당 2,000자, 설문은 최대 150문항입니다. 자유 입력이 많을수록 저장량이 늘어납니다.
- 통계·엑셀은 다운로드 시에만 생성되며 Firebase Storage도 필요하지 않습니다.

## 5. 첨부 설문 반영

`src/template.json`은 「자원봉사 현장실무 매뉴얼 효과성 평가도구_최종.hwp」에서 추출했습니다.

- 자기효능감 A~G: 34문항, 0~10점
- 관리지식 K: 10문항, O/X/모름
- 역할 명확성 R: 5문항, 1~5점
- 사후 만족도 S: 5문항 / 유용성 U: 6문항, 1~5점
- 조직지원 POS: 8문항, 1~7점
- 소진 BO: 7문항, 1~5점
- 직무열의 WE: 9문항, 0~6점
- 인구사회학적 11항목은 경력의 년/개월, 기타 입력, 겸임 비중을 분리하여 **15개 입력 문항**으로 구현했습니다. 기타·겸임 보충 입력은 선택 항목입니다.
- 사전 총 **88문항**, 사후 총 **99문항**. 원문에서 '추가 변수'로 구분한 POS/BO/WE도 두 템플릿에 포함했습니다. 연구 설계에 따라 배포 전에 삭제할 수 있습니다.
- 응답자 화면에서 역문항 `(R)`, 직무열의 하위영역 괄호는 제거했습니다. 원문의 연구자용 채점 설명은 응답 문항으로 만들지 않았습니다.
- POS2·3·5·7은 8−원점수로 역채점. 전체 8문항 응답 시만 평균.
- BO는 1→100, 2→75, 3→50, 4→25, 5→0, BO7 역채점. 4개 이상 응답 시 평균. 7문항과 BO2를 뺀 6문항 점수를 엑셀에서 구분합니다.
- WE는 9문항 모두 응답한 경우 평균. 문항별 화면 통계는 역채점 전 원점수입니다.
- K 정답표는 원문에 없으므로 정답률·지식 총점은 만들지 않았습니다.
- 사전·사후는 별도 설문으로 수집하며 **개인 매칭·유의성 검정은 현재 범위에 포함하지 않습니다.**
- 원문 문항 ID가 채점 기준입니다. 표준 척도 문구·유형·범위를 수정하면 기존 채점 기준의 타당성을 재확인해야 합니다. 일반 신규 설문은 일치하는 척도 ID가 없어 해당 점수는 공란입니다.

## 6. 운영 시 알아둘 동작

- 경과 시간에는 휴식, 백그라운드 탭 시간이 포함됩니다. 서버 시간으로 계산하며 24시간이 지나면 새로 시작해야 합니다.
- 배포한 설문 문항은 영구 잠금됩니다. 수정하려면 복제합니다. 수집 마감/재개는 가능합니다. 이미 제출된 응답의 의미를 보존하기 위한 동작입니다.
- 익명 UID 기준 중복 방지이며, 브라우저 데이터를 지우거나 다른 기기를 쓰면 새 응답이 가능합니다. 실명 1인 1회 보장은 아닙니다.
- 익명 인증 및 입력 검증은 구현되어 있지만 공개 링크에 대한 봇 차단/App Check/서버 요청 횟수 제한은 아직 포함하지 않았습니다. 대규모 공개 배포에는 Vercel 방화벽 정책 또는 별도 제한을 추가하세요.
- 응답 데이터 삭제 UI는 포함하지 않았습니다. 보관 기간 이후 엑셀 백업을 확인하고 Firebase Console에서 해당 `responses/{surveyId}`를 삭제할 수 있습니다. 이 작업은 복구할 수 없으므로 대상과 백업을 확인하세요.
- 참가자 안내문(목적, 관리 주체, 보관 기간, 문의처 등)은 연구 계획에 맞게 편집 후 배포하세요. 기본 안내에는 개인정보 입력 자제와 시간 측정 사실만 포함되어 있습니다.

## 참고

- [Firebase 서버의 ID 토큰 검증](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Realtime Database 데이터 조회](https://firebase.google.com/docs/database/admin/retrieve-data)
- [Vite 앱의 Vercel 배포](https://vercel.com/docs/frameworks/frontend/vite)
