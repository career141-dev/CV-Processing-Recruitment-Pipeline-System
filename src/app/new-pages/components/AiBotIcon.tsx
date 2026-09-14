'use client';

import React from 'react';

// ── CUSTOM AI BOT ICON (EVERGREEN SQUIRCLE BADGE WITH EYE-ROBOT & SPEECH BUBBLE) ──
export const AiBotIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Top Eye/Head Shape */}
    <path
      d="M10 27C17 15 47 15 54 27C47 39 17 39 10 27Z"
      fill="white"
    />
    {/* Dark Visor Pill inside Head */}
    <rect
      x="20"
      y="22"
      width="24"
      height="10"
      rx="5"
      fill="#0B2B1F"
    />
    {/* Cyan Glowing Eyes */}
    <circle cx="26.5" cy="27" r="2.2" fill="#00E5FF" />
    <circle cx="37.5" cy="27" r="2.2" fill="#00E5FF" />

    {/* Bottom Speech Bubble Chin Shape */}
    <path
      d="M22 36C22 36 23 44.5 32 45.5L41.5 50.5L39 44C44 42.5 45.5 39 45.5 36C45.5 36 34 37.5 22 36Z"
      fill="white"
    />

    {/* 3 Green Dots inside Speech Bubble */}
    <circle cx="28.5" cy="41" r="1.3" fill="#165B42" />
    <circle cx="33.5" cy="41" r="1.3" fill="#165B42" />
    <circle cx="38.5" cy="41" r="1.3" fill="#165B42" />
  </svg>
);
