// src/components/SplitSyncChat.jsx
// Floating AI chatbot powered by Anthropic via Firebase Cloud Function proxy.
// Renders on all authenticated pages as a floating action button (bottom-right).

import { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthStore } from '../stores/authStore';
import { MessageCircle, X, Send, Bot, User, Loader, RotateCcw } from 'lucide-react';
import app from '../services/firebase';

// Suggested starter questions shown before first message
const SUGGESTIONS = [
  'How do I split an expense equally?',
  'How do I settle up with someone?',
  'How do I invite friends to a group?',
  'How do I set up my payment methods?',
];

// Format assistant response: strip markdown symbols and insert line breaks before numbered steps
function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')     // remove **bold**
    .replace(/\*(.*?)\*/g, '$1')            // remove *italic*
    .replace(/^#+\s/gm, '')                  // remove # headers
    .replace(/(\s)(\d+\.\s)/g, '\n$2')  // line break before "2. " "3. " etc
    .trim();
}

// Single chat message bubble
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const lines  = isUser
    ? [msg.content]
    : formatMessage(msg.content).split('\n');

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser
          ? 'bg-indigo-600 text-white'
          : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
      }`}>
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-600 rounded-tl-sm shadow-sm'
      }`}>
        {lines.map((line, i) => (
          <span key={i} className={line.match(/^\d+\./) ? 'block mt-1' : ''}>
            {line}
            {!line.match(/^\d+\./) && i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SplitSyncChat({ groupCount = 0, totalBalance = 0 }) {
  const { user } = useAuthStore();

  const [open,     setOpen]     = useState(false);
  const [input,    setInput]    = useState('');
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Initialise Firebase Functions — connects to emulator in dev, production in prod
  const fns    = getFunctions(app);
  const chatFn = httpsCallable(fns, 'splitSyncChat');

  // Scroll to latest message whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when chat window opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Send a message — accepts optional text override for suggestion chips
  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    setInput('');
    setError('');

    const userMsg = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const result = await chatFn({
        messages:    updated,
        userContext: { groupCount, totalBalance },
      });
      setMessages(prev => [...prev, { role: 'assistant', content: result.data.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('Could not reach the assistant. Please try again.');
      // Remove the optimistic user message so they can retry
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setError('');
    setInput('');
  };

  // Only render for authenticated users
  if (!user) return null;

  return (
    <>
      {/* ── Chat window ── */}
      {open && (
        <div
          className="fixed bottom-20 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-[340px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900"
          style={{ height: '460px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Split-Sync Assistant</p>
                <p className="text-white/70 text-xs">Ask me anything about the app</p>
              </div>
            </div>
            {/* Header action buttons — clear and close */}
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  title="Clear conversation"
                >
                  <RotateCcw size={13} className="text-white/80" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
              >
                <X size={15} className="text-white" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

            {/* Welcome message and suggestion chips */}
            {messages.length === 0 && (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[80%]">
                    <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
                      Hi there! I am the Split-Sync assistant. I can help you with expenses, groups, payments, and anything else in the app.
                    </p>
                  </div>
                </div>

                {/* Suggestion chips */}
                <div className="pl-8 flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left text-xs px-3 py-1.5 bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 text-center px-2">{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50 max-h-20 overflow-y-auto"
                style={{ minHeight: '36px' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0 mb-0.5"
                aria-label="Send message"
              >
                {loading
                  ? <Loader size={13} className="text-white animate-spin" />
                  : <Send size={13} className="text-white" />
                }
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
              Powered by Claude AI
            </p>
          </div>
        </div>
      )}

      {/* ── Floating toggle button — smaller size ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-20 right-3 z-40 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${
          open
            ? 'bg-gray-600 dark:bg-gray-500'
            : 'bg-gradient-to-br from-indigo-600 to-purple-600 hover:shadow-xl'
        }`}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open
          ? <X size={18} className="text-white" />
          : <MessageCircle size={18} className="text-white" />
        }
      </button>
    </>
  );
}
