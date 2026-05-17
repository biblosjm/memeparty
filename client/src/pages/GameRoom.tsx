import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useGame } from "@/contexts/GameContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Users, LogOut, Loader2 } from "lucide-react";

interface ChatMessage {
  messageId: number;
  playerId: number;
  nickname: string;
  message: string;
  timestamp: Date;
}

interface GameResponse {
  id: number;
  playerId: number;
  content: string;
  voteCount: number;
}

export default function GameRoom() {
  const [, setLocation] = useLocation();
  const [match] = useRoute("/room/:roomCode");
  
  // 1. 라우트에서 roomCode 추출
  const roomCode = (match as any)?.roomCode as string | undefined;
  
  // 2. URL 쿼리에서 playerId 추출
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [isParsingParams, setIsParsingParams] = useState(true);

  const { socket, isConnected, roomId, players, gameStatus, currentRound, joinRoom, leaveRoom, submitResponse, submitVote, sendChatMessage, sendEmojiReaction } = useGame();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [userResponse, setUserResponse] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [roundStarted, setRoundStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(40);
  const [memeImage, setMemeImage] = useState<string | null>(null);

  // 3. URL 파라미터 파싱 (한 번만 실행)
  useEffect(() => {
    console.log("[GameRoom] Parsing URL parameters...");
    const params = new URLSearchParams(window.location.search);
    const playerIdStr = params.get('playerId');
    
    console.log("[GameRoom] URL search:", window.location.search);
    console.log("[GameRoom] playerId from URL:", playerIdStr);
    
    if (playerIdStr) {
      const parsedId = parseInt(playerIdStr, 10);
      if (!isNaN(parsedId)) {
        console.log("[GameRoom] Successfully parsed playerId:", parsedId);
        setPlayerId(parsedId);
      } else {
        console.error("[GameRoom] Failed to parse playerId:", playerIdStr);
      }
    }
    
    setIsParsingParams(false);
  }, []); // 빈 의존성 배열 - 마운트 시 한 번만 실행

  // 4. room 데이터 쿼리
  const getRoomQuery = trpc.game.getRoom.useQuery(
    { roomCode: roomCode || "" },
    { 
      enabled: !!roomCode && !isParsingParams, // roomCode가 있고 파라미터 파싱이 완료되었을 때만 실행
      retry: 1,
      staleTime: 0, // 항상 fresh 데이터 가져오기
    }
  );

  const generateImageMutation = trpc.game.generateMemeImage.useMutation();

  // 5. 디버깅 로그
  useEffect(() => {
    console.log("[GameRoom] State:", {
      roomCode,
      playerId,
      isParsingParams,
      isConnected,
      getRoomQueryLoading: getRoomQuery.isLoading,
      getRoomQueryData: getRoomQuery.data,
      getRoomQueryError: getRoomQuery.error,
    });
  }, [roomCode, playerId, isParsingParams, isConnected, getRoomQuery.isLoading, getRoomQuery.data, getRoomQuery.error]);

  // 6. 방 참여 (room 데이터가 로드되고 playerId가 설정된 후)
  useEffect(() => {
    if (!roomCode || !playerId || !getRoomQuery.data || !isConnected) {
      console.log("[GameRoom] Not ready to join room:", {
        roomCode: !!roomCode,
        playerId: !!playerId,
        roomData: !!getRoomQuery.data,
        isConnected,
      });
      return;
    }

    console.log("[GameRoom] Joining room with data:", {
      roomId: getRoomQuery.data.room.id,
      playerId,
    });

    const room = getRoomQuery.data.room;
    if (room) {
      joinRoom(room.id, playerId, "Player", "player");
    }
  }, [roomCode, playerId, getRoomQuery.data, isConnected, joinRoom]);

  // 7. Socket 리스너 설정
  useEffect(() => {
    if (!socket) return;

    socket.on("game_started", () => {
      setGameStarted(true);
      setRoundStarted(true);
      setTimeLeft(40);
    });

    socket.on("round_started", () => {
      setRoundStarted(true);
      setTimeLeft(40);
      setResponses([]);
      setUserResponse("");
    });

    socket.on("response_submitted", (data: GameResponse) => {
      setResponses((prev) => [...prev, data]);
    });

    socket.on("vote_submitted", (data: { responseId: number; voteCount: number }) => {
      setResponses((prev) =>
        prev.map((r) => (r.id === data.responseId ? { ...r, voteCount: data.voteCount } : r))
      );
    });

    socket.on("round_ended", (data: { results: GameResponse[] }) => {
      setRoundStarted(false);
      setResponses(data.results);
    });

    socket.on("chat_message_received", (data: ChatMessage) => {
      setChatMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("game_started");
      socket.off("round_started");
      socket.off("response_submitted");
      socket.off("vote_submitted");
      socket.off("round_ended");
      socket.off("chat_message_received");
    };
  }, [socket]);

  // 8. 타이머
  useEffect(() => {
    if (!roundStarted) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [roundStarted]);

  const handleSubmitResponse = () => {
    if (!userResponse.trim() || playerId === null || !roomId) return;

    submitResponse(roomId, playerId, userResponse);
    setUserResponse("");
  };

  const handleVote = (responseId: number) => {
    if (!roomId || playerId === null) return;

    submitVote(roomId, playerId, responseId);
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || playerId === null) return;

    sendChatMessage(chatInput);
    setChatInput("");
  };

  const handleEmojiReaction = (emoji: string) => {
    if (playerId === null) return;
    sendEmojiReaction(emoji);
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setPlayerId(null);
    setLocation("/");
  };

  // 9. 로딩 상태 체크
  console.log("[GameRoom] Render check:", {
    roomCode: !!roomCode,
    playerId: playerId !== null,
    isParsingParams,
    getRoomQueryLoading: getRoomQuery.isLoading,
  });

  // Step 1: roomCode나 playerId가 없으면 로딩
  if (!roomCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-foreground">방 코드를 찾을 수 없습니다.</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            홈으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  // Step 2: playerId 파싱 중
  if (isParsingParams) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-foreground">매개변수를 확인하는 중입니다...</p>
        </Card>
      </div>
    );
  }

  // Step 3: playerId가 파싱되지 않음
  if (playerId === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-destructive">플레이어 ID를 찾을 수 없습니다.</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            홈으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  // Step 4: room 데이터 로딩 중
  if (getRoomQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-foreground">방 정보를 불러오는 중입니다...</p>
        </Card>
      </div>
    );
  }

  // Step 5: room 데이터가 없음
  if (!getRoomQuery.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-destructive">방을 찾을 수 없습니다.</p>
          <p className="text-sm text-muted-foreground mt-2">방 코드: {roomCode}</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            홈으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  // Step 6: 모든 데이터 준비 완료 - 게임 화면 렌더링
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">MemeParty</h1>
          <p className="text-sm text-muted-foreground">방 코드: {roomCode}</p>
        </div>
        <Button variant="ghost" onClick={handleLeaveRoom} className="text-destructive hover:bg-destructive/10">
          <LogOut className="w-5 h-5 mr-2" />
          나가기
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 overflow-hidden">
        {/* Game Area */}
        <div className="md:col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Game Status */}
          <Card className="p-4 bg-card/50 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">라운드 {currentRound}</p>
                <p className="text-lg font-bold text-foreground">
                  {gameStatus === "playing" ? "게임 진행 중" : gameStatus === "voting" ? "투표 중" : "대기 중"}
                </p>
              </div>
              {roundStarted && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">남은 시간</p>
                  <p className={`text-3xl font-bold ${timeLeft <= 10 ? "text-destructive" : "text-accent"}`}>{timeLeft}s</p>
                </div>
              )}
            </div>
          </Card>

          {/* Meme Image */}
          {memeImage && (
            <Card className="p-4 bg-card/50 border-primary/20 flex-1 flex items-center justify-center overflow-hidden">
              <img src={memeImage} alt="Meme" className="max-w-full max-h-full rounded-lg" />
            </Card>
          )}

          {/* Response Input */}
          {roundStarted && gameStatus === "playing" && (
            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="flex gap-2">
                <Input
                  placeholder="웃긴 제목을 입력하세요..."
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmitResponse()}
                  className="flex-1 bg-input border-border"
                />
                <Button onClick={handleSubmitResponse} className="bg-accent hover:bg-accent/90">
                  제출
                </Button>
              </div>
            </Card>
          )}

          {/* Responses */}
          {responses.length > 0 && (
            <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-foreground mb-3">응답 ({responses.length})</p>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {responses.map((response) => (
                    <div
                      key={response.id}
                      onClick={() => handleVote(response.id)}
                      className="p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                    >
                      <p className="text-foreground">{response.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">👍 {response.voteCount}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Players */}
          <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-accent" />
              <p className="text-sm font-semibold text-foreground">플레이어 ({players.length})</p>
            </div>
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {players.map((player) => (
                  <div key={player.playerId} className="p-2 bg-secondary/50 rounded text-sm text-foreground">
                    {player.nickname}
                    {player.playerId === playerId && <span className="text-accent ml-2">(나)</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat */}
          <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-accent" />
              <p className="text-sm font-semibold text-foreground">채팅</p>
            </div>
            <ScrollArea className="flex-1 mb-3">
              <div className="space-y-2">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-accent font-semibold">{msg.nickname}</p>
                    <p className="text-foreground">{msg.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                placeholder="메시지..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendChat()}
                className="flex-1 h-8 bg-input border-border text-sm"
              />
              <Button onClick={handleSendChat} size="sm" className="bg-accent hover:bg-accent/90">
                전송
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
