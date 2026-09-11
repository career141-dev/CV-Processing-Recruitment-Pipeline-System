'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ArrowUp } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  userAvatar?: string;
  showCheck?: boolean;
}

interface AiChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const AiChatWidget: React.FC<AiChatWidgetProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'user',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero at velit.',
      time: '10:20 AM',
      userAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      showCheck: true,
    },
    {
      id: 'm-2',
      sender: 'bot',
      text: 'Consectetur adipiscing elit. Nunc vulputate libero at velit interdum, ac dapibus odio mattis.',
      time: '10:20 AM',
    },
    {
      id: 'm-3',
      sender: 'user',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      time: '10:32 AM',
      userAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      showCheck: true,
    },
    {
      id: 'm-4',
      sender: 'bot',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc vulputate libero at velit interdum, ac dapibus odio mattis. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      time: '10:32 AM',
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim()) return;

    const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: newTime,
      userAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      showCheck: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsGenerating(true);

    // Simulate Bot Response with typing indicator
    setTimeout(() => {
      setIsGenerating(false);
      const botReply: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `Here are the matching candidate profiles from the Database CV for: "${text.trim()}". Found 4 verified candidates matching criteria.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botReply]);
    }, 1200);
  };

  return (
    <>
      {/* ── MOBILE-ONLY BACKDROP OVERLAY (FOR SMOOTH TRANSITIONS) ── */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 w-screen h-screen bg-black/50 backdrop-blur-xs z-50 md:hidden transition-all duration-300 animate-in fade-in cursor-pointer"
          aria-hidden="true"
        />
      )}

      {/* ── RESPONSIVE CHATBOT CONTAINER ── */}
      <div
        className={`fixed z-50 flex flex-col overflow-hidden backdrop-blur-md font-sans select-none transition-all duration-300 ease-out
          /* Mobile View (< 640px): Full Viewport Docked */
          inset-0 w-full h-[100dvh] max-w-full max-h-[100dvh] rounded-none
          /* Desktop View (>= 640px): Floating Bottom-Right Card */
          sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[350px] sm:h-[620px] sm:max-h-[85vh] sm:rounded-[32px] sm:border sm:border-[#C2C2C2]
          ${
            isOpen
              ? 'translate-y-0 opacity-100 pointer-events-auto sm:scale-100'
              : 'translate-y-full opacity-0 pointer-events-none sm:translate-y-6 sm:scale-95'
          }`}
        style={{
          background: '#FFFFFFEB',
          boxShadow: '0px 4px 4px 0px #00000040',
        }}
      >
        {/* ── 1. HEADER (MINIMAL WITH TOP-RIGHT CLOSE BUTTON ONLY) ── */}
        <div className="pt-3 sm:pt-4 px-4 pb-2 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#B3B3B3] hover:bg-[#999999] active:scale-90 text-white flex items-center justify-center cursor-pointer transition-all shadow-2xs"
            title="Close Chat"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* ── 2. MESSAGE THREAD BODY ── */}
        <div className="flex-1 px-4 py-2 overflow-y-auto space-y-4 scrollbar-none">
          {messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                /* ── USER MESSAGE (RIGHT-ALIGNED) ── */
                <div key={msg.id} className="flex justify-end items-start gap-2.5">
                  <div className="flex flex-col items-end max-w-[80%] sm:max-w-[260px]">
                    <div className="text-[12px] sm:text-[13px] text-slate-800 font-normal leading-relaxed text-left">
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-1">
                      <span>{msg.time}</span>
                      {msg.showCheck && (
                        <Check className="w-3 h-3 text-slate-700 stroke-[2.5]" />
                      )}
                    </div>
                  </div>

                  {/* User Avatar */}
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-slate-200/80 shadow-2xs shrink-0 mt-0.5">
                    <img
                      src={
                        msg.userAvatar ||
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
                      }
                      alt="User"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              );
            }

            /* ── BOT MESSAGE (LEFT-ALIGNED) ── */
            return (
              <div key={msg.id} className="flex justify-start items-start gap-2.5">
                {/* Bot Avatar (Circular Mint Badge with Two Green Eyes) */}
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#EAF3EE] border border-[#165B42]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#165B42]"></span>
                    <span className="w-1 h-1 rounded-full bg-[#165B42]"></span>
                  </div>
                </div>

                <div className="flex flex-col items-start max-w-[80%] sm:max-w-[260px]">
                  <div className="text-[12px] sm:text-[13px] text-[#165B42] font-normal leading-relaxed text-left">
                    {msg.text}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-1">
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── BOT GENERATING RESPONSE (TYPING INDICATOR) ── */}
          {isGenerating && (
            <div className="flex justify-start items-start gap-2.5 animate-in fade-in duration-200">
              {/* Bot Avatar */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#EAF3EE] border border-[#165B42]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#165B42] animate-bounce"></span>
                  <span
                    className="w-1 h-1 rounded-full bg-[#165B42] animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                </div>
              </div>

              <div className="flex flex-col items-start max-w-[80%] sm:max-w-[260px]">
                <div className="text-[12px] sm:text-[13px] text-[#165B42] font-normal flex items-center gap-1">
                  <span>Generating a response</span>
                  <span className="tracking-widest font-bold animate-pulse">•••</span>
                </div>
                {/* Loading Underline Bars */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-24 h-0.5 bg-slate-300 rounded-full animate-pulse"></div>
                  <div className="w-12 h-0.5 bg-slate-200 rounded-full animate-pulse"></div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── 3. BOTTOM INPUT BAR & ACTION BUTTON ── */}
        <div className="px-4 pt-2 pb-4 sm:pb-3 bg-transparent flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Pill-shaped text input */}
            <div className="flex-1 bg-white border border-[#D1D5DB] rounded-full px-4 py-2 sm:py-2.5 shadow-2xs flex items-center">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message here..."
                className="chat-borderless-input w-full bg-transparent text-[12px] sm:text-[13px] text-slate-800 placeholder:text-slate-400 border-none outline-none focus:outline-none focus:ring-0 shadow-none font-normal"
              />
            </div>

            {/* Circular dark green send button with upward arrow */}
            <button
              onClick={() => handleSend()}
              disabled={!inputVal.trim() && !isGenerating}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#165B42] hover:bg-[#114934] active:scale-95 text-white flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0 disabled:opacity-40"
              title="Send Message"
            >
              <ArrowUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Bottom Home Indicator Bar */}
          <div className="w-28 h-1 bg-[#6B7280] opacity-50 rounded-full mx-auto mt-1" />
        </div>
      </div>
    </>
  );
};
