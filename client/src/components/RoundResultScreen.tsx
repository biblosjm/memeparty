import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface RoundResult {
  playerId: number;
  nickname: string;
  score: number;
  rank: number;
  isMVP: boolean;
  isWinStreak: boolean;
}

export function RoundResultScreen({
  results,
  roundNumber,
  onNextRound,
}: {
  results: RoundResult[];
  roundNumber: number;
  onNextRound: () => void;
}) {
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <Card className="w-full max-w-md p-6 bg-card border-accent/50">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-accent mb-2">라운드 {roundNumber} 결과</h2>
          <p className="text-sm text-muted-foreground">점수를 확인하세요!</p>
        </div>

        {/* Results List */}
        <div className="space-y-3 mb-6">
          {sortedResults.map((result, index) => (
            <motion.div
              key={result.playerId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border-2 ${
                index === 0
                  ? "border-accent bg-accent/10"
                  : index === 1
                  ? "border-secondary bg-secondary/10"
                  : "border-border bg-secondary/5"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-accent w-8 text-center">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{result.nickname}</p>
                    {result.isMVP && (
                      <p className="text-xs text-accent font-semibold">⭐ MVP</p>
                    )}
                    {result.isWinStreak && (
                      <p className="text-xs text-orange-400 font-semibold">🔥 연승중</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent">{result.score}</p>
                  <p className="text-xs text-muted-foreground">점수</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Highlights */}
        <div className="space-y-2 mb-6">
          {sortedResults[0]?.isMVP && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="p-3 rounded-lg bg-accent/10 border border-accent text-center"
            >
              <p className="text-sm font-bold text-accent">
                ⭐ {sortedResults[0].nickname}님이 MVP를 획득했습니다!
              </p>
            </motion.div>
          )}
          {sortedResults.some((r) => r.isWinStreak) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="p-3 rounded-lg bg-orange-500/10 border border-orange-500 text-center"
            >
              <p className="text-sm font-bold text-orange-400">
                🔥 {sortedResults.find((r) => r.isWinStreak)?.nickname}님의 연승이 이어집니다!
              </p>
            </motion.div>
          )}
        </div>

        {/* Next Button */}
        <Button onClick={onNextRound} className="w-full bg-accent hover:bg-accent/90">
          다음 라운드
        </Button>
      </Card>
    </motion.div>
  );
}

export function GameEndScreen({
  finalResults,
  onRestart,
}: {
  finalResults: RoundResult[];
  onRestart: () => void;
}) {
  const winner = finalResults[0];
  const sortedResults = [...finalResults].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <Card className="w-full max-w-md p-8 bg-card border-accent/50 text-center">
        {/* Winner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-6xl mb-4"
        >
          🏆
        </motion.div>

        <h2 className="text-3xl font-bold text-accent mb-2">게임 종료!</h2>
        <p className="text-2xl font-bold text-foreground mb-6">{winner?.nickname}님이 우승했습니다!</p>

        {/* Final Rankings */}
        <div className="space-y-2 mb-8 max-h-48 overflow-y-auto">
          {sortedResults.map((result, index) => (
            <div
              key={result.playerId}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}위`}
                </span>
                <span className="font-semibold text-foreground">{result.nickname}</span>
              </div>
              <span className="text-lg font-bold text-accent">{result.score}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button onClick={onRestart} className="flex-1 bg-accent hover:bg-accent/90">
            새 게임
          </Button>
          <Button variant="outline" className="flex-1">
            홈으로
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
