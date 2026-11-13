import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { LiveClient } from '../services/geminiService';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  contextData: string;
}

const LiveAssistant: React.FC<Props> = ({ profile, contextData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'speaking' | 'connecting'>('disconnected');
  const [transcripts, setTranscripts] = useState<{in: string, out: string}>({in: '', out: ''});
  const clientRef = useRef<LiveClient | null>(null);

  const toggleSession = async () => {
    if (isOpen) {
      // Close session
      await clientRef.current?.disconnect();
      clientRef.current = null;
      setIsOpen(false);
      setStatus('disconnected');
    } else {
      // Open session
      setIsOpen(true);
      setStatus('connecting');
      try {
        const client = new LiveClient();
        client.onStatusChange = (s) => setStatus(s);
        client.onTranscriptUpdate = (inp, outp) => {
           setTranscripts(prev => ({
             in: inp ? inp : prev.in,
             out: outp ? outp : prev.out
           }));
        };
        await client.connect(profile, contextData);
        clientRef.current = client;
      } catch (e) {
        console.error("Failed to connect live", e);
        setStatus('disconnected');
        setIsOpen(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 bg-stone-900 text-stone-100 p-6 rounded-lg shadow-2xl border border-stone-700 animate-fade-in-up">
           <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold tracking-widest text-xs uppercase text-emerald-400">Live Tutor</h3>
              <div className="flex items-center gap-2">
                 <span className={`h-2 w-2 rounded-full ${status === 'speaking' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`}></span>
                 <span className="text-xs text-stone-400 uppercase">{status}</span>
              </div>
           </div>
           
           <div className="h-32 overflow-y-auto mb-4 text-sm space-y-2 border-t border-stone-800 pt-2 custom-scrollbar">
              {transcripts.in && (
                <div className="text-stone-400">
                    <span className="font-bold text-xs uppercase mr-2">You:</span>
                    <span className="inline-block">
                        <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {transcripts.in}
                        </ReactMarkdown>
                    </span>
                </div>
              )}
              {transcripts.out && (
                <div className="text-emerald-200">
                     <span className="font-bold text-xs uppercase mr-2">Tutor:</span>
                     <span className="inline-block">
                        <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {transcripts.out}
                        </ReactMarkdown>
                     </span>
                </div>
              )}
              {!transcripts.in && !transcripts.out && <p className="text-stone-600 italic">Listening... Ask any doubt.</p>}
           </div>

           <div className="flex justify-center">
              {status === 'speaking' ? (
                <div className="flex space-x-1 h-8 items-center">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 bg-emerald-500 h-full animate-wave" style={{animationDelay: `${i * 0.1}s`}}></div>
                  ))}
                </div>
              ) : (
                 <div className="text-xs text-stone-500">Mic Active</div>
              )}
           </div>
        </div>
      )}

      <button 
        onClick={toggleSession}
        className={`h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-red-900 hover:bg-red-800 rotate-45' : 'bg-emerald-900 hover:bg-emerald-800 hover:scale-105'}`}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
      <style>{`
        @keyframes wave {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .animate-wave {
          animation: wave 1s infinite ease-in-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LiveAssistant;