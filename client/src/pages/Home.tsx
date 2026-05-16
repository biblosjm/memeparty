import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Gamepad2, Users, Zap } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState<"meme_title" | "internet_culture" | "friend_predict">("meme_title");
  const [isLoading, setIsLoading] = useState(false);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);

  const createRoomMutation = trpc.game.createRoom.useMutation();
  const joinRoomMutation = trpc.game.joinRoom.useMutation();

  const handleCreateRoom = async () => {
    if (!nickname.trim()) return;

    setIsLoading(true);
    try {
      const result = await createRoomMutation.mutateAsync({
        nickname,
        gameMode,
      });

      // 방 생성 후 게임 페이지로 이동
      setLocation(`/room/${result.roomCode}?playerId=${result.playerId}`);
    } catch (error) {
      console.error("Failed to create room:", error);
      alert("방 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomCode.trim()) return;

    setIsLoading(true);
    try {
      const result = await joinRoomMutation.mutateAsync({
        roomCode,
        nickname,
        role: "player",
      });

      // 방 참여 후 게임 페이지로 이동
      setLocation(`/room/${result.room.roomCode}?playerId=${result.playerId}`);
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("방 참여에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const openNicknameDialog = (action: "create" | "join") => {
    setPendingAction(action);
    setShowNicknameDialog(true);
  };

  const handleNicknameSubmit = () => {
    if (pendingAction === "create") {
      handleCreateRoom();
    } else if (pendingAction === "join") {
      handleJoinRoom();
    }
    setShowNicknameDialog(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card/50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Gamepad2 className="w-10 h-10 text-accent" />
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            MemeParty
          </h1>
          <Zap className="w-10 h-10 text-accent" />
        </div>
        <p className="text-xl text-muted-foreground font-medium">친구들과 함께 웃기고 즐기는 실시간 밈 파티</p>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-2xl bg-card/80 backdrop-blur border-primary/20 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <div className="p-8">
          <Tabs defaultValue="quick-start" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50">
              <TabsTrigger value="quick-start" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                빠른 시작
              </TabsTrigger>
              <TabsTrigger value="join" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                방 참여
              </TabsTrigger>
            </TabsList>

            {/* Quick Start Tab */}
            <TabsContent value="quick-start" className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-foreground">새 방 만들기</h2>
                <p className="text-muted-foreground mb-6">게임 모드를 선택하고 닉네임을 입력하세요.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">게임 모드 선택</label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { value: "meme_title" as const, label: "AI 밈 제목 짓기", desc: "AI 이미지에 웃긴 제목을 붙여보세요!" },
                        { value: "internet_culture" as const, label: "인터넷 문화력 테스트", desc: "밈과 드립 감성을 겨루세요!" },
                        { value: "friend_predict" as const, label: "친구 예측 게임", desc: "친구들의 선택을 맞춰보세요!" },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setGameMode(mode.value)}
                          className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                            gameMode === mode.value
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-primary/50 bg-card/50"
                          }`}
                        >
                          <div className="font-semibold text-foreground">{mode.label}</div>
                          <div className="text-sm text-muted-foreground">{mode.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => openNicknameDialog("create")}
                    disabled={isLoading}
                    className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-200"
                  >
                    {isLoading ? "방 생성 중..." : "방 만들기"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Join Tab */}
            <TabsContent value="join" className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-foreground">친구 방에 참여하기</h2>
                <p className="text-muted-foreground mb-6">친구가 보낸 초대 코드를 입력하세요.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">초대 코드</label>
                    <Input
                      placeholder="예: ABC12345"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="h-12 text-lg bg-input border-border focus:border-primary"
                    />
                  </div>

                  <Button
                    onClick={() => openNicknameDialog("join")}
                    disabled={isLoading || !roomCode.trim()}
                    className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-200"
                  >
                    {isLoading ? "참여 중..." : "방 참여하기"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        {[
          { icon: Gamepad2, title: "즉시 플레이", desc: "로그인 없이 바로 시작" },
          { icon: Users, title: "친구 초대", desc: "링크 하나로 초대 가능" },
          { icon: Zap, title: "실시간 반응", desc: "빠른 속도와 재미있는 이펙트" },
        ].map((feature, i) => (
          <Card key={i} className="p-4 bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-200">
            <feature.icon className="w-8 h-8 text-accent mb-2" />
            <h3 className="font-bold text-foreground">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.desc}</p>
          </Card>
        ))}
      </div>

      {/* Nickname Dialog */}
      <Dialog open={showNicknameDialog} onOpenChange={setShowNicknameDialog}>
        <DialogContent className="bg-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-foreground">닉네임 입력</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="게임에서 사용할 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleNicknameSubmit()}
              className="h-12 bg-input border-border focus:border-primary"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNicknameDialog(false)}
                className="flex-1 border-border hover:bg-secondary/50"
              >
                취소
              </Button>
              <Button
                onClick={handleNicknameSubmit}
                disabled={!nickname.trim() || isLoading}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                {isLoading ? "진행 중..." : "확인"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
