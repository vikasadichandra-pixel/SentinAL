import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useGlobeRotation — Controls smooth rotation pause/resume on threat hover.
 *
 * Behavior:
 *  1. On threat hover → smoothly decelerate rotation from current speed → 0 over ~400ms
 *  2. Hold at 0 for entire hover duration
 *  3. On threat unhover → wait 4.5 seconds, then smoothly accelerate from 0 → base speed over ~600ms
 *  4. If re-hovered during cooldown, cancel resume and hold at 0
 *
 * @param {number} baseSpeed - Normal rotation speed (default 0.5)
 * @param {number} resumeDelay - Delay in ms before resuming after unhover (default 4500)
 * @returns {{ autoRotateSpeed: number, handleThreatHover: Function, handleThreatUnhover: Function, isThreatHovered: boolean }}
 */
export default function useGlobeRotation(baseSpeed = 0.5, resumeDelay = 4500) {
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(baseSpeed);
  const [isThreatHovered, setIsThreatHovered] = useState(false);

  // Refs for timer/animation management
  const resumeTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentSpeedRef = useRef(baseSpeed);
  const targetSpeedRef = useRef(baseSpeed);
  const isHoveredRef = useRef(false);

  // Smooth lerp animation loop
  const startLerp = useCallback((target, duration = 400) => {
    targetSpeedRef.current = target;
    const startSpeed = currentSpeedRef.current;
    const startTime = performance.now();

    // Cancel any existing lerp
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const newSpeed = startSpeed + (target - startSpeed) * eased;
      currentSpeedRef.current = newSpeed;
      setAutoRotateSpeed(newSpeed);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handleThreatHover = useCallback(() => {
    isHoveredRef.current = true;
    setIsThreatHovered(true);

    // Cancel any pending resume timer
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    // Smoothly decelerate to 0
    startLerp(0, 400);
  }, [startLerp]);

  const handleThreatUnhover = useCallback(() => {
    isHoveredRef.current = false;
    setIsThreatHovered(false);

    // Cancel any existing resume timer
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }

    // Start the resume delay (4.5 seconds)
    resumeTimerRef.current = setTimeout(() => {
      // Only resume if still not hovered
      if (!isHoveredRef.current) {
        startLerp(baseSpeed, 600);
      }
      resumeTimerRef.current = null;
    }, resumeDelay);
  }, [baseSpeed, resumeDelay, startLerp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    autoRotateSpeed,
    handleThreatHover,
    handleThreatUnhover,
    isThreatHovered,
  };
}
