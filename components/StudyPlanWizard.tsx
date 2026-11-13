import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { StudyPlan, StudyPlanInput } from '../types';

interface Props {
  onSubmit: (input: StudyPlanInput) => void;
  plan: StudyPlan | null;
  onBack: () => void;
  onSave?: () => void;
  onUpdatePlan?: (plan: StudyPlan) => void;
  onToggleActive?: () => void; // New prop
}

const StudyPlanWizard: React.FC<Props> = ({ onSubmit, plan, onBack, onSave, onUpdatePlan, onToggleActive }) => {
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState<StudyPlanInput>({
    prepLevel: '',
    studyHours: '',
    weakAreas: ''
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onSubmit(inputs);
  };

  const handleInput = (field: keyof StudyPlanInput, value: string) => {
    setInputs({ ...inputs, [field]: value });
  };

  // Toggle Task Completion
  const toggleTask = (pIdx: number, wIdx: number, dIdx: number, tIdx: number) => {
     if (!plan || !onUpdatePlan) return;
     
     // Deep copy to avoid direct mutation
     const updatedPlan = JSON.parse(JSON.stringify(plan));
     updatedPlan.phases[pIdx].weeks[wIdx].days[dIdx].tasks[tIdx].isCompleted = 
       !updatedPlan.phases[pIdx].weeks[wIdx].days[dIdx].tasks[tIdx].isCompleted;
       
     onUpdatePlan(updatedPlan);
  };

  if (plan) {
    return (
      <div className="max-w-6xl mx-auto p-6 pb-32 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <button onClick={onBack} className="flex items-center text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest text-xs font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to Dashboard
            </button>

            <div className="flex gap-3">
                {onToggleActive && (
                    <button
                        onClick={onToggleActive}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors shadow-lg border ${plan.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-300'}`}
                    >
                        {plan.isActive ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                </svg>
                                Active Plan
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                                Set as Active
                            </>
                        )}
                    </button>
                )}

                {onSave && (
                    <button 
                        onClick={onSave}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors shadow-lg ${
                            plan.id 
                            ? 'bg-stone-100 text-stone-400 cursor-default' 
                            : 'bg-stone-900 text-stone-50 hover:bg-emerald-900'
                        }`}
                        disabled={!!plan.id}
                    >
                        {plan.id ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                </svg>
                                Saved
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                                </svg>
                                Save Plan
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>

        <header className="mb-10 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-stone-900 serif mb-4">
                 <ReactMarkdown 
                    components={{p: ({node, ...props}) => <span {...props}/>}} 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                 >
                    {plan.title}
                 </ReactMarkdown>
            </h1>
            <div className="text-stone-600 max-w-3xl mx-auto">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {plan.overview}
                </ReactMarkdown>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-12">
                {plan.phases?.map((phase, pIdx) => (
                    <div key={pIdx} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-stone-900 text-stone-50 p-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold uppercase tracking-wider">{phase.title}</h3>
                                <span className="text-xs text-stone-400 font-mono">{phase.duration}</span>
                            </div>
                            <span className="text-3xl opacity-20 font-serif">{pIdx + 1}</span>
                        </div>
                        <div className="p-6 space-y-8">
                            {phase.weeks?.map((week, wIdx) => (
                                <div key={wIdx} className="border-l-2 border-stone-200 pl-6 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-stone-300"></div>
                                    <div className="font-bold text-lg text-emerald-800 mb-2">
                                        Week {week.week}: <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{week.focus}</ReactMarkdown>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {week.days?.map((day, dIdx) => (
                                            <div key={dIdx} className="bg-stone-50 p-4 rounded border border-stone-100">
                                                <div className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{day.day}</div>
                                                <ul className="text-sm space-y-2 text-stone-700">
                                                    {day.tasks?.map((task, tIdx) => (
                                                        <li key={tIdx} className="flex items-start group cursor-pointer" onClick={() => toggleTask(pIdx, wIdx, dIdx, tIdx)}>
                                                            <div className={`mr-3 w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-stone-400 bg-white'}`}>
                                                              {task.isCompleted && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                              )}
                                                            </div>
                                                            <div className={`transition-all ${task.isCompleted ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                                                                <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                                    {task.description}
                                                                </ReactMarkdown>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Mock Test Schedule */}
                {plan.mockTests && plan.mockTests.length > 0 && (
                  <div className="bg-stone-900 text-stone-300 rounded-xl overflow-hidden shadow-lg p-8">
                     <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-widest border-b border-stone-700 pb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-500">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Simulation & Testing Schedule
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {plan.mockTests.map((test, i) => (
                           <div key={i} className="bg-stone-800 p-5 rounded border border-stone-700 hover:border-emerald-700 transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                 <span className="text-emerald-400 font-bold text-sm uppercase tracking-wider font-serif">{test.name}</span>
                                 <span className="text-[10px] bg-stone-900 px-2 py-1 rounded text-stone-400 uppercase tracking-widest">{test.timing}</span>
                              </div>
                              <p className="text-stone-400 text-sm leading-relaxed">
                                 <span className="text-stone-500 font-bold uppercase text-[10px] tracking-widest block mb-1">Syllabus Focus</span>
                                 <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {test.syllabus}
                                 </ReactMarkdown>
                              </p>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
            </div>

            <div className="lg:col-span-1">
                <div className="bg-emerald-900 text-emerald-50 p-6 rounded-xl sticky top-8">
                    <h3 className="font-bold uppercase tracking-widest text-sm mb-6 border-b border-emerald-800 pb-2">Elite Tips</h3>
                    <ul className="space-y-4 text-sm">
                        {plan.tips?.map((tip, i) => (
                            <li key={i} className="flex gap-3">
                                <span className="text-emerald-400 font-serif italic flex-shrink-0">{i+1}.</span>
                                <div className="leading-relaxed">
                                    <ReactMarkdown components={{p: ({node, ...props}) => <span {...props}/>}} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {tip}
                                    </ReactMarkdown>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-stone-200 text-center">
            <p className="text-[9px] text-stone-400 uppercase tracking-wider leading-relaxed opacity-60 max-w-2xl mx-auto">
               Disclaimer: This app is a hackathon prototype and demo version, not a real full app. Powered by Google Gemini API. Content is AI-generated and may be inaccurate or misleading; please verify independently. 
               TableWood does not guarantee or assure specific exam results or target achievement. 
               The developer accepts no liability for content errors or usage outcomes.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6 animate-fade-in">
        <div className="max-w-xl w-full">
            <button onClick={onBack} className="mb-8 text-stone-400 hover:text-stone-800 text-sm uppercase tracking-widest transition-colors">
                &larr; Cancel
            </button>
            
            <div className="bg-white p-10 rounded-2xl shadow-xl border border-stone-100">
                <div className="flex justify-between mb-10">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 mx-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
                    ))}
                </div>

                <div className="min-h-[200px]">
                    {step === 1 && (
                        <div className="animate-slide-in">
                            <h2 className="text-2xl font-bold serif mb-6 text-stone-900">Current Preparation Level</h2>
                            <div className="space-y-3">
                                {['Just Starting', 'Covered Basics', 'Intermediate', 'Advanced / Revision Mode'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => { handleInput('prepLevel', opt); handleNext(); }}
                                        className={`w-full text-left p-4 rounded-lg border transition-all ${inputs.prepLevel === opt ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 hover:border-stone-400 text-stone-600'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-slide-in">
                            <h2 className="text-2xl font-bold serif mb-6 text-stone-900">Daily Study Availability</h2>
                            <p className="text-stone-500 mb-6">How many focused hours can you dedicate each day?</p>
                            <input
                                type="text"
                                value={inputs.studyHours}
                                onChange={(e) => handleInput('studyHours', e.target.value)}
                                placeholder="e.g., 4 hours on weekdays, 8 on weekends"
                                className="w-full text-xl p-4 border-b-2 border-stone-200 focus:border-stone-800 outline-none bg-transparent placeholder-stone-300"
                                autoFocus
                            />
                            <button
                                disabled={!inputs.studyHours}
                                onClick={handleNext}
                                className="mt-8 px-8 py-3 bg-stone-900 text-white rounded-full font-bold hover:bg-emerald-900 disabled:opacity-50 transition-colors"
                            >
                                Next Step
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-slide-in">
                            <h2 className="text-2xl font-bold serif mb-6 text-stone-900">Identifying Knowledge Gaps</h2>
                            <p className="text-stone-500 mb-6">List any specific topics or subjects you find difficult or have missed.</p>
                            <textarea
                                value={inputs.weakAreas}
                                onChange={(e) => handleInput('weakAreas', e.target.value)}
                                placeholder="e.g., Fluid Mechanics, Medieval History, Probability..."
                                className="w-full h-32 p-4 rounded-lg bg-stone-50 border border-stone-200 focus:border-stone-800 outline-none resize-none"
                                autoFocus
                            />
                            <button
                                onClick={handleNext}
                                className="mt-8 px-8 py-3 bg-emerald-900 text-white rounded-full font-bold hover:bg-emerald-800 transition-colors shadow-lg w-full"
                            >
                                Generate Blueprint
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-8 text-center">
                 <p className="text-[9px] text-stone-400 uppercase tracking-wider leading-relaxed opacity-60">
                    Disclaimer: This app is a hackathon prototype and demo version, not a real full app. Powered by Google Gemini API. Content is AI-generated and may be inaccurate or misleading; please verify independently. 
                    TableWood does not guarantee or assure specific exam results or target achievement. 
                    The developer accepts no liability for content errors or usage outcomes.
                 </p>
            </div>
        </div>
        <style>{`
            .animate-slide-in { animation: slideIn 0.4s ease-out; }
            @keyframes slideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        `}</style>
    </div>
  );
};

export default StudyPlanWizard;