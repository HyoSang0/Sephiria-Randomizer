# 🎲 세피리아 뽑기대 — 랜덤 빌드 생성기

[![GitHub](https://img.shields.io/badge/GitHub-Sephiria--Randomizer-blue?logo=github)](https://github.com/HyoSang0/Sephiria-Randomizer)

**세피리아 사가** 게임을 위한 랜덤 빌드 생성기입니다.  
무기, 인챈트, 코스튬, 콤보 등을 랜덤으로 뽑아 다양한 빌드 조합을 즐길 수 있습니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 🗡️ **무기 랜덤** | 다양한 무기 종류 중 하나를 랜덤으로 선택 |
| 🔮 **무기 강화 랜덤** | 무기 강화 트리(베이스 → T1 → T2)를 따라 랜덤 무기 강화 선택 |
| 👗 **코스튬 랜덤** | 캐릭터 코스튬을 랜덤으로 선택 |
| ⚔️ **콤보 랜덤** | 사용 가능한 콤보 중 랜덤 선택 |
| 🎰 **풀 빌드 랜덤** | 무기 + 인챈트 + 코스튬 + 콤보를 한 번에 뽑기 |
| 🛠️ **커스텀 빌드** | 원하는 항목만 골라서 뽑고, 3개의 후보 중 선택 |

## 🎮 사용 방법

1. 로컬 서버에서 `index.html` 열기
2. 원하는 카테고리의 **뽑기** 버튼 클릭
3. 애니메이션과 함께 랜덤 결과가 표시됩니다
4. **커스텀 빌드**에서는 원하는 항목을 선택 후 뽑기 → 3개 후보 중 택 1

## 🛠️ 기술 스택

- **HTML5** — 화면 구조와 Firebase 초기화
- **CSS3** — 레트로 픽셀 테마, 애니메이션 효과
- **Vanilla JavaScript** — 외부 라이브러리 없이 순수 JS로 구현
- **JSON** — 게임 데이터와 강화 트리를 별도 파일로 관리
- **Firebase Cloud Firestore** — 커뮤니티 빌드 게시판

## 📁 프로젝트 구조

```
Sephiria-Randomizer/
├── index.html                       # 메인 화면 및 Firebase 초기화
├── data/
│   └── sephiria.json                # 무기·코스튬·콤보·강화 데이터
├── js/
│   ├── constants.js                  # 이미지 URL 및 공통 상수
│   └── app.js                        # 랜덤 빌드, 렌더링, 이벤트, 게시판 로직
├── css/
│   └── style.css                    # 화면 스타일 및 폰트 정의
├── README.md
└── .gitignore
```

### 파일별 책임

| 파일 | 책임 |
|---|---|
| `index.html` | HTML UI, Firebase SDK/config, 외부 CSS·JS 연결 |
| `data/sephiria.json` | 런타임에서 불러오는 게임 데이터. 데이터 수정 시 JS 로직을 변경하지 않음 |
| `js/constants.js` | 이미지 서버 주소, 확장자 우선순위, WebP 우선 무기 목록 |
| `js/app.js` | JSON 로딩 후 UI 초기화, 랜덤 선택, 결과 렌더링, 이미지 fallback, 커뮤니티 게시판 |
| `css/style.css` | 레이아웃, 색상, 반응형 스타일, 애니메이션, 폰트 |

### 초기화 순서

`app.js`는 DOMContentLoaded 시점에 먼저 `data/sephiria.json`을 `fetch`합니다. 데이터 로딩이 완료되면 전역 데이터 참조를 연결하고 탭, 랜덤 버튼, 커스텀 입력, 커뮤니티 게시판을 초기화합니다. 따라서 게임 데이터에 의존하는 UI가 빈 데이터로 먼저 렌더링되지 않습니다.

### 실행 시 주의사항

`fetch()`로 JSON을 읽기 때문에 `index.html`을 파일 탐색기에서 직접 여는 것보다 로컬 HTTP 서버를 사용하는 것이 안전합니다. 예를 들어 VS Code Live Server 또는 다음 명령을 사용할 수 있습니다.

```bash
python -m http.server 8000
```

이후 브라우저에서 `http://localhost:8000/`을 엽니다.

## 🌿 Git Flow 브랜치 전략

이 프로젝트는 **Git Flow** 방식으로 브랜치를 관리합니다.  
Git Flow는 역할별로 브랜치를 나누어 안정적인 배포와 개발을 동시에 진행하는 전략입니다.

### 상시 브랜치

| 브랜치 | 역할 |
|---|---|
| `main` | **배포용** — 릴리즈된 안정 버전만 존재 |
| `develop` | **개발용** — 다음 릴리즈를 위한 최신 개발 코드 |

### 임시 브랜치 (작업 완료 후 삭제)

| 브랜치 | 역할 | 분기 → 병합 |
|---|---|---|
| `feature/*` | 새 기능 개발 | `develop` → `develop` |
| `release/*` | 릴리즈 준비 (버그 수정, 버전 태깅) | `develop` → `main` + `develop` |
| `hotfix/*` | 배포 버전 긴급 버그 수정 | `main` → `main` + `develop` |

### 작업 흐름

```
main ─────●─────────────────●──────────●───
          │                 ↑          ↑
          │              merge      merge
          │                 │          │
develop ──●──●──●──●──●──●──●──●──●────●───
              ↑     ↑  │        ↑
           merge  merge│     merge
              │     │  │        │
feature/A ────●─────┘  │        │
feature/B ──────────●──┘        │
hotfix/1 ───────────────────────●  (main에서 분기 → main+develop 병합)
```

1. **기능 추가** — `develop`에서 `feature/기능명` 분기 → 작업 → `develop`에 머지
2. **릴리즈** — `develop`에서 `release/버전` 분기 → QA/수정 → `main`과 `develop` 양쪽에 머지 + 태그
3. **긴급 수정** — `main`에서 `hotfix/버그명` 분기 → 수정 → `main`과 `develop` 양쪽에 머지

## 🔥 Firebase 데이터베이스 정보

이 프로젝트는 사용자 간 빌드 기록 및 커뮤니티 공유 기능을 위해 **Firebase Cloud Firestore**를 사용합니다.

### 1. 컬렉션 구조 (`builds`)

빌드 정보는 `builds` 컬렉션(Collection)에 개별 문서(Document)로 저장됩니다.

| 필드명 | 타입 | 설명 |
|---|---|---|
| `nickname` | `string` | 작성자 닉네임 (최대 20자) |
| `enchant_base` | `string` | 무기 베이스 (예: `표준 검과 방패`) |
| `enchant_t1` | `string` | 1차 강화 T1 (예: `솜털의 보호`) |
| `enchant_t2` | `string` | 2차 강화 T2 (예: `별의 반짝임`) |
| `costume` | `string` | 선택한 코스튬 이름 |
| `fruit_skewer` | `string` | 과일 꼬치 정보 |
| `combos` | `array(string)` | 콤보 태그 목록 |
| `artifact` | `string` | 핵심 아티팩트 정보 |
| `description` | `string` | 빌드 설명 및 공유 팁 |
| `created_at` | `timestamp` | 작성일시 (`serverTimestamp()`) |

### 2. Firestore 보안 규칙 (Security Rules)

데이터 훼손 방지 및 읽기/쓰기 권한 제어를 위해 아래의 보안 규칙이 적용되어 있습니다.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /builds/{document} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasAll(['nickname', 'description'])
                    && request.resource.data.nickname is string
                    && request.resource.data.nickname.size() <= 20;
      allow update, delete: if false;
    }
  }
}
```

## 📄 라이선스

이 프로젝트는 개인 프로젝트입니다.  
게임 관련 에셋의 저작권은 원작자에게 있습니다.
