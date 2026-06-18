"use client";

import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  end: number;
  duration?: number;
}

export default function AnimatedCounter({ end, duration = 1500 }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo for a nice decelerating counter
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCount(Math.floor(easeProgress * end));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    
    // Start animation
    window.requestAnimationFrame(step);
  }, [end, duration]);

  // Format with commas if it's large (e.g. 115,247)
  return <span>{count.toLocaleString()}</span>;
}
