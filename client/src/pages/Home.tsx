import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Gamepad2, Users, Zap } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "join">("create");

  const createRoom = trpc.game.createRoom.useMutation();
  const joinRoom = trpc.game.joinRoom.useMutation();

  const goToRoom = (code: string, playerId: number) => {
    setLocation(`/room/${code}?playerId=${playerId}`);
  };

  const handleCreate = async () => {
    if (!nickname.trim()) return;
    setIsLoading(true);
    try {
      const result = await createRoom.mutateAsync({ nickname: nickname.trim() });
      setDialogOpen(false);
      goToRoom(result.roomCode, result.playerId);
    } catch {
      alert("방 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim() || !roomCodeInput.trim()) return;
    setIsLoading(true);
    try {
      const result = await joinRoom.mutateAsync({
        roomCode: roomCodeInput.trim().toUpperCase(),
        nickname: nickname.trim(),
      });
      setDialogOpen(false);
      goToRoom(result.room.roomCode, result.playerId);
    } catch {
      alert("방 참여에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (m: "create" | "join") => {
    setMode(m);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#f2f3f5] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Gamepad2 className="w-10 h-10 text-[#5865f2]" />
          <h1 className="text-4xl font-black">MemeParty</h1>
          <Zap className="w-10 h-10 text-[#faa61a]" />
        </div>
        <p className="text-[#b5bac1]">친구들과 실시간으로 웃긴 제목을 만드는 밈 파티 게임</p>
      </div>

      <Card className="w-full max-w-md p-8 bg-[#2b2d31] border-[#3f4147] space-y-4">
        <Button
          className="w-full h-12 text-lg bg-[#5865f2] hover:bg-[#4752c4]"
          onClick={() => openDialog("create")}
        >
          새 방 만들기
        </Button>
        <div className="space-y-2">
          <Input
            placeholder="초대 코드"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            className="bg-[#1e1f22] border-[#3f4147] h-11"
          />
          <Button
            variant="outline"
            className="w-full h-11 border-[#3f4147]"
            onClick={() => openDialog("join")}
            disabled={!roomCodeInput.trim()}
          >
            코드로 참여
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mt-8 max-w-md w-full text-sm text-[#949ba4]">
        <div className="flex flex-col items-center gap-1">
          <Users className="w-5 h-5" />
          <span>멀티플레이</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Zap className="w-5 h-5" />
          <span>실시간</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Gamepad2 className="w-5 h-5" />
          <span>3초 입장</span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#2b2d31] border-[#3f4147]">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "닉네임 입력" : "참여하기"}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="bg-[#1e1f22] border-[#3f4147]"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && (mode === "create" ? handleCreate() : handleJoin())}
          />
          <Button
            className="w-full bg-[#5865f2]"
            disabled={!nickname.trim() || isLoading}
            onClick={mode === "create" ? handleCreate : handleJoin}
          >
            {isLoading ? "처리 중..." : "시작"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
