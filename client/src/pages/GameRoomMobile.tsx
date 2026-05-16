import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useMobileOptimized } from "@/hooks/useMobileOptimized";
import { MessageCircle, Users, LogOut } from "lucide-react";

interface GameRoomMobileProps {
  roomCode: string;
  players: any[];
  currentPlayer: any;
  onLeaveRoom: () => void;
}

export function GameRoomMobile({
  roomCode,
  players,
  currentPlayer,
  onLeaveRoom,
}: GameRoomMobileProps) {
  const [activeTab, setActiveTab] = useState("game");
  const { isMobile } = useMobileOptimized();

  if (!isMobile) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">방 코드</p>
            <p className="font-bold text-accent text-xl">{roomCode}</p>
          </div>
          <Button
            onClick={onLeaveRoom}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            나가기
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tab Triggers - Bottom Navigation */}
          <TabsList className="fixed bottom-0 left-0 right-0 w-full rounded-none border-t border-border h-16 gap-0 p-0 bg-card z-40">
            <TabsTrigger
              value="game"
              className="flex-1 rounded-none h-full gap-1 flex flex-col items-center justify-center"
            >
              <span className="text-lg">🎮</span>
              <span className="text-xs">게임</span>
            </TabsTrigger>
            <TabsTrigger
              value="players"
              className="flex-1 rounded-none h-full gap-1 flex flex-col items-center justify-center"
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">플레이어</span>
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="flex-1 rounded-none h-full gap-1 flex flex-col items-center justify-center"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs">채팅</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto">
            {/* Game Tab */}
            <TabsContent value="game" className="p-3 space-y-3">
              <Card className="p-4 bg-card/50 border-primary/20">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">AI 밈 이미지</p>
                  <div className="aspect-square bg-secondary rounded-lg flex items-center justify-center mb-4">
                    <span className="text-4xl">🖼️</span>
                  </div>
                  <p className="text-sm text-foreground mb-4">
                    이 이미지에 어울리는 제목을 지어보세요!
                  </p>
                  <input
                    type="text"
                    placeholder="제목을 입력하세요..."
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground mb-3"
                  />
                  <Button className="w-full bg-accent hover:bg-accent/90">
                    제목 제출
                  </Button>
                </div>
              </Card>

              {/* Responses */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">다른 플레이어의 제목</p>
                {[1, 2, 3].map((i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.95 }}
                    className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-foreground">재미있는 제목 {i}</p>
                      <span className="text-accent font-bold">{i}표</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </TabsContent>

            {/* Players Tab */}
            <TabsContent value="players" className="p-3 space-y-2">
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-lg bg-secondary/30 border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{player.nickname}</p>
                      <p className="text-xs text-muted-foreground">
                        Lv.{player.level}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-accent">{player.score}</p>
                      <p className="text-xs text-muted-foreground">점수</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="p-3 space-y-3">
              <div className="space-y-2 h-96 overflow-y-auto mb-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg ${
                      i % 2 === 0
                        ? "bg-accent/10 ml-auto max-w-xs"
                        : "bg-secondary/30 mr-auto max-w-xs"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      플레이어 {i}
                    </p>
                    <p className="text-sm text-foreground">
                      이건 정말 웃겨요! 😂
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="메시지..."
                  className="flex-1 p-3 rounded-lg bg-background border border-border text-foreground text-sm"
                />
                <Button className="bg-accent hover:bg-accent/90 px-4">
                  전송
                </Button>
              </div>

              {/* Emoji Reactions */}
              <div className="flex gap-2 justify-center">
                {["😂", "🔥", "👍", "💯", "🎉"].map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-2xl p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
