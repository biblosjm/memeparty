import { useEffect, useState } from "react";

export function useMobileOptimized() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setScreenSize({ width, height });
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    // Initial check
    handleResize();

    // Add listener
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    screenSize,
    isLandscape: screenSize.width > screenSize.height,
    isPortrait: screenSize.height > screenSize.width,
  };
}

export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        () =>
          window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0
      );
    };

    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  return isTouch;
}

export function useGameOptimizations() {
  const { isMobile, screenSize } = useMobileOptimized();
  const isTouch = useTouchDevice();

  return {
    // Reduce animations on mobile for performance
    shouldReduceMotion: isMobile,

    // Adjust game grid based on screen size
    gameGridCols: isMobile ? 1 : screenSize.width < 1024 ? 2 : 3,

    // Adjust font sizes
    fontSize: {
      title: isMobile ? "text-xl" : "text-2xl",
      body: isMobile ? "text-sm" : "text-base",
      small: isMobile ? "text-xs" : "text-sm",
    },

    // Adjust padding
    padding: {
      container: isMobile ? "p-3" : "p-6",
      section: isMobile ? "p-2" : "p-4",
    },

    // Adjust button sizes
    buttonSize: isMobile ? "h-10" : "h-12",

    // Touch-friendly spacing (48px minimum for touch targets)
    touchSpacing: isMobile ? "gap-3" : "gap-2",

    // Optimize for mobile input
    inputHeight: isMobile ? "h-12" : "h-10",

    // Adjust modal sizes
    modalMaxWidth: isMobile ? "max-w-sm" : "max-w-md",

    // Performance flags
    enableAdvancedAnimations: !isMobile,
    enableParticleEffects: !isMobile,
    maxConcurrentAnimations: isMobile ? 3 : 10,

    // Touch vs mouse
    isTouch,
    useClickFeedback: isTouch,
  };
}
