import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Copy, Share2, Check } from "lucide-react";
import { toast } from "sonner";

interface InviteLinkProps {
  roomCode: string;
  roomId: number;
}

export function InviteLink({ roomCode, roomId }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  
  const inviteUrl = `${window.location.origin}?roomCode=${roomCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("초대 링크가 복사되었습니다!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("복사에 실패했습니다.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "MemeParty - 밈 파티에 초대합니다!",
          text: `친구들과 함께 웃기고 즐길 수 있는 밈 파티 게임에 초대합니다!`,
          url: inviteUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("공유에 실패했습니다.");
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <Card className="p-4 bg-accent/10 border-accent/50">
        <div className="space-y-3">
          {/* Room Code Display */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">방 코드</p>
            <div className="flex items-center gap-2">
              <Input
                value={roomCode}
                readOnly
                className="bg-background border-border text-center font-mono text-lg font-bold"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-accent hover:bg-accent/90 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Copy className="w-5 h-5 text-white" />
                )}
              </motion.button>
            </div>
          </div>

          {/* Invite URL Display */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">초대 링크</p>
            <div className="flex items-center gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="bg-background border-border text-sm truncate"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-accent hover:bg-accent/90 transition-colors flex-shrink-0"
              >
                <Copy className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </div>

          {/* Share Button */}
          <Button
            onClick={handleShare}
            className="w-full bg-accent hover:bg-accent/90 gap-2"
          >
            <Share2 className="w-4 h-4" />
            친구에게 공유
          </Button>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = `MemeParty에 초대합니다! 코드: ${roomCode}`;
                window.open(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(inviteUrl)}`,
                  "_blank"
                );
              }}
              className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
            >
              <span className="text-lg">𝕏</span>
              <p className="text-xs text-muted-foreground mt-1">트위터</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = `MemeParty에 초대합니다! ${inviteUrl}`;
                window.open(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`,
                  "_blank"
                );
              }}
              className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
            >
              <span className="text-lg">f</span>
              <p className="text-xs text-muted-foreground mt-1">페이스북</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = `MemeParty에 초대합니다! ${inviteUrl}`;
                window.open(
                  `https://www.kakao.com/`,
                  "_blank"
                );
              }}
              className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
            >
              <span className="text-lg">💬</span>
              <p className="text-xs text-muted-foreground mt-1">카카오톡</p>
            </motion.button>
          </div>
        </div>
      </Card>

      {/* Info */}
      <p className="text-xs text-muted-foreground text-center">
        친구들이 이 링크를 클릭하면 자동으로 방에 참여합니다!
      </p>
    </motion.div>
  );
}

export function InviteLinkModal({
  roomCode,
  roomId,
  onClose,
}: InviteLinkProps & { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="w-full max-w-sm"
      >
        <Card className="p-6 bg-card border-accent/50">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-foreground mb-1">친구 초대</h2>
            <p className="text-sm text-muted-foreground">이 링크를 공유하세요!</p>
          </div>

          <InviteLink roomCode={roomCode} roomId={roomId} />

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full mt-4"
          >
            닫기
          </Button>
        </Card>
      </motion.div>
    </motion.div>
  );
}
