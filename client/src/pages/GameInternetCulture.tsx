import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface Question {
  id: number;
  content: string;
  options: string[];
  correctAnswer: number;
}

export function GameInternetCulture({ roomId, playerId }: { roomId: number; playerId: number }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);

  const generateQuestionMutation = trpc.game.generateQuestion.useMutation();

  // Load question on round start
  useEffect(() => {
    const loadQuestion = async () => {
      try {
        const result = await generateQuestionMutation.mutateAsync({
          gameMode: "internet_culture",
          roundNumber,
        });
        setQuestion(result.question as any);
        setSelectedAnswer(null);
        setAnswered(false);
        setTimeLeft(30);
      } catch (error) {
        console.error("Failed to load question:", error);
      }
    };

    loadQuestion();
  }, [roundNumber, generateQuestionMutation]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || answered) return;

    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, answered]);

  const handleSelectAnswer = (index: number) => {
    if (answered) return;

    setSelectedAnswer(index);
    setAnswered(true);

    // Check if correct
    if (question && index === question.correctAnswer) {
      setScore((prev) => prev + 100);
    }
  };

  if (!question) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-foreground mb-2">문제를 로드 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Score & Timer */}
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold text-accent">점수: {score}</div>
        <div className={`text-2xl font-bold ${timeLeft <= 10 ? "text-destructive" : "text-foreground"}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Question */}
      <Card className="p-6 bg-card/50 border-primary/20 flex-1 flex flex-col">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">라운드 {roundNumber}</p>
          <h2 className="text-2xl font-bold text-foreground">{question.content}</h2>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={answered}
              whileHover={!answered ? { scale: 1.05 } : {}}
              whileTap={!answered ? { scale: 0.95 } : {}}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedAnswer === index
                  ? index === question.correctAnswer
                    ? "border-green-500 bg-green-500/10"
                    : "border-destructive bg-destructive/10"
                  : answered && index === question.correctAnswer
                  ? "border-green-500 bg-green-500/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold text-foreground">{option}</div>
            </motion.button>
          ))}
        </div>

        {/* Result */}
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 rounded-lg bg-accent/10 border border-accent"
          >
            {selectedAnswer === question.correctAnswer ? (
              <p className="text-accent font-bold">✅ 정답입니다!</p>
            ) : (
              <div>
                <p className="text-destructive font-bold mb-2">❌ 오답입니다.</p>
                <p className="text-sm text-foreground">정답: {question.options[question.correctAnswer]}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Next Button */}
        {answered && (
          <Button
            onClick={() => setRoundNumber((prev) => prev + 1)}
            className="mt-4 w-full bg-accent hover:bg-accent/90"
          >
            다음 문제
          </Button>
        )}
      </Card>
    </div>
  );
}
