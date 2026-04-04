import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import { sendChatMessage } from '../api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! I\'m your Sri Lanka Property AI. Ask me anything like "What\'s a fair price for 3BR in Colombo 7?"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Create history for API
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const res = await sendChatMessage(userMsg, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 w-[90vw] sm:w-[400px] h-[500px] bg-bg-card/90 backdrop-blur-xl border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-accent/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    Property Assistant
                    <span className="flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Powered by Groq • AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-border/20 rounded-lg transition-colors cursor-pointer text-text-muted hover:text-text-primary border-none"
                aria-label="Close assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex w-full mb-2",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-accent text-white rounded-tr-none" 
                      : "bg-bg-card-hover border border-border text-text-primary rounded-tl-none shadow-sm"
                  )}>
                    {msg.content}
                    {msg.role === 'assistant' && i === 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                        <button 
                          onClick={() => setInput("What's a fair price for 3BR in Colombo 7?")}
                          className="bg-accent/10 text-accent-light px-2 py-1 rounded-md border border-accent/20 hover:bg-accent/20"
                        >
                          "Colombo 7 price?"
                        </button>
                        <button 
                          onClick={() => setInput("Show me 2 perch land prices in Kandy")}
                          className="bg-accent/10 text-accent-light px-2 py-1 rounded-md border border-accent/20 hover:bg-accent/20"
                        >
                          "Kandy land prices"
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-bg-card-hover border border-border rounded-2xl rounded-tl-none p-3 shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-accent-light rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-accent-light rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-accent-light rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-bg-card/50">
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about properties..."
                  className="w-full bg-bg-card border border-border group-focus-within:border-accent rounded-xl px-4 py-2.5 text-sm outline-none transition-all pr-12 text-text-primary"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-2 top-1.5 p-1.5 bg-accent hover:bg-accent-light disabled:bg-border/50 rounded-lg text-white transition-all transform active:scale-95 border-none cursor-pointer"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-text-muted mt-2 flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                Ask for "fair prices" or "best areas" 
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close assistant" : "Open property assistant"}
        aria-expanded={isOpen}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group relative overflow-hidden border-none cursor-pointer",
          isOpen ? "bg-bg-card border border-border rotate-90" : "bg-accent text-white"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
        {isOpen ? (
          <X className="w-6 h-6 text-text-primary" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full border-2 border-accent" />
          </div>
        )}
      </button>
    </div>
  );
}
