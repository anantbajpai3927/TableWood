import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChapterContent } from '../types';
import { generateDiagram } from '../services/geminiService';

interface Props {
  content: ChapterContent;
  onBack: () => void;
  onSave?: () => void; // Optional save handler
  onUpdateContent?: (content: ChapterContent) => void;
  onToggleComplete?: () => void; // New prop
}

// Sub-component for generating and displaying diagrams
interface DiagramProps {
    description: string;
    existingUrl?: string;
    onGenerate?: (url: string) => void;
}

const DiagramGenerator: React.FC<DiagramProps> = ({ description, existingUrl, onGenerate }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(existingUrl || null);
  const [loading, setLoading] = useState(!existingUrl);

  // Clean description for caption display (remove $ and *)
  const cleanCaption = description.replace(/[*$]/g, '').trim();

  useEffect(() => {
    // If we have an existing URL (from saved notes), use it and do NOT regenerate.
    if (existingUrl) {
        setImageUrl(existingUrl);
        setLoading(false);
        return;
    }

    let mounted = true;
    const fetchDiagram = async () => {
      // Generate only if no URL exists
      const url = await generateDiagram(description);
      if (mounted) {
        if (url) {
            setImageUrl(url);
            if (onGenerate) onGenerate(url);
        }
        setLoading(false);
      }
    };
    fetchDiagram();
    return () => { mounted = false; };
  }, [description, existingUrl]); // Dependency array handles props changes

  if (loading) {
     return (
        <div className="my-8 flex flex-col items-center justify-center p-8 bg-stone-50 border border-stone-100 rounded-lg animate-pulse">
           <div className="h-48 w-full max-w-md bg-stone-200 rounded mb-4"></div>
           <p className="text-xs text-stone-400 uppercase tracking-widest">Generating Diagram...</p>
        </div>
     );
  }

  if (!imageUrl) return null;

  return (
    <figure className="my-10 text-center animate-fade-in">
       <img src={imageUrl} alt={cleanCaption} className="max-w-full md:max-w-xl mx-auto rounded-lg shadow-md border border-stone-200" />
       <figcaption className="mt-2 text-xs text-stone-500 italic font-serif max-w-lg mx-auto">{cleanCaption}</figcaption>
    </figure>
  );
};

