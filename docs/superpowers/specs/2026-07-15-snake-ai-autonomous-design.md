# Snake AI autonomous iteration (2026-07-15)

## Goal
Improve auto-play survival/score on 20×20 + 8 static obstacles; keep no-fake-odd-spur exits.

## Approach (chosen)
1. **Effective space** remains spur-stripped (keep `1e4dd19` logic).
2. **Safe food**: not only shortest path — try BFS path + alternate first steps that still replan-safe.
3. **Long snake mode** (len ≥ 60): when food unsafe, prefer **longest head→tail path first step** (cycle-like) over aggressive food pull.
4. **Export** `analyzeRoom` for unit tests (TDD on odd-spur stripping + direction preference).
5. **Bench**: Node harness using real `ai.ts` via strip-types; target avg ≥ prior ~2000 on 20+ games.

## Non-goals
- Full Hamiltonian on obstructed grid (expensive / brittle).
- UI redesign this pass.
