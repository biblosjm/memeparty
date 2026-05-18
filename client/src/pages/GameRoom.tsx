import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useGameRoom } from "@/game/useGameRoom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, LogOut, Loader2, Play, Wifi, WifiOff } from "lucide-react";

export default function GameRoom() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/room/:roomCode");
  const roomCode = params?.roomCode ?? "";

  const [urlPlayerId, setUrlPlayerId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("playerId");
    if (id) setUrlPlayerId(parseInt(id, 10));
  }, []);

  const roomQuery = trpc.game.getRoom.useQuery(
    { roomCode },
    { enabled: !!roomCode },
  );

  const dbPlayer = roomQuery.data?.players.find((p) => p.id === urlPlayerId);

  const session = useMemo(() => {
    if (!roomQuery.data || !urlPlayerId || !roomCode) return null;
    return {
      roomId: roomQuery.data.room.id,
      roomCode,
      playerId: urlPlayerId,
      nickname: dbPlayer?.nickname ?? "Player",
    };
  }, [roomQuery.data, urlPlayerId, roomCode, dbPlayer?.nickname]);

  const { roomState, isConnected, joinError, isHost, startGame, submitAnswer, submitVote } =
    useGameRoom(session);

  const handleLeave = () => setLocation("/");

  if (!roomCode || !urlPlayerId) {
    return (
      <Centered message="잘못된 접속입니다." action={<Button onClick={handleLeave}>홈으로</Button>} />
    );
  }

  if (roomQuery.isLoading) {
    return <Centered message="방 정보 불러오는 중..." icon={<Loader2 className="animate-spin" />} />;
  }

  if (roomQuery.error || !roomQuery.data) {
    return (
      <Centered message="방을 찾을 수 없습니다." action={<Button onClick={handleLeave}>홈으로</Button>} />
    );
  }

  const phase = roomState?.phase ?? "WAITING";
  const me = roomState?.players.find((p) => p.id === urlPlayerId);
  const timer = roomState?.timerSeconds;

  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#f2f3f5] flex flex-col">
      <header className="border-b border-[#2b2d31] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">MemeParty</h1>
          <p className="text-xs text-[#b5bac1]">
            방 {roomCode} · {phase}
            {timer != null && ` · ${timer}s`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs flex items-center gap-1 text-[#b5bac1]">
            {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            {isConnected ? "연결됨" : "연결 중..."}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLeave} className="text-red-400">
            <LogOut className="w-4 h-4 mr-1" /> 나가기
          </Button>
        </div>
      </header>

      {joinError && (
        <div className="bg-red-900/40 text-red-200 text-sm px-4 py-2 text-center">{joinError}</div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 max-w-6xl mx-auto w-full">
        <section className="lg:col-span-3 space-y-4">
          {/* WAITING */}
          {phase === "WAITING" && (
            <Card className="p-6 bg-[#2b2d31] border-[#3f4147] text-center space-y-4">
              <p className="text-[#b5bac1]">플레이어가 모이면 방장이 게임을 시작합니다.</p>
              {isHost ? (
                <Button onClick={startGame} className="bg-[#5865f2] hover:bg-[#4752c4]">
                  <Play className="w-4 h-4 mr-2" /> 게임 시작
                </Button>
              ) : (
                <p className="text-sm text-[#949ba4]">방장 시작 대기 중...</p>
              )}
            </Card>
          )}

          {/* Image (PLAYING / SUBMITTING / VOTING / RESULT) */}
          {roomState?.imageUrl && phase !== "WAITING" && (
            <Card className="p-2 bg-[#2b2d31] border-[#3f4147] overflow-hidden">
              <img src={roomState.imageUrl} alt="meme" className="w-full max-h-80 object-cover rounded" />
            </Card>
          )}

          {/* SUBMITTING */}
          {phase === "SUBMITTING" && (
            <Card className="p-4 bg-[#2b2d31] border-[#3f4147] space-y-3">
              <p className="font-semibold">웃긴 제목을 입력하세요!</p>
              {me?.hasSubmitted ? (
                <p className="text-[#949ba4] text-sm">제출 완료! 다른 플레이어를 기다리는 중...</p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="제목 입력..."
                    className="bg-[#1e1f22] border-[#3f4147]"
                    onKeyDown={(e) => e.key === "Enter" && answer.trim() && (submitAnswer(answer.trim()), setAnswer(""))}
                  />
                  <Button
                    onClick={() => {
                      if (answer.trim()) {
                        submitAnswer(answer.trim());
                        setAnswer("");
                      }
                    }}
                    className="bg-[#5865f2]"
                  >
                    제출
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* VOTING */}
          {phase === "VOTING" && (
            <Card className="p-4 bg-[#2b2d31] border-[#3f4147] space-y-3">
              <p className="font-semibold">가장 웃긴 답변에 투표하세요</p>
              {me?.hasVoted ? (
                <p className="text-[#949ba4] text-sm">투표 완료!</p>
              ) : (
                <div className="space-y-2">
                  {roomState?.submissions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => submitVote(s.id)}
                      className="w-full text-left p-3 rounded bg-[#1e1f22] hover:bg-[#383a40] border border-[#3f4147] transition-colors"
                    >
                      {s.content}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* RESULT */}
          {(phase === "RESULT" || phase === "NEXT_ROUND") && (
            <Card className="p-6 bg-[#2b2d31] border-[#3f4147] text-center space-y-3">
              <p className="text-2xl font-bold">🏆 {roomState?.winnerNickname ?? "—"}</p>
              <p className="text-[#b5bac1] text-sm">라운드 {roomState?.roundNumber} 결과</p>
              <div className="space-y-2 text-left">
                {roomState?.submissions
                  .slice()
                  .sort((a, b) => b.voteCount - a.voteCount)
                  .map((s) => (
                    <div key={s.id} className="p-2 rounded bg-[#1e1f22] text-sm flex justify-between">
                      <span>
                        {s.authorNickname}: {s.content}
                      </span>
                      <span className="text-[#949ba4]">👍 {s.voteCount}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </section>

        {/* Players sidebar */}
        <aside>
          <Card className="p-4 bg-[#2b2d31] border-[#3f4147]">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#5865f2]" />
              <span className="font-semibold text-sm">
                플레이어 ({roomState?.players.length ?? roomQuery.data.players.length})
              </span>
            </div>
            <ScrollArea className="max-h-96">
              <ul className="space-y-2">
                {(roomState?.players ?? roomQuery.data.players.map((p) => ({
                  id: p.id,
                  nickname: p.nickname,
                  score: p.score,
                  hasSubmitted: false,
                  hasVoted: false,
                  isConnected: false,
                }))).map((p) => (
                  <li
                    key={p.id}
                    className="text-sm p-2 rounded bg-[#1e1f22] flex justify-between items-center"
                  >
                    <span>
                      {p.nickname}
                      {p.id === urlPlayerId && <span className="text-[#5865f2] ml-1">(나)</span>}
                      {p.id === roomState?.hostPlayerId && <span className="text-[#faa61a] ml-1">👑</span>}
                    </span>
                    <span className="text-[#949ba4]">{p.score}점</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function Centered({ message, icon, action }: { message: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center">
      <Card className="p-8 bg-[#2b2d31] border-[#3f4147] text-center space-y-4">
        {icon}
        <p className="text-[#f2f3f5]">{message}</p>
        {action}
      </Card>
    </div>
  );
}
