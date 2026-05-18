import React, { createContext, useContext, useState, useCallback } from 'react';

export interface GameContextType {
  currentGameMode: string | null;
  setCurrentGameMode: (mode: string | null) => void;
  generateQuestion: (mode: string) => Promise<any>;
  submitResponse: (roundId: number, content: string) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentGameMode, setCurrentGameMode] = useState<string | null>(null);

  const generateQuestion = useCallback(async (mode: string) => {
    // 게임 모드에 따른 질문 생성 로직
    console.log(`Generating question for mode: ${mode}`);
    return {};
  }, []);

  const submitResponse = useCallback(async (roundId: number, content: string) => {
    // 응답 제출 로직
    console.log(`Submitting response for round ${roundId}: ${content}`);
  }, []);

  const value: GameContextType = {
    currentGameMode,
    setCurrentGameMode,
    generateQuestion,
    submitResponse,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within GameProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useGame = useGameContext;
