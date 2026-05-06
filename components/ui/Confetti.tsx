'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#00d2d4', '#6a2898', '#ff8d00', '#f9bd00', '#f094bf'];

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  rotation: number;
  size: number;
}

interface ConfettiProps {
  active: boolean;
  pieces?: number;
  duration?: number;
  onComplete?: () => void;
}

/**
 * Drops a burst of brand-coloured confetti from the top of the viewport.
 * Triggered by passing `active={true}`. After `duration` ms, particles
 * are cleared and `onComplete` is called.
 */
export function Confetti({
  active,
  pieces = 80,
  duration = 3500,
  onComplete,
}: ConfettiProps) {
  const [items, setItems] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) return;
    const next: ConfettiPiece[] = Array.from({ length: pieces }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 1.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
    setItems(next);

    const t = setTimeout(() => {
      setItems([]);
      onComplete?.();
    }, duration);

    return () => clearTimeout(t);
  }, [active, pieces, duration, onComplete]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {items.map((p) => (
        <span
          key={p.id}
          className="absolute -top-4 block rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            ['--rotation' as string]: `${p.rotation}deg`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
