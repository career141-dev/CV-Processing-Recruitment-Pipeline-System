'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MinusCircle,
  Send,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { AiBotIcon } from './AiBotIcon';

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
  title = 'Main Title',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'bot',
      text: 'Rapidly build stunning Web Apps with Frest 🚀\nDeveloper friendly, Highly customizable & Carefully crafted HTML Admin Dashboard Template.',
      time: '7:20',
    },
    {
      id: 'm-2',
      sender: 'user',
      text: 'Minimum text check, Hide check icon',
      time: '7:20',
      userAvatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      showCheck: true,
    },
    {
      id: 'm-3',
      sender: 'bot',
      text: 'Rapidly build stunning Web Apps with Frest 🚀\nDeveloper friendly, Highly customizable & Carefully crafted HTML Admin Dashboard Template.',
      time: '7:20',
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, 'up' | 'down'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      showCheck: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');

    // Simulate Bot Response
    setTimeout(() => {
      const botReply: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `Here are the matching candidate profiles from the Database CV for: "${text.trim()}".\n\nFound 4 verified candidates matching skills & availability criteria.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botReply]);
    }, 600);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setLikedIds((prev) => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
    toast.info(type === 'up' ? 'Thanks for positive feedback!' : 'Feedback noted');
  };

  return (
    <>
      {/* ── MOBILE-ONLY BLACK BLUR BACKDROP OVERLAY (DESKTOP NO BLUR) ── */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 w-screen h-screen bg-black/80 backdrop-blur-md z-40 md:hidden transition-all duration-300 animate-in fade-in cursor-pointer"
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed bottom-22 sm:bottom-24 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] max-w-[380px] sm:w-[360px] h-[540px] sm:h-[580px] max-h-[82vh] bg-white rounded-[28px] shadow-2xl border border-slate-200/90 flex flex-col overflow-visible transform origin-bottom-right transition-all duration-300 ease-out font-sans ${isOpen
            ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto'
            : 'scale-0 opacity-0 translate-y-6 pointer-events-none'
          }`}
      >
        {/* ── SPEECH BUBBLE TAIL / ANCHOR POINTING DOWN TO THE BOT ICON ── */}
        <div className="absolute -bottom-2.5 right-7 w-5 h-5 bg-white border-r border-b border-slate-200/90 rotate-45 z-0 rounded-xs shadow-xs hidden sm:block" />

        {/* ── INNER CARD WRAPPER WITH ROUNDED CORNERS ── */}
        <div className="w-full h-full flex flex-col rounded-[28px] overflow-hidden bg-white relative z-10">
          {/* ── 1. HEADER (EVERGREEN WITH BOT LOGO, MAIN TITLE, ONLINE STATUS, MINIMIZE BUTTON) ── */}
          <div className="bg-[#165B42] px-4 py-3.5 sm:px-5 sm:py-4 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              {/* Bot Icon with speech bubble */}
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <AiBotIcon className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-bold text-[16px] sm:text-[17px] leading-none text-white tracking-tight">
                  {title}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                  <span className="text-[12px] text-white/90 font-medium leading-none">Online</span>
                </div>
              </div>
            </div>

            {/* Minimize Button */}
            <button
              onClick={onClose}
              className="text-white/90 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer p-0.5"
              title="Minimize Chat"
            >
              <MinusCircle className="w-5 h-5" />
            </button>
          </div>

          {/* ── 2. CHAT MESSAGES BODY ── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-5 bg-white scrollbar-thin scrollbar-thumb-slate-200">
            {messages.map((msg) => {
              if (msg.sender === 'user') {
                return (
                  <div key={msg.id} className="space-y-1.5 flex flex-col items-end">
                    {/* Light Mint User Bubble (#E0F0EA) */}
                    <div className="relative max-w-[90%]">
                      <div className="bg-[#E0F0EA] text-[#165B42] px-4 py-3 rounded-[18px] text-[13px] leading-relaxed shadow-2xs relative z-10 font-medium">
                        {msg.text}
                      </div>

                      {/* Tail pointing down to user avatar at bottom-right */}
                      <div className="absolute -bottom-1 right-3 w-3.5 h-3.5 bg-[#E0F0EA] rotate-45 z-0" />
                    </div>

                    {/* Row below User Bubble: Timestamp on left, User Avatar on right */}
                    <div className="flex items-center justify-between w-full max-w-[90%] pr-0.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-slate-400 font-medium pl-1">
                        <span>{msg.time}</span>
                        {msg.showCheck && <Check className="w-3.5 h-3.5 text-[#165B42] stroke-[2.5]" />}
                      </div>

                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
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
                  </div>
                );
              }

              // Bot Message
              return (
                <div key={msg.id} className="space-y-1.5 flex flex-col items-start">
                  {/* Bot Green Bubble */}
                  <div className="relative max-w-[92%]">
                    <div className="bg-[#165B42] text-white px-4 py-3 rounded-[18px] text-[13px] leading-relaxed shadow-xs space-y-1 relative z-10">
                      {msg.text.split('\n').map((line, lIdx) => (
                        <p key={lIdx}>{line}</p>
                      ))}
                    </div>

                    {/* Tail pointing down to bot icon at bottom-left */}
                    <div className="absolute -bottom-1 left-3 w-3.5 h-3.5 bg-[#165B42] rotate-45 z-0" />

                    {/* Action Toolbar attached to bottom right of bubble */}
                    <div className="absolute -bottom-2.5 right-2 bg-[#114934] text-white px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm text-xs z-20">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-0.5 hover:text-emerald-200 cursor-pointer transition-colors"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-300" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={`p-0.5 hover:text-emerald-200 cursor-pointer transition-colors ${
                          likedIds[msg.id] === 'up' ? 'text-emerald-300' : ''
                        }`}
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={`p-0.5 hover:text-emerald-200 cursor-pointer transition-colors ${
                          likedIds[msg.id] === 'down' ? 'text-rose-300' : ''
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Row below Bot Bubble: Bot Avatar on left + Timestamp to right */}
                  <div className="flex items-center gap-2 pl-0.5">
                    <div className="w-8 h-8 rounded-full bg-[#165B42] flex items-center justify-center p-1 shrink-0 shadow-sm border-2 border-white">
                      <AiBotIcon className="w-full h-full text-white" />
                    </div>
                    <span className="text-[12px] text-slate-400 font-medium">{msg.time}</span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* ── 3. FOOTER SUGGESTION CHIPS ── */}
          <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-white border-t border-slate-100">
            <button
              onClick={() => handleSend('What is WappGPT?')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E0F0EA] hover:bg-[#d0e8df] text-[#165B42] text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border border-[#165B42]/15"
            >
              <span>🤔</span>
              <span>What is WappGPT?</span>
            </button>

            <button
              onClick={() => handleSend('Tell me about Pricing')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E0F0EA] hover:bg-[#d0e8df] text-[#165B42] text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border border-[#165B42]/15"
            >
              <span>💰</span>
              <span>Pricing</span>
            </button>

            <button
              onClick={() => handleSend('Show FAQs')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E0F0EA] hover:bg-[#d0e8df] text-[#165B42] text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border border-[#165B42]/15"
            >
              <span>🙋</span>
              <span>FAQs</span>
            </button>
          </div>

          {/* ── 4. INPUT BAR ── */}
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
            <style>{`
            .chat-borderless-input,
            .chat-borderless-input[type="text"],
            .chat-borderless-input[type="text"]:hover,
            .chat-borderless-input[type="text"]:focus,
            .chat-borderless-input[type="text"]:active {
              border: none !important;
              border-width: 0 !important;
              border-style: none !important;
              border-color: transparent !important;
              outline: none !important;
              box-shadow: none !important;
              background-color: transparent !important;
            }
          `}</style>
            <div className="flex items-center justify-between bg-[#F0F7F4] border border-[#E0F0EA] rounded-[20px] px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#165B42]/20 transition-all">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message here..."
                className="chat-borderless-input flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 pr-2 border-0 border-none outline-none focus:outline-none focus:ring-0 shadow-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputVal.trim()}
                className="text-[#165B42] hover:text-[#114934] disabled:opacity-40 transition-all cursor-pointer p-0.5"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
