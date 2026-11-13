import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { UserProfile, StudyPlan, ChapterContent, ChatMessage } from '../types';
import { CoachingService } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  activePlan: StudyPlan | null;
  completedChapters: ChapterContent[];
  onUpdatePlan: (plan: StudyPlan) => void;
  onSaveContext?: (context: string) => void;
  studentContext?: string;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const DiscussTab: React.FC<Props> = ({ profile, activePlan, completedChapters, onUpdatePlan, onSaveContext, studentContext, chatHistory, setChatHistory }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const coachRef = useRef<CoachingService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Session Logic (Run Once on Mount)
  useEffect(() => {
    let mounted = true;
    
    const initSession = async () => {
       if (!coachRef.current) {
          coachRef.current = new CoachingService(onUpdatePlan, onSaveContext);
          
          try {
             const now = new Date();
             
             // --- Logic 1: New Day Detection (6 AM Threshold) ---
             const lastVisitStr = localStorage.getItem('tablewood_last_visit');
             let isNewDay = true;
             
             // Define "Today's" 6 AM
             const today6am = new Date(now);
             today6am.setHours(6, 0, 0, 0);

             if (lastVisitStr) {
                 const lastVisit = new Date(parseInt(lastVisitStr));
                 // If we visited today AFTER 6am, it's not a new day
                 if (lastVisit > today6am && now > today6am) {
                     isNewDay = false;
                 }
                 // If current time is BEFORE 6am, and we visited after yesterday's 6am, it's same day (night owls)
                 const yesterday6am = new Date(today6am);
                 yesterday6am.setDate(yesterday6am.getDate() - 1);
                 if (now < today6am && lastVisit > yesterday6am) {
                    isNewDay = false;
                 }
             }

             // Update last visit
             localStorage.setItem('tablewood_last_visit', Date.now().toString());

             // Start/Resume Session
             const greeting = await coachRef.current.startSession(
                 profile, 
                 activePlan, 
                 completedChapters, 
                 studentContext || "",
                 chatHistory, // Pass full history to hydrate context
                 isNewDay
             );

             if (mounted) {
                 // Only append greeting if the model returned one (it returns "" if !isNewDay)
                 if (greeting) {
                     const msg: ChatMessage = { role: 'model', text: greeting, timestamp: Date.now() };
                     setChatHistory([...chatHistory, msg]);
                 }
                 setIsInitializing(false);
             }

             // --- Logic 2: Autonomous Mid-day Check (12 PM) ---
             // Check if it's after 12 PM and we haven't done a check today
             const todayString = now.toDateString();
             const lastCheckDate = localStorage.getItem('tablewood_daily_check_date');

             if (now.getHours() >= 12 && lastCheckDate !== todayString && !isInitializing) {
                 // Perform autonomous check
                 setIsLoading(true);
                 const checkResponse = await coachRef.current.runDailyCheck();
                 if (checkResponse) {
                     const checkMsg: ChatMessage = { role: 'model', text: checkResponse, timestamp: Date.now() };
                     // We use a functional update based on current state here to avoid closure staleness if possible, 
                     // though in useEffect 'chatHistory' is stale. 
                     // Better: append to the *newly* set history or fetch current.
                     // Since we might have added a greeting, let's use the setter properly.
                     setChatHistory([...chatHistory, checkMsg]);
                 }
                 localStorage.setItem('tablewood_daily_check_date', todayString);
                 setIsLoading(false);
             }

          } catch (e: any) {
             console.error("Failed to start coach", e);
             if (mounted) {
                 setIsInitializing(false);
             }
          }
       }
    };
    initSession();
    return () => { mounted = false; };
  }, []); 

  // Periodic check for autonomous events (e.g. 12 PM check while tab is open)
  useEffect(() => {
    const timer = setInterval(async () => {
        if (!coachRef.current || isInitializing || isLoading) return;

        const now = new Date();
        const todayString = now.toDateString();
        const lastCheckDate = localStorage.getItem('tablewood_daily_check_date');

        // 12 PM Daily Check Logic
        if (now.getHours() >= 12 && lastCheckDate !== todayString) {
             setIsLoading(true);
             try {
                 const checkResponse = await coachRef.current.runDailyCheck();
                 if (checkResponse) {
                     const checkMsg: ChatMessage = { role: 'model', text: checkResponse, timestamp: Date.now() };
                     setChatHistory(prev => [...prev, checkMsg]);
                 }
                 localStorage.setItem('tablewood_daily_check_date', todayString);
             } catch(e) {
                 console.error("Auto check failed", e);
             } finally {
                 setIsLoading(false);
             }
        }
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [isInitializing, isLoading, setChatHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Auto-resize Textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !coachRef.current) return;
    
    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setChatHistory([...chatHistory, userMsg]);
    const messageToSend = input; // Capture before clearing
    setInput(''); // Clear input immediately for UI responsiveness
    
    // Reset textarea height manually after clear
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsLoading(true);

    try {
       const responseText = await coachRef.current.sendMessage(messageToSend);
       const botMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
       setChatHistory(prev => [...prev, botMsg]);
    } catch (e: any) {
       console.error(e);
       setChatHistory(prev => [...prev, { role: 'model', text: `⚠️ Error: ${e.message || "Failed to send message."}`, timestamp: Date.now() }]);
    } finally {
       setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
      }
  };

  const handleQuickAction = (action: 'updates' | 'videos' | 'report') => {
      let prompt = "";
      if (action === 'updates') {
          prompt = "Check for the latest official exam updates, syllabus changes, twitter handles of exam agencies, and news from top coaching institutes. Summarize the critical info.";
      } else if (action === 'videos') {
          prompt = "I need video recommendations. Ask me which subject and chapter I want videos for, then search specifically for high-quality lecture transcripts on YouTube.";
      } else if (action === 'report') {
          prompt = "Generate a performance report based on my current progress and our history.";
      }
      
      // Simulate input for quick action
      const userMsg: ChatMessage = { role: 'user', text: prompt, timestamp: Date.now() };
      setChatHistory([...chatHistory, userMsg]);
      setIsLoading(true);

      coachRef.current?.sendMessage(prompt).then((responseText) => {
         const botMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
         setChatHistory(prev => [...prev, botMsg]);
         setIsLoading(false);
      }).catch((e) => {
         setChatHistory(prev => [...prev, { role: 'model', text: "Failed to perform action.", timestamp: Date.now() }]);
         setIsLoading(false);
      });
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="bg-stone-900 p-4 flex flex-col md:flex-row justify-between items-center text-stone-50 gap-4">
            <div>
                <h3 className="font-bold brand-font text-lg tracking-wider">Learning Intelligence</h3>
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest">
                    {activePlan ? `Tracking: ${activePlan.title}` : 'No Active Plan'}
                </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
                <button 
                    onClick={() => handleQuickAction('report')}
                    className="text-[10px] bg-stone-700 hover:bg-stone-600 px-3 py-1 rounded transition-colors uppercase tracking-widest font-bold border border-stone-600"
                >
                    Generate Report
                </button>
                <button 
                    onClick={() => handleQuickAction('updates')}
                    className="text-[10px] bg-emerald-900 hover:bg-emerald-700 px-3 py-1 rounded transition-colors uppercase tracking-widest font-bold"
                >
                    Latest Updates
                </button>
                <button 
                    onClick={() => handleQuickAction('videos')}
                    className="text-[10px] bg-stone-700 hover:bg-stone-600 px-3 py-1 rounded transition-colors uppercase tracking-widest font-bold"
                >
                    Recommend Videos
                </button>
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-stone-50">
            {isInitializing ? (
                <div className="flex justify-center items-center h-full">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-2 w-24 bg-stone-300 rounded mb-2"></div>
                        <span className="text-xs text-stone-400 uppercase tracking-widest">Initializing Coach...</span>
                    </div>
                </div>
            ) : (
                chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-xl shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-white text-stone-800 border border-stone-200 rounded-tr-none' 
                            : 'bg-stone-900 text-stone-200 rounded-tl-none border border-stone-800'
                        }`}>
                             <ReactMarkdown 
                                components={{
                                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props}/>,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props}/>,
                                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props}/>,
                                    a: ({node, ...props}) => <a className="text-emerald-400 hover:underline" target="_blank" {...props}/>
                                }} 
                                remarkPlugins={[remarkMath]} 
                                rehypePlugins={[rehypeKatex]}
                             >
                                {msg.text}
                             </ReactMarkdown>
                             <div className="text-[9px] opacity-40 mt-2 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                ))
            )}
            
            {isLoading && (
                 <div className="flex justify-start">
                    <div className="bg-stone-200 text-stone-500 text-xs px-4 py-2 rounded-full animate-pulse">
                        Thinking & Searching...
                    </div>
                 </div>
            )}
            <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-stone-200">
            <div className="flex gap-2 items-end">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Discuss your progress, ask strategy, or analyze mock tests..."
                    className="flex-grow p-3 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800 transition-colors text-stone-800 placeholder-stone-400 resize-none overflow-hidden min-h-[46px] max-h-[150px]"
                    disabled={isLoading || isInitializing}
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || isInitializing || !input.trim()}
                    className="h-[46px] px-6 bg-emerald-900 text-white font-bold rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors uppercase tracking-widest text-xs flex-shrink-0 flex items-center justify-center"
                >
                    Send
                </button>
            </div>
            <div className="text-[9px] text-stone-300 mt-2 text-center uppercase tracking-wider">
               Press Enter to send, Shift+Enter for new line
            </div>
        </div>
    </div>
  );
};

export default DiscussTab;