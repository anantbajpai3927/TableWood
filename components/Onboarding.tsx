import React, { useState } from 'react';
import { UserProfile } from '../types';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [profile, setProfile] = useState<UserProfile>({
    examName: '',
    targetScore: '',
    country: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.examName && profile.targetScore && profile.country) {
      onComplete(profile);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6">
      <div className="w-full max-w-md bg-white p-10 rounded-xl shadow-2xl border border-stone-200">
        <h1 className="text-4xl text-center mb-2 brand-font text-stone-800">TABLEWOOD</h1>
        <p className="text-center text-stone-500 mb-8 italic serif">Elite Exam Preparation</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Exam Name</label>
            <input 
              type="text" 
              value={profile.examName}
              onChange={(e) => setProfile({...profile, examName: e.target.value})}
              placeholder="e.g. JEE Advanced, SAT, MCAT"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-stone-800 outline-none py-2 px-1 transition-colors duration-300 placeholder-stone-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Target Score/Rank</label>
            <input 
              type="text" 
              value={profile.targetScore}
              onChange={(e) => setProfile({...profile, targetScore: e.target.value})}
              placeholder="e.g. Top 100, 1500+"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-stone-800 outline-none py-2 px-1 transition-colors duration-300 placeholder-stone-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Country</label>
            <input 
              type="text" 
              value={profile.country}
              onChange={(e) => setProfile({...profile, country: e.target.value})}
              placeholder="e.g. India, USA"
              className="w-full bg-stone-50 border-b-2 border-stone-200 focus:border-stone-800 outline-none py-2 px-1 transition-colors duration-300 placeholder-stone-400"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full mt-8 bg-stone-900 text-stone-50 py-4 font-semibold uppercase tracking-widest hover:bg-emerald-900 transition-colors duration-500 shadow-lg"
          >
            Enter Study Hall
          </button>
        </form>
      </div>

      <div className="mt-12 text-center max-w-lg">
         <p className="text-[9px] text-stone-400 uppercase tracking-wider leading-relaxed opacity-70">
            Disclaimer: This app is a hackathon prototype and demo version, not a real full app. Powered by Google Gemini API. Content is AI-generated and may be inaccurate or misleading; please verify independently. 
            TableWood does not guarantee or assure specific exam results or target achievement. 
            The developer accepts no liability for content errors or usage outcomes.
         </p>
      </div>
    </div>
  );
};

export default Onboarding;