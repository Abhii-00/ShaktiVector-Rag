#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

HAS_TMUX=0
command -v tmux >/dev/null 2>&1 && HAS_TMUX=1

_BACKEND_PID=""
_FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  if [ "$HAS_TMUX" -eq 1 ]; then
    tmux kill-session -t shaktivector-backend 2>/dev/null || true
    tmux kill-session -t shaktivector-frontend 2>/dev/null || true
  else
    [ -n "$_BACKEND_PID" ] && kill "$_BACKEND_PID" 2>/dev/null || true
    [ -n "$_FRONTEND_PID" ] && kill "$_FRONTEND_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}  ShaktiVector RAG — Startup${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"

# ── Step 1: ShaktiDB ──────────────────────────────────
echo -e "\n${YELLOW}[1/4] ShaktiDB...${NC}"
if psql -h localhost -U shaktidb -d shaktivector -c "SELECT 1" >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ Already connected${NC}"
else
  bash ~/shaktidb-start.sh 2>&1 | sed 's/^/  /'
  echo -e "${GREEN}  ✓ ShaktiDB ready${NC}"
fi

# ── Step 2: Backend ────────────────────────────────────
echo -e "\n${YELLOW}[2/4] Backend (port 8000)...${NC}"
if curl -s http://localhost:8000/ >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ Already running${NC}"
else
  if [ "$HAS_TMUX" -eq 1 ]; then
    tmux kill-session -t shaktivector-backend 2>/dev/null || true
    tmux new-session -d -s shaktivector-backend -c "$ROOT/backend"
    tmux send-keys -t shaktivector-backend "source venv/bin/activate && uvicorn app:app --host 0.0.0.0 --port 8000 --reload" Enter
  else
    cd "$ROOT/backend"
    source venv/bin/activate
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload &
    _BACKEND_PID=$!
    cd "$ROOT"
  fi
  for i in $(seq 1 15); do
    if curl -s http://localhost:8000/ >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Backend ready${NC}"; break
    fi
    [ "$i" -eq 15 ] && { echo -e "  \033[0;31m✗ Failed${NC}"; exit 1; }
    sleep 1
  done
fi

# ── Step 3: Frontend ──────────────────────────────────
echo -e "\n${YELLOW}[3/4] Frontend (port 5173)...${NC}"
if curl -s http://localhost:5173/ >/dev/null 2>&1; then
  echo -e "${GREEN}  ✓ Already running${NC}"
else
  if [ "$HAS_TMUX" -eq 1 ]; then
    tmux kill-session -t shaktivector-frontend 2>/dev/null || true
    tmux new-session -d -s shaktivector-frontend -c "$ROOT/frontend"
    tmux send-keys -t shaktivector-frontend "npm run dev" Enter
  else
    cd "$ROOT/frontend"
    npm run dev &
    _FRONTEND_PID=$!
    cd "$ROOT"
  fi
  for i in $(seq 1 15); do
    if curl -s http://localhost:5173/ >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Frontend ready${NC}"; break
    fi
    [ "$i" -eq 15 ] && { echo -e "  \033[0;31m✗ Failed${NC}"; exit 1; }
    sleep 1
  done
fi

# ── Step 4: Open browser ──────────────────────────────
echo -e "\n${YELLOW}[4/4] Opening browser...${NC}"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5173 2>/dev/null || true
elif command -v open >/dev/null 2>&1; then
  open http://localhost:5173 2>/dev/null || true
fi

echo -e "\n${CYAN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  All systems ready!${NC}"
echo -e "${CYAN}  Frontend: ${NC}http://localhost:5173"
echo -e "${CYAN}  Backend:  ${NC}http://localhost:8000"
echo -e "${CYAN}  Docs:     ${NC}http://localhost:8000/docs"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all servers${NC}"
while true; do sleep 1; done
