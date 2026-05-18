# TROUBLESHOOTING

## 반복 발생 문제

- socket 이벤트 중복 등록

- cleanup 누락

- 상태 동기화 실패

- room 상태 초기화 누락

- disconnect 처리 누락

- state 중복 관리

- 게임 상태 꼬임

---

# 수정 전 반드시 확인

- 현재 게임 상태

- socket 연결 상태

- room 데이터 상태

- 기존 기능 영향 범위

---

# 중요 원칙

부분 수정 반복보다

구조적 원인을 먼저 분석한다.