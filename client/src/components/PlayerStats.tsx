import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface PlayerStatsProps {
  nickname: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  title: string;
  winStreak: number;
  mvpCount: number;
}

const titles = [
  { level: 1, name: "밈 초보자", icon: "🌱" },
  { level: 5, name: "밈 애호가", icon: "😄" },
  { level: 10, name: "밈 마스터", icon: "🎯" },
  { level: 15, name: "밈 전설", icon: "👑" },
  { level: 20, name: "밈 신", icon: "⚡" },
];

export function PlayerStats({
  nickname,
  level,
  exp,
  expToNextLevel,
  title,
  winStreak,
  mvpCount,
}: PlayerStatsProps) {
  const expPercentage = (exp / expToNextLevel) * 100;
  const currentTitle = titles.find((t) => t.level <= level)?.name || "밈 초보자";
  const currentTitleIcon = titles.find((t) => t.level <= level)?.icon || "🌱";

  return (
    <Card className="p-4 bg-card/50 border-primary/20">
      <div className="space-y-4">
        {/* Player Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">{nickname}</h3>
            <p className="text-sm text-muted-foreground">
              {currentTitleIcon} {currentTitle}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-accent">Lv.{level}</div>
          </div>
        </div>

        {/* EXP Progress */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-xs text-muted-foreground">경험치</span>
            <span className="text-xs text-muted-foreground">
              {exp} / {expToNextLevel}
            </span>
          </div>
          <Progress value={expPercentage} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-center"
          >
            <div className="text-sm text-muted-foreground">연승</div>
            <div className="text-xl font-bold text-accent">{winStreak}</div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-center"
          >
            <div className="text-sm text-muted-foreground">MVP</div>
            <div className="text-xl font-bold text-accent">{mvpCount}</div>
          </motion.div>
        </div>
      </div>
    </Card>
  );
}

export function PlayerStatsCompact({
  nickname,
  level,
  winStreak,
}: {
  nickname: string;
  level: number;
  winStreak: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{nickname}</p>
        <p className="text-xs text-muted-foreground">Lv.{level}</p>
      </div>
      {winStreak > 0 && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-sm font-bold text-accent"
        >
          🔥 {winStreak}
        </motion.div>
      )}
    </div>
  );
}

export function LevelUpNotification({ newLevel }: { newLevel: number }) {
  const newTitle = titles.find((t) => t.level === newLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed top-4 right-4 p-4 rounded-lg bg-gradient-to-r from-accent to-accent/50 border border-accent text-white shadow-lg"
    >
      <div className="font-bold mb-1">🎉 레벨 업!</div>
      <div className="text-sm">
        Lv.{newLevel} {newTitle?.icon} {newTitle?.name}
      </div>
    </motion.div>
  );
}