const ChapterView: React.FC<Props> = ({ content, onBack, onSave, onUpdateContent, onToggleComplete }) => {
  
  const handleImageGenerated = (subtopicIndex: number, url: string) => {
      if (!onUpdateContent) return;
      
      // Clone content to be immutable
      const updatedContent = { ...content };
      updatedContent.subtopics = [...content.subtopics];
      updatedContent.subtopics[subtopicIndex] = {
          ...updatedContent.subtopics[subtopicIndex],
          diagramUrl: url
      };
      
      onUpdateContent(updatedContent);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 pb-32 animate-fade-in bg-[#fdfbf7] shadow-2xl min-h-screen border-x border-stone-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <button onClick={onBack} className="flex items-center text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Dashboard
        </button>

        <div className="flex gap-3">
            {onToggleComplete && content.id && (
                <button
                    onClick={onToggleComplete}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors shadow-lg border ${content.isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300'}`}
                >
                    {content.isCompleted ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                            </svg>
                            Completed
                        </>
                    ) : (
                        <>
                            <span className="w-4 h-4 rounded-full border-2 border-stone-300"></span>
                            Mark as Done
                        </>
                    )}
                </button>
            )}

            {onSave && (
                <button 
                    onClick={onSave}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-50 text-xs font-bold uppercase tracking-widest rounded hover:bg-emerald-900 transition-colors shadow-lg"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                    Save Notes
                </button>
            )}
        </div>
      </div>

      {/* Header */}
      <header className="mb-16 border-b-2 border-stone-900 pb-8 text-center md:text-left">
        <h1 className="text-4xl md:text-7xl font-bold text-stone-900 mb-8 serif leading-tight tracking-tight">
             <ReactMarkdown 
                components={{p: ({node, ...props}) => <span {...props}/>}} 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
             >
                {content.title}
             </ReactMarkdown>
        </h1>
        {/* Intro Section - Book Style */}
        <div className="book-content text-lg md:text-xl text-stone-700 font-serif leading-loose italic border-l-4 border-stone-300 pl-6">
           <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
             {content.intro}
           </ReactMarkdown>
        </div>
      </header>

      {/* Strategy Card */}
      <div className="bg-stone-100 p-8 rounded-lg mb-20 border border-stone-200">
        <h3 className="text-stone-900 font-bold uppercase tracking-widest text-sm mb-4 flex items-center justify-center md:justify-start">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
             <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
          </svg>
          Exam Strategy
        </h3>
        <div className="text-stone-800 font-serif text-lg leading-relaxed book-content">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {content.strategy}
          </ReactMarkdown>
        </div>
      </div>

      {/* Subtopics */}
      <div className="space-y-24">
        {content.subtopics?.map((sub, idx) => (
          <section key={idx} className="relative">
            
            {/* Subtopic Header */}
            <div className="flex items-center mb-10">
               <span className="text-4xl font-bold text-stone-300 font-serif mr-4 select-none">{String(idx + 1).padStart(2, '0')}</span>
               <h2 className="text-3xl md:text-4xl font-bold text-stone-900 serif border-b-2 border-stone-900 pb-2 flex-grow">
                  <ReactMarkdown 
                    components={{p: ({node, ...props}) => <span {...props}/>}} 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                 >
                    {sub.title}
                 </ReactMarkdown>
               </h2>
            </div>

            {/* Theory Content - Book Style */}
            <div className="book-content prose prose-stone prose-lg md:prose-xl max-w-none mb-12 text-stone-800 leading-9 font-serif">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {sub.content}
              </ReactMarkdown>
            </div>

            {/* Embedded Diagram */}
            {sub.diagramDescription && (
                <DiagramGenerator 
                    description={sub.diagramDescription} 
                    existingUrl={sub.diagramUrl}
                    onGenerate={(url) => handleImageGenerated(idx, url)}
                />
            )}

            {/* Formulas Box */}
            {sub.formulas?.length > 0 && (
              <div className="bg-stone-50 border-y-2 border-stone-200 p-8 mb-12">
                <h4 className="font-bold text-xs uppercase tracking-widest text-stone-500 mb-6 text-center">Key Formulas</h4>
                <ul className="grid grid-cols-1 gap-6 font-serif text-xl md:text-2xl text-center">
                  {sub.formulas.map((f, i) => (
                    <li key={i} className="py-2">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{f}</ReactMarkdown>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Solved Example - Distinct Section */}
            {sub.exampleQuestion && (
              <div className="bg-[#f0fdf4] border border-emerald-100 rounded-xl p-8 shadow-sm">
                 <div className="flex justify-between items-center mb-6">
                    <span className="text-emerald-800 font-bold uppercase tracking-widest text-xs">Illustrative Example</span>
                    <span className="text-emerald-600 text-xs font-semibold px-2 py-1 bg-white rounded border border-emerald-100">{sub.exampleQuestion.type}</span>
                 </div>
                 <div className="mb-8 text-stone-900 font-medium text-xl font-serif">
                     <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{sub.exampleQuestion.question}</ReactMarkdown>
                 </div>
                 <div className="pl-6 border-l-2 border-emerald-300">
                    <h5 className="text-xs font-bold text-emerald-600 uppercase mb-3">Solution</h5>
                    <div className="book-content prose prose-stone max-w-none">
                         <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{sub.exampleQuestion.solution}</ReactMarkdown>
                    </div>
                 </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Question Bank */}
      <section className="mt-32 border-t-4 border-stone-900 pt-16">
        <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-6 serif">Mastery Question Bank</h2>
            <p className="text-stone-500 text-lg max-w-2xl mx-auto italic">Challenge yourself with these high-yield problems.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-12">
          {content.questionBank?.map((q, idx) => {
            const isMustDo = content.mustDoQuestionIndices?.includes(idx);
            return (
              <div key={idx} className={`pb-8 border-b border-stone-200 ${isMustDo ? 'bg-emerald-50/30 -mx-6 px-6 pt-6 rounded-lg' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                     <span className="text-stone-400 font-bold font-serif text-lg">Q{idx + 1}.</span>
                     {isMustDo && <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 pt-1">Must Do</span>}
                  </div>
                  <div className="flex gap-2">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 border border-stone-200 px-2 py-1 rounded">{q.type}</span>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 border border-stone-200 px-2 py-1 rounded">{q.difficulty}</span>
                  </div>
                </div>
                
                <div className="font-serif text-xl text-stone-900 mb-6 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.question}</ReactMarkdown>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center transition-colors uppercase tracking-widest select-none">
                     <span>Show Solution</span>
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2 group-open:rotate-180 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                     </svg>
                  </summary>
                  <div className="mt-6 pl-6 border-l-2 border-emerald-200 text-stone-800 animate-fade-in book-content prose prose-stone max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.solution}</ReactMarkdown>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      {/* Practice Note */}
      {content.practiceNote && (
         <div className="mt-20 p-8 bg-stone-900 text-stone-300 rounded-lg">
             <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-4">Coach's Extra Practice Advice</h3>
             <div className="font-serif leading-relaxed text-lg italic">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{content.practiceNote}</ReactMarkdown>
             </div>
         </div>
      )}

      {/* Disclaimer */}
      <div className="mt-24 pt-8 border-t border-stone-200 text-center">
         <p className="text-[9px] text-stone-400 uppercase tracking-wider leading-relaxed opacity-60 max-w-2xl mx-auto">
            Disclaimer: This app is a hackathon prototype and demo version, not a real full app. Powered by Google Gemini API. Content is AI-generated and may be inaccurate or misleading; please verify independently. 
            TableWood does not guarantee or assure specific exam results or target achievement. 
            The developer accepts no liability for content errors or usage outcomes.
         </p>
      </div>
      
      <style>{`
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default ChapterView;