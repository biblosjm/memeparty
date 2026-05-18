import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface Prediction {
  playerId: number;
  nickname: string;
  prediction: string;
  actualChoice: string | null;
  isCorrect: boolean;
}

export function GameFriendPredict({ roomId, playerId, players }: { roomId: number; playerId: number; players: any[] }) {
  const [targetPlayer, setTargetPlayer] = useState<any | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [userPrediction, setUserPrediction] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);

  const predictionOptions = ["A", "B", "C", "D"];
  const scenarios = [
    { title: "피자를 먹을 때 선호하는 방식은?", options: ["손으로 집어먹기", "포크와 나이프", "한 입씩 뜯어먹기", "롤처럼 말아먹기"] },
    { title: "밤새 할 일이 있을 때 선택은?", options: ["미리 준비하기", "당일에 몰아서 하기", "도움 청하기", "포기하기"] },
    { title: "카페에서 주문할 음료는?", options: ["아메리카노", "카페라떼", "아이스크림", "음료 안 마심"] },
    { title: "영화 볼 때 선호하는 시간은?", options: ["오전", "오후", "저녁", "밤"] },
  ];

  useEffect(() => {
    if (players.length > 0) {
      const otherPlayers = players.filter((p) => p.playerId !== playerId);
      if (otherPlayers.length > 0) {
        setTargetPlayer(otherPlayers[Math.floor(Math.random() * otherPlayers.length)]);
      }
    }
  }, [players, playerId]);

  const handleMakePrediction = (option: string) => {
    setUserPrediction(option);
  };

  const handleRevealAnswer = () => {
    setRevealed(true);
    // Mock: simulate target player's actual choice
    const actualChoice = predictionOptions[Math.floor(Math.random() * 4)];
    
    if (userPrediction === actualChoice) {
      setScore((prev) => prev + 100);
    }

    setPredictions([
      {
        playerId,
        nickname: "You",
        prediction: userPrediction || "?",
        actualChoice,
        isCorrect: userPrediction === actualChoice,
      },
    ]);
  };

  const scenario = scenarios[roundNumber - 1] || scenarios[0];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Score */}
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold text-accent">점수: {score}</div>
        <div className="text-sm text-muted-foreground">라운드 {roundNumber}/4</div>
      </div>

      {/* Game Content */}
      <Card className="p-6 bg-card/50 border-primary/20 flex-1 flex flex-col">
        {targetPlayer && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">예측 대상</p>
            <h2 className="text-2xl font-bold text-accent">{targetPlayer.nickname}</h2>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-bold text-foreground mb-4">{scenario.title}</h3>
          
          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {predictionOptions.map((option, index) => (
              <motion.button
                key={option}
                onClick={() => !revealed && handleMakePrediction(option)}
                disabled={revealed}
                whileHover={!revealed ? { scale: 1.05 } : {}}
                whileTap={!revealed ? { scale: 0.95 } : {}}
                className={`p-4 rounded-lg border-2 transition-all ${
                  userPrediction === option
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-bold text-foreground mb-2">{option}</div>
                <div className="text-sm text-muted-foreground">{scenario.options[index]}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Reveal Button */}
        {!revealed && userPrediction && (
          <Button onClick={handleRevealAnswer} className="w-full bg-accent hover:bg-accent/90 mb-4">
            정답 공개
          </Button>
        )}

        {/* Results */}
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {predictions.map((pred) => (
              <div
                key={pred.playerId}
                className={`p-4 rounded-lg border-2 ${
                  pred.isCorrect
                    ? "border-green-500 bg-green-500/10"
                    : "border-destructive bg-destructive/10"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-foreground">{pred.nickname}</span>
                  <span className={pred.isCorrect ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                    {pred.isCorrect ? "✅ 정답!" : "❌ 오답"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  예측: {pred.prediction} → 실제: {pred.actualChoice}
                </div>
              </div>
            ))}

            {roundNumber < 4 && (
              <Button
                onClick={() => {
                  setRoundNumber((prev) => prev + 1);
                  setUserPrediction(null);
                  setRevealed(false);
                  setPredictions([]);
                }}
                className="w-full bg-accent hover:bg-accent/90"
              >
                다음 라운드
              </Button>
            )}
          </motion.div>
        )}
      </Card>
    </div>
  );
}
