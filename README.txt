영어 퀴즈 PWA v4 — 실제 사전 데이터 연결 버전

핵심
- Open English-Korean Dictionary의 공개 JSON(약 48K 항목)을 앱이 처음 실행될 때 직접 불러옵니다.
- 필요한 필드만 IndexedDB에 저장하여 이후 재사용합니다.
- 단일 영어 단어는 난이도 점수(CEFR + 빈도)를 이용해 중등/고등/대학/심화로 자동 분류합니다.
- 각 기본 단어 목록은 최대 10,000개입니다.
- 파생어는 접두사/접미사 패턴으로 실데이터에서 자동 추출합니다.
- 숙어/구동사/일상표현은 사전에 실제로 들어 있는 다단어 항목에서 자동 추출합니다.
- 실데이터가 10,000개보다 적은 분류는 숫자를 억지로 복제하지 않고 실제 개수를 표시합니다.
- 진행률과 오답노트는 기기에 저장됩니다.

업로드 방법은 이전과 동일
1. ZIP 압축 풀기
2. GitHub 저장소 > Code > Add file > Upload files
3. 압축 푼 파일 전체 업로드
4. Commit changes
5. Pages 설정은 다시 할 필요 없음
6. 앱 완전히 종료 후 다시 실행

처음 실행
- 인터넷 연결 필요
- 공개 사전 JSON을 한 번 내려받은 뒤 기기에 저장합니다.
- 이후 같은 데이터는 IndexedDB에서 불러옵니다.

라이선스/출처
- Open English-Korean Dictionary
- CC BY-SA 4.0
- https://github.com/jhseo1211/open-english-korean-dict
