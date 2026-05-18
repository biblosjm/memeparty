# SOCKET RULES

## 핵심 원칙

- 서버 기준 상태 관리
- 클라이언트 상태는 서버와 동기화
- 중복 socket 이벤트 등록 금지
- cleanup 누락 금지
- disconnect 상황 고려
- reconnect 안정성 고려

---

# 반드시 확인할 항목

- socket.on 중복 여부
- emit 중복 여부
- 이벤트 cleanup 여부
- room 상태 동기화 여부
- disconnect 후 상태 정리 여부

---

# 이벤트 구조

## Client → Server

JOIN_ROOM  
LEAVE_ROOM  
START_GAME  
SUBMIT_ANSWER  
SUBMIT_VOTE

---

## Server → Client

ROOM_UPDATED  
GAME_STARTED  
ROUND_STARTED  
VOTE_STARTED  
RESULT_UPDATED  
NEXT_ROUND

---

# 중요 원칙

- 상태 변경은 서버 기준
- 클라이언트 직접 상태 변경 최소화
- race condition 가능성 고려

