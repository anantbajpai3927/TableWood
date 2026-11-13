import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Onboarding from './components/Onboarding';
import ChapterView from './components/ChapterView';
import LiveAssistant from './components/LiveAssistant';
import StudyPlanWizard from './components/StudyPlanWizard';
import DiscussTab from './components/DiscussTab';
import { generateChapterNotes, generateStudyPlan } from './services/geminiService';
import { UserProfile, ChapterContent, AppState, StudyPlan, StudyPlanInput, DashboardTab, Attachment, ChatMessage } from './types';

// Reusable Disclaimer Component
const Disclaimer = ({ dark = false }: { dark?: boolean }) => (
  <div className="w-full py-6 text-center px-6 mt-auto z-10 relative">
    <p className={`text-[9px] uppercase tracking-wider leading-relaxed opacity-60 max-w-3xl mx-auto ${dark ? 'text-stone-600' : 'text-stone-400'}`}>
      Disclaimer: This app is a hackathon prototype and demo version, not a real full app. Powered by Google Gemini API. Content is AI-generated and may be inaccurate or misleading; please verify independently. 
      TableWood does not guarantee or assure specific exam results or target achievement. 
      The developer accepts no liability for content errors or usage outcomes.
    </p>
  </div>
);

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.ONBOARDING);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Chapter Generation State
  const [chapterInput, setChapterInput] = useState('');
  const [chapterAttachments, setChapterAttachments] = useState<Attachment[]>([]);
  const [chapterContent, setChapterContent] = useState<ChapterContent | null>(null);
  
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Persistence State
  const [savedChapters, setSavedChapters] = useState<ChapterContent[]>([]);
  const [savedPlans, setSavedPlans] = useState<StudyPlan[]>([]);
  const [studentContext, setStudentContext] = useState<string>(""); // AI Memory
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); // Persistent Chat History
  
  // Dashboard State
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('library');
  const [savedResourceView, setSavedResourceView] = useState<'chapters' | 'plans'>('chapters');

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedChapters = localStorage.getItem('tablewood_chapters');
      const storedPlans = localStorage.getItem('tablewood_plans');
      const storedContext = localStorage.getItem('tablewood_context');
      const storedChat = localStorage.getItem('tablewood_chat_history');
      
      if (storedChapters) {
          // Ensure all loaded chapters have an ID (migration for old data)
          const parsed = JSON.parse(storedChapters);
          const validated = parsed.map((c: ChapterContent) => ({ ...c, id: c.id || Date.now().toString() + Math.random() }));
          setSavedChapters(validated);
      }
      if (storedPlans) {
          const parsed = JSON.parse(storedPlans);
          const validated = parsed.map((p: StudyPlan) => ({ ...p, id: p.id || Date.now().toString() + Math.random() }));
          setSavedPlans(validated);
      }
      if (storedContext) setStudentContext(storedContext);
      if (storedChat) setChatHistory(JSON.parse(storedChat));
    } catch (e) {
      console.error("Failed to load local storage", e);
    }
  }, []);

  // Save chat history whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
        localStorage.setItem('tablewood_chat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Timer for countdown
  useEffect(() => {
    let interval: any;
    if ((appState === AppState.GENERATING_CHAPTER || appState === AppState.GENERATING_PLAN) && estimatedTime > 0) {
      interval = setInterval(() => {
        setEstimatedTime((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState, estimatedTime]);

  const handleOnboardingComplete = (p: UserProfile) => {
    setProfile(p);
    setAppState(AppState.DASHBOARD);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newAttachments: Attachment[] = [];
      
      files.forEach((file: File) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              // Remove data URL prefix (e.g., "data:image/png;base64,") for the API if needed, 
              // BUT Gemini API expects the raw base64 data without prefix in inlineData.data
              const base64Data = base64String.split(',')[1];
              newAttachments.push({
                  mimeType: file.type,
                  data: base64Data
              });
              if (newAttachments.length === files.length) {
                  setChapterAttachments(prev => [...prev, ...newAttachments]);
              }
          };
          reader.readAsDataURL(file);
      });
    }
  };

  const handleGenerateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !chapterInput) return;

    setAppState(AppState.GENERATING_CHAPTER);
    setLoadingMsg("Researching global exam trends...");
    setEstimatedTime(65); 
    
    const timers = [
      setTimeout(() => setLoadingMsg("Analyzing syllabus & attachments..."), 5000),
      setTimeout(() => setLoadingMsg("Drafting theory & selecting problems..."), 15000),
      setTimeout(() => setLoadingMsg("Finalizing elite study notes..."), 35000),
      setTimeout(() => setLoadingMsg("Almost ready. Deep thinking in progress..."), 55000),
    ];

    try {
      const notes = await generateChapterNotes(profile, chapterInput, chapterAttachments);
      setChapterContent(notes);
      setAppState(AppState.READING_CHAPTER);
      setChapterAttachments([]); // Clear attachments after use
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Something went wrong. Please try again. The AI might be busy.");
      setAppState(AppState.DASHBOARD);
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const handleGeneratePlan = async (inputs: StudyPlanInput) => {
    if (!profile) return;
    setAppState(AppState.GENERATING_PLAN);
    setLoadingMsg("Designing your strategic roadmap...");
    setEstimatedTime(50);
    
    try {
        const plan = await generateStudyPlan(profile, inputs);
        setStudyPlan(plan);
        setAppState(AppState.VIEWING_PLAN);
    } catch (error: any) {
        console.error(error);
        alert(error.message || "Failed to generate plan. Please try again.");
        setAppState(AppState.WIZARD_PLAN);
    }
  };

  // --- Persistence Handlers ---

  const handleContentUpdate = (updatedContent: ChapterContent) => {
    setChapterContent(updatedContent);
    // If this chapter was already saved, update it in storage too to save the images
    if (updatedContent.id) {
        const updatedList = savedChapters.map(c => c.id === updatedContent.id ? updatedContent : c);
        setSavedChapters(updatedList);
        try {
          localStorage.setItem('tablewood_chapters', JSON.stringify(updatedList));
        } catch (e) {
          console.error("Storage full or error", e);
        }
    }
  };

  const saveChapter = () => {
    if (!chapterContent) return;
    try {
      const newChapter = { ...chapterContent, id: Date.now().toString(), savedAt: Date.now(), isCompleted: false };
      // Check for duplicates based on title
      const filtered = savedChapters.filter(c => c.title !== newChapter.title);
      const updated = [newChapter, ...filtered]; // Add new to top
      
      setSavedChapters(updated);
      localStorage.setItem('tablewood_chapters', JSON.stringify(updated));
      
      // Update current view to have the ID so future updates (like lazy images) save to this ID
      setChapterContent(newChapter); 
      alert("Chapter notes saved to your library.");
    } catch (e) {
      console.error(e);
      alert("Failed to save. Your storage might be full.");
    }
  };

  const savePlan = (planToSave?: StudyPlan) => {
    const plan = planToSave || studyPlan;
    if (!plan) return;
    try {
      // Logic: If the plan already has an ID, we update it. If not, we create a new one.
      const isExisting = plan.id && savedPlans.some(p => p.id === plan.id);
      
      const newPlan = { 
        ...plan, 
        id: plan.id || Date.now().toString(), 
        savedAt: plan.savedAt || Date.now(), 
        isActive: plan.isActive || false 
      };
      
      let updated;
      if (isExisting) {
          updated = savedPlans.map(p => p.id === newPlan.id ? newPlan : p);
      } else {
          updated = [newPlan, ...savedPlans];
      }
      
      setSavedPlans(updated);
      localStorage.setItem('tablewood_plans', JSON.stringify(updated));
      
      // CRITICAL: Update the currently active view state if we are viewing this plan.
      if (!planToSave && studyPlan) {
         setStudyPlan(newPlan);
      }
      
      if (!planToSave) alert(isExisting ? "Study plan updated." : "Study plan saved to your library.");
    } catch (e) {
      alert("Failed to save. Storage might be full.");
    }
  };
  
  // Callback for AI Coach to update plan
  const handleAIPlanUpdate = (updatedPlan: StudyPlan) => {
      const activePlan = savedPlans.find(p => p.isActive);
      
      // Determine new title version
      let baseTitle = updatedPlan.title;
      // If we are modifying an existing plan, we want to base the name off that
      if (activePlan) {
          // Strip existing version number if present to find base name
          baseTitle = activePlan.title.replace(/ \(Version \d+\)$/, "");
      }

      // Count how many versions of this plan exist
      const existingVersions = savedPlans.filter(p => p.title.startsWith(baseTitle));
      const nextVersion = existingVersions.length + 1;
      const newTitle = `${baseTitle} (Version ${nextVersion})`;

      // Create a completely NEW plan object (Replica + Modifications)
      const finalPlan: StudyPlan = {
          ...updatedPlan,
          title: newTitle,
          id: Date.now().toString(), // New ID
          isActive: true, // Make the new version active
          savedAt: Date.now()
      };

      // Deactivate the old plan (if any)
      const updatedSavedPlans = savedPlans.map(p => ({
          ...p,
          isActive: false 
      }));

      // Add the new plan to the top of the list
      const finalSavedPlans = [finalPlan, ...updatedSavedPlans];
      
      setSavedPlans(finalSavedPlans);
      localStorage.setItem('tablewood_plans', JSON.stringify(finalSavedPlans));
      
      // Notify user visually through DiscussTab logic (handled there) but we can update state if viewing
      if (appState === AppState.VIEWING_PLAN) {
          setStudyPlan(finalPlan);
      }
  };

  // Callback for AI Coach to save student context
  const handleAISaveContext = (newContext: string) => {
      // Append or Update? We'll append for now with a timestamp logic handled by AI or simple newline
      const updated = studentContext ? `${studentContext}\n- ${newContext}` : `- ${newContext}`;
      setStudentContext(updated);
      localStorage.setItem('tablewood_context', updated);
  };

  const updatePlan = (updatedPlan: StudyPlan) => {
    setStudyPlan(updatedPlan);
    if (updatedPlan.id) {
       const updatedList = savedPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p);
       setSavedPlans(updatedList);
       localStorage.setItem('tablewood_plans', JSON.stringify(updatedList));
    }
  };

  // --- Management Handlers (Delete, Complete, Activate) ---

  const deleteChapter = (e: React.MouseEvent, id: string | undefined) => {
      e.preventDefault(); 
      e.stopPropagation(); 
      
      if (!id) {
          alert("Cannot delete this item (Missing ID).");
          return;
      }

      if (!window.confirm("Are you sure you want to delete these notes?")) return;
      
      const updated = savedChapters.filter(c => c.id !== id);
      setSavedChapters(updated);
      localStorage.setItem('tablewood_chapters', JSON.stringify(updated));
  };

  const deletePlan = (e: React.MouseEvent, id: string | undefined) => {
      e.preventDefault(); 
      e.stopPropagation();

      if (!id) {
          alert("Cannot delete this item (Missing ID).");
          return;
      }
      
      if (!window.confirm("Are you sure you want to delete this plan?")) return;
      
      const updated = savedPlans.filter(p => p.id !== id);
      setSavedPlans(updated);
      localStorage.setItem('tablewood_plans', JSON.stringify(updated));
  };

  const toggleChapterCompletion = (chapter: ChapterContent) => {
      const updatedChapter = { ...chapter, isCompleted: !chapter.isCompleted };
      handleContentUpdate(updatedChapter); // Updates state and storage
  };

  const togglePlanActive = (plan: StudyPlan) => {
      const isActivating = !plan.isActive;
      
      const updatedList = savedPlans.map(p => {
          if (p.id === plan.id) {
              return { ...p, isActive: isActivating };
          }
          // If activating one, deactivate others
          if (isActivating) {
              return { ...p, isActive: false };
          }
          return p;
      });
      
      setSavedPlans(updatedList);
      localStorage.setItem('tablewood_plans', JSON.stringify(updatedList));

      // Update current view if it's the same plan
      const updatedPlan = updatedList.find(p => p.id === plan.id);
      if (studyPlan && studyPlan.id === plan.id && updatedPlan) {
          setStudyPlan(updatedPlan);
      }
  };


  const openSavedChapter = (chapter: ChapterContent) => {
    setChapterContent(chapter);
    setAppState(AppState.READING_CHAPTER);
  };

  const openSavedPlan = (plan: StudyPlan) => {
    setStudyPlan(plan);
    setAppState(AppState.VIEWING_PLAN);
  };

  // --- Context Formatting Helpers for Live Assistant ---
  
  const formatChapterForContext = (c: ChapterContent) => {
    try {
      return `
      CHAPTER NOTES: ${c.title}
      STATUS: ${c.isCompleted ? "COMPLETED" : "IN PROGRESS"}
      INTRO: ${c.intro}
      STRATEGY: ${c.strategy}
      SUBTOPICS: ${c.subtopics.map(s => s.title).join(', ')}
      `;
    } catch (e) {
      return JSON.stringify(c);
    }
  };

  const formatPlanForContext = (p: StudyPlan) => {
    try {
       return `
       STUDY PLAN: ${p.title}
       STATUS: ${p.isActive ? "ACTIVE PLAN" : "INACTIVE"}
       OVERVIEW: ${p.overview}
       `;
    } catch (e) {
      return JSON.stringify(p);
    }
  };

  // --- Render Helpers ---

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-stone-900 text-stone-50 transition-colors duration-700">
       <div className="relative mb-12">
          {/* Outer Ring */}
          <div className="w-32 h-32 rounded-full border border-stone-800 flex items-center justify-center relative">
             <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-emerald-500 animate-spin"></div>
             {/* Time Display */}
             <div className="flex flex-col items-center justify-center">
                <span className="text-4xl font-mono font-bold text-white">{estimatedTime}s</span>
                <span className="text-[10px] text-emerald-500 uppercase tracking-widest mt-1">Remaining</span>
             </div>
          </div>
       </div>

       <h3 className="text-2xl font-light serif italic animate-pulse text-center mb-3">{loadingMsg}</h3>
       <p className="text-stone-500 text-xs max-w-md text-center uppercase tracking-widest border-t border-stone-800 pt-4 mt-2">
         Processing complex reasoning tasks
       </p>
       
       <div className="mt-12 absolute bottom-6 w-full px-6">
         <Disclaimer dark={true} />
       </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-stone-900 bg-stone-50 selection:bg-emerald-200 flex flex-col">
      
      {appState === AppState.ONBOARDING && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {appState === AppState.DASHBOARD && profile && (
        <div className="flex flex-col items-center min-h-screen p-6 animate-fade-in relative overflow-hidden">
          <header className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
            <h1 className="text-2xl brand-font font-bold text-stone-800 tracking-wider">TABLEWOOD</h1>
            <p className="text-xs text-stone-400 uppercase tracking-widest mt-1">
              {profile.examName} • {profile.country}
            </p>
          </header>

          <div className="w-full max-w-2xl mt-20 md:mt-32 relative z-10 flex-grow">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 serif text-stone-800">Study Hall</h2>
            <p className="text-center text-stone-500 mb-12 text-lg">Choose your path to mastery.</p>
            
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-stone-100 mb-8">
                <h3 className="font-bold text-stone-900 mb-2 flex items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                    One-Shot Mastery
                </h3>
                <p className="text-sm text-stone-500 mb-6">Deep dive into a specific chapter. Attach text or images for context.</p>
                <form onSubmit={handleGenerateChapter} className="space-y-6">
                  <input
                    type="text"
                    value={chapterInput}
                    onChange={(e) => setChapterInput(e.target.value)}
                    placeholder="Enter Chapter Name (e.g. Thermodynamics)"
                    className="w-full p-4 text-lg bg-stone-50 rounded-lg border border-stone-200 focus:border-stone-800 outline-none transition-colors"
                  />
                  <div className="flex items-center gap-2">
                     <label className="cursor-pointer flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors bg-stone-100 px-3 py-2 rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                        Upload Docs/Images
                        <input type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
                     </label>
                     {chapterAttachments.length > 0 && (
                        <span className="text-xs text-emerald-600 font-bold">{chapterAttachments.length} file(s) attached</span>
                     )}
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-stone-900 text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-emerald-900 transition-colors shadow-lg"
                  >
                    Start Mastery Session
                  </button>
                </form>
            </div>

            <button 
                onClick={() => setAppState(AppState.WIZARD_PLAN)}
                className="w-full group bg-gradient-to-r from-stone-100 to-white p-6 rounded-2xl border border-stone-200 hover:border-emerald-300 transition-all duration-300 shadow-sm hover:shadow-lg flex items-center justify-between"
            >
                <div className="text-left">
                    <h3 className="font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">Generate Comprehensive Study Plan</h3>
                    <p className="text-sm text-stone-500">Get a personalized roadmap, weekly schedules, and revision strategy.</p>
                </div>
                <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow text-stone-400 group-hover:text-emerald-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                </div>
            </button>
          </div>

          {/* Lower Section: Library / Discuss */}
          <div className="w-full max-w-4xl mt-12 mb-12 border-t border-stone-200 pt-8">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                {/* Main Toggle: Library vs Discuss */}
                <div className="flex gap-6 mb-4 md:mb-0">
                    <button 
                        onClick={() => setDashboardTab('library')}
                        className={`text-lg font-bold uppercase tracking-widest transition-colors ${dashboardTab === 'library' ? 'text-stone-900 border-b-2 border-stone-900 pb-1' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Your Library
                    </button>
                    <button 
                        onClick={() => setDashboardTab('discuss')}
                        className={`text-lg font-bold uppercase tracking-widest transition-colors ${dashboardTab === 'discuss' ? 'text-stone-900 border-b-2 border-stone-900 pb-1' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Discuss
                    </button>
                </div>
             </div>
             
             {dashboardTab === 'library' && (
                <div className="animate-fade-in">
                    {/* Sub Toggle: Chapters vs Plans */}
                    <div className="bg-stone-200 p-1 rounded-lg flex shadow-inner w-fit mb-6">
                        <button 
                            onClick={() => setSavedResourceView('chapters')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${savedResourceView === 'chapters' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            Chapter Notes
                        </button>
                        <button 
                            onClick={() => setSavedResourceView('plans')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${savedResourceView === 'plans' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            Study Plans
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedResourceView === 'chapters' ? (
                        savedChapters.length === 0 ? (
                            <p className="col-span-2 text-center text-stone-400 italic py-8">No saved chapters yet. Start mastering topics!</p>
                        ) : (
                            savedChapters.map((chapter) => (
                                <div key={chapter.id} title={chapter.title} onClick={() => openSavedChapter(chapter)} className={`bg-white p-4 rounded-lg border hover:shadow-md cursor-pointer transition-all group relative overflow-hidden ${chapter.isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-stone-200 hover:border-emerald-400'}`}>
                                {chapter.isCompleted && (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase px-2 py-1 rounded-bl">Completed</div>
                                )}
                                <h4 className="font-serif font-bold text-stone-800 group-hover:text-emerald-800 truncate pr-8">
                                        <ReactMarkdown 
                                            components={{p: ({node, ...props}) => <span {...props}/>}} 
                                            remarkPlugins={[remarkMath]} 
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {chapter.title}
                                        </ReactMarkdown>
                                </h4>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] uppercase tracking-widest text-stone-400">
                                    {new Date(chapter.savedAt || 0).toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleChapterCompletion(chapter); }}
                                            className={`p-1 rounded hover:bg-stone-100 transition-colors ${chapter.isCompleted ? 'text-emerald-600' : 'text-stone-300'}`}
                                            title={chapter.isCompleted ? "Mark Incomplete" : "Mark Complete"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={(e) => deleteChapter(e, chapter.id)}
                                            className="p-1 text-stone-300 hover:text-red-500 hover:bg-stone-100 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                </div>
                            ))
                        )
                        ) : (
                        savedPlans.length === 0 ? (
                            <p className="col-span-2 text-center text-stone-400 italic py-8">No saved study plans. Create your blueprint today.</p>
                        ) : (
                            savedPlans.map((plan) => (
                                <div key={plan.id} title={plan.title} onClick={() => openSavedPlan(plan)} className={`bg-white p-4 rounded-lg border hover:shadow-md cursor-pointer transition-all group relative overflow-hidden ${plan.isActive ? 'border-emerald-500 shadow-md' : 'border-stone-200 hover:border-emerald-400'}`}>
                                {plan.isActive && (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase px-2 py-1 rounded-bl">Active Plan</div>
                                )}
                                <h4 className="font-serif font-bold text-stone-800 group-hover:text-emerald-800 truncate pr-16">
                                        <ReactMarkdown 
                                            components={{p: ({node, ...props}) => <span {...props}/>}} 
                                            remarkPlugins={[remarkMath]} 
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {plan.title}
                                        </ReactMarkdown>
                                </h4>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] uppercase tracking-widest text-stone-400">
                                    {new Date(plan.savedAt || 0).toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); togglePlanActive(plan); }}
                                            className={`p-1 rounded hover:bg-stone-100 transition-colors ${plan.isActive ? 'text-emerald-600' : 'text-stone-300'}`}
                                            title={plan.isActive ? "Deactivate" : "Set as Active Plan"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={(e) => deletePlan(e, plan.id)}
                                            className="p-1 text-stone-300 hover:text-red-500 hover:bg-stone-100 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                </div>
                            ))
                        )
                        )}
                    </div>
                </div>
             )}

             {dashboardTab === 'discuss' && (
                 <div className="animate-fade-in">
                     <DiscussTab 
                        profile={profile}
                        activePlan={savedPlans.find(p => p.isActive) || null}
                        completedChapters={savedChapters.filter(c => c.isCompleted)}
                        onUpdatePlan={handleAIPlanUpdate}
                        onSaveContext={handleAISaveContext}
                        studentContext={studentContext}
                        chatHistory={chatHistory}
                        setChatHistory={setChatHistory}
                     />
                 </div>
             )}
          </div>
          <Disclaimer />
        </div>
      )}

      {(appState === AppState.GENERATING_CHAPTER || appState === AppState.GENERATING_PLAN) && renderLoading()}

      {appState === AppState.READING_CHAPTER && chapterContent && profile && (
        <>
          <ChapterView 
            content={chapterContent} 
            onBack={() => {
              setAppState(AppState.DASHBOARD);
              setChapterInput('');
              setChapterAttachments([]);
            }}
            onSave={saveChapter}
            onUpdateContent={handleContentUpdate}
            onToggleComplete={() => toggleChapterCompletion(chapterContent)}
          />
          <LiveAssistant 
            profile={profile} 
            contextData={formatChapterForContext(chapterContent)}
          />
        </>
      )}

      {(appState === AppState.WIZARD_PLAN || appState === AppState.VIEWING_PLAN) && (
          <StudyPlanWizard
            onSubmit={handleGeneratePlan}
            plan={studyPlan}
            onBack={() => {
                setAppState(AppState.DASHBOARD);
                setStudyPlan(null);
            }}
            onSave={() => savePlan()}
            onUpdatePlan={updatePlan}
            onToggleActive={studyPlan ? () => togglePlanActive(studyPlan) : undefined}
          />
      )}

      {appState === AppState.VIEWING_PLAN && studyPlan && profile && (
          <LiveAssistant
             profile={profile}
             contextData={formatPlanForContext(studyPlan)}
          />
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 1s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default App;