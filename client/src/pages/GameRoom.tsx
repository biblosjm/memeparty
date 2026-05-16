import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useGame } from "@/contexts/GameContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Users, LogOut } from "lucide-react";

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
  const roomCode = (match as any)?.roomCode as string | undefined;

  const { socket, isConnected, roomId, players, gameStatus, currentRound, joinRoom, leaveRoom, submitResponse, submitVote, sendChatMessage, sendEmojiReaction } = useGame();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [userResponse, setUserResponse] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [roundStarted, setRoundStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(40);
  const [memeImage, setMemeImage] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);

  // Get playerId from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('playerId');
    if (id) setPlayerId(parseInt(id));
  }, []);

  const getRoomQuery = trpc.game.getRoom.useQuery(
    { roomCode: roomCode || "" },
    { enabled: !!roomCode, retry: false }
  );

  const generateImageMutation = trpc.game.generateMemeImage.useMutation();

  // Initialize room join
  useEffect(() => {
    if (!roomCode || !isConnected || !getRoomQuery.data || !playerId) return;

    const room = getRoomQuery.data.room;
    if (room) {
      joinRoom(room.id, playerId, "Player", "player");
    }
  }, [roomCode, isConnected, getRoomQuery.data?.room.id, playerId, joinRoom]);

  // Setup socket listeners
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
      setChatMessages((prev) => [data, ...prev].slice(0, 50));
    });

    socket.on("emoji_reaction_received", (data: { emoji: string; nickname: string }) => {
      console.log(`${data.nickname} reacted with ${data.emoji}`);
    });

    return () => {
      socket.off("game_started");
      socket.off("round_started");
      socket.off("response_submitted");
      socket.off("vote_submitted");
      socket.off("round_ended");
      socket.off("chat_message_received");
      socket.off("emoji_reaction_received");
    };
  }, [socket]);

  // Timer countdown
  useEffect(() => {
    if (!roundStarted || timeLeft <= 0) return;

    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [roundStarted, timeLeft]);

  // Generate meme image on round start
  useEffect(() => {
    if (!roundStarted || !roomId) return;

    const generateImage = async () => {
      try {
        const result = await generateImageMutation.mutateAsync({ roundId: roomId });
        setMemeImage(result.imageUrl || null);
      } catch (error) {
        console.error("Failed to generate image:", error);
      }
    };

    generateImage();
  }, [roundStarted, roomId, generateImageMutation]);

  const handleSubmitResponse = () => {
    if (!userResponse.trim() || !roomId || playerId === null) return;

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

  if (!roomCode || getRoomQuery.isLoading || !playerId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-foreground">방을 로드 중입니다...</p>
        </Card>
      </div>
    );
  }

  if (getRoomQuery.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-destructive">방을 찾을 수 없습니다.</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            홈으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

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
                <Button onClick={handleSubmitResponse} disabled={!userResponse.trim()} className="bg-accent hover:bg-accent/90">
                  제출
                </Button>
              </div>
            </Card>
          )}

          {/* Responses */}
          {responses.length > 0 && (
            <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden">
              <h3 className="font-bold text-foreground mb-3">모든 답변</h3>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {responses.map((response) => (
                    <button
                      key={response.id}
                      onClick={() => handleVote(response.id)}
                      className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-foreground">{response.content}</p>
                        <span className="text-accent font-bold">{response.voteCount}표</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 flex flex-col gap-4 overflow-hidden">
          {/* Players */}
          <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-foreground">플레이어 ({players.length})</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {players.map((player) => (
                  <div key={player.playerId} className="p-2 rounded bg-secondary/30 text-sm text-foreground">
                    {player.nickname}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat & Reactions */}
          <Card className="p-4 bg-card/50 border-primary/20 flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-2 bg-secondary/50">
                <TabsTrigger value="chat" className="text-xs">
                  채팅
                </TabsTrigger>
                <TabsTrigger value="reactions" className="text-xs">
                  반응
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 mb-2">
                  <div className="space-y-2">
                    {chatMessages.map((msg) => (
                      <div key={msg.messageId} className="text-xs">
                        <span className="text-accent font-semibold">{msg.nickname}:</span>
                        <span className="text-foreground ml-1">{msg.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-1">
                  <Input
                    placeholder="메시지..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendChat()}
                    className="text-xs h-8 bg-input border-border"
                  />
                  <Button onClick={handleSendChat} size="sm" className="bg-accent hover:bg-accent/90">
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="reactions" className="flex-1 flex items-center justify-center">
                <div className="grid grid-cols-4 gap-2">
                  {["😂", "🔥", "👍", "💯", "🎉", "😱", "🤔", "👏"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiReaction(emoji)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
