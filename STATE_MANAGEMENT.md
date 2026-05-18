# STATE MANAGEMENT

## 핵심 원칙

- state 최소화

- 중복 state 금지

- derived state 최소화

---

# 상태 관리 원칙

- 서버 상태를 우선 신뢰

- 프론트 임시 상태 최소화

- 불필요한 global state 금지

---

# 금지 사항

- 같은 데이터를 여러 state로 중복 저장

- props drilling 과도화

- state 변경 로직 분산

---

# 권장 사항

- 상태 역할 명확히 분리

- UI state와 game state 구분