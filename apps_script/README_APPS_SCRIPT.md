# Google Apps Script Setup Guide

본 서비스는 Google Sheets를 데이터베이스로 사용하며, 읽기는 Google Sheets의 기본 "웹에 게시(gviz)" 기능을, 쓰기(추가/별점/숨김)는 Google Apps Script를 통해 처리합니다.

## 1. Google Sheets 설정
1. Google Sheets를 새로 만듭니다. 시트 이름은 반드시 **jokes** 로 변경합니다.
2. 1행에 다음 컬럼명을 순서대로 입력합니다:
   `id`, `question`, `answer`, `createdAt`, `ratingSum`, `ratingCount`, `hidden`, `tags`, `category`, `qualityScore`, `source`
3. `tools/seed.tsv` 파일의 내용을 복사하여 시트에 붙여넣습니다 (초기 데이터 300개).
4. **파일 > 공유 > 웹에 게시**를 클릭합니다.
   - 링크 탭에서 "전체 문서", "웹페이지"를 선택한 뒤 **게시**를 누릅니다.
   - 주소창에 있는 스프레드시트 아이디(ID)를 기록해 둡니다. (예: `https://docs.google.com/spreadsheets/d/여기있는긴문자열/edit`)

## 2. Google Apps Script 배포
1. Google Sheets 상단 메뉴에서 **확장 프로그램 > Apps Script**를 클릭합니다.
2. 기본 코드를 모두 지우고 `Code.gs` 안의 코드를 복사하여 붙여넣습니다.
3. 코드 최상단의 설정값을 실제 값으로 변경합니다.
   - `SPREADSHEET_ID`: 위에서 기록해둔 스프레드시트 아이디
   - `ADMIN_PIN`: 관리자 모드에 사용할 비밀번호 (본인만 알게 설정)
4. 저장을 누릅니다 (Ctrl+S).
5. 상단 우측의 **배포 > 새 배포**를 클릭합니다.
6. 유형 선택(톱니바퀴)에서 **웹 앱(Web App)**을 선택합니다.
   - 설명: `v1` 등 임의 작성
   - 실행 주체: 나 (자신의 이메일)
   - 액세스 권한: **모든 사용자**
7. **배포**를 클릭합니다. 권한 검토 창이 뜨면 고급 > 계속하기를 눌러 허용해줍니다.
8. 생성된 **웹 앱 URL (script.google.com/macros/s/.../exec)**을 복사합니다.

## 3. 프론트엔드 연결
웹 앱 URL과 스프레드시트 ID를 `index.html` 앞부분에 있는 기본 설정값에 붙여넣어 연결을 완료합니다.
