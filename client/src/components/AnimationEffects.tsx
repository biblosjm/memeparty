import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Confetti {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

interface ScorePopup {
  id: string;
  score: number;
  x: number;
  y: number;
}

export function EmojiConfetti({ emoji, count = 10 }: { emoji: string; count?: number }) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  useEffect(() => {
    const newConfetti = Array.from({ length: count }).map((_, i) => ({
      id: `${emoji}-${i}`,
      emoji,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setConfetti(newConfetti);

    const timer = setTimeout(() => setConfetti([]), 2000);
    return () => clearTimeout(timer);
  }, [emoji, count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {confetti.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 1, scale: 1, x: `${item.x}vw`, y: `${item.y}vh` }}
            animate={{
              opacity: 0,
              scale: 0,
              x: `${item.x + (Math.random() - 0.5) * 50}vw`,
              y: `${item.y + 50}vh`,
            }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute text-4xl"
          >
            {item.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ScorePopup({ score, x, y }: { score: number; x: number; y: number }) {
  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, x, y }}
      animate={{ opacity: 0, scale: 1.5, y: y - 100 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="fixed pointer-events-none font-bold text-2xl text-accent"
    >
      +{score}
    </motion.div>
  );
}

export function WinnerAnnouncement({ nickname }: { nickname: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
    >
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="text-6xl"
      >
        🏆
      </motion.div>
      <div className="absolute text-center">
        <h2 className="text-4xl font-bold text-accent mb-2">라운드 승자!</h2>
        <p className="text-2xl text-foreground">{nickname}</p>
      </div>
    </motion.div>
  );
}

export function VoteAnimation({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="inline-block px-3 py-1 rounded-full bg-accent/20 text-accent font-bold"
    >
      {count}표
    </motion.div>
  );
}

export function PlayerJoinAnimation({ nickname }: { nickname: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-sm text-muted-foreground"
    >
      ✨ {nickname}님이 입장했습니다!
    </motion.div>
  );
}

export function LoadingSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full"
    />
  );
}

export function PulseEffect({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}
