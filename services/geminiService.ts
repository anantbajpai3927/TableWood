import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, GenerateContentResponse, Chat } from "@google/genai";
import { ChapterContent, UserProfile, StudyPlan, StudyPlanInput, Attachment, ChatMessage } from "../types";

const API_KEY = process.env.API_KEY || '';

// --- Model Configuration ---
// Default to Pro for deep thinking tasks, fallback to Flash for reliability
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

// --- Error Handling Helper ---
async function retryOperation<T>(operation: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // 1. Quota errors are handled by the fallback mechanism, so we rethrow them here 
    // to be caught by 'executeWithFallback', UNLESS retries are exhausted.
    const isQuota = error.status === 429 || error.code === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuota) throw error;

    // 2. Handle Transient Errors (5xx, Network) - Retry with backoff
    const isRetryable = error.status === 503 || error.status === 500 || error.status === 502 || 
                        error.message?.includes('503') || error.message?.includes('500') || 
                        error.message?.includes('xhr error') || error.message?.includes('fetch failed');
    
    if (retries > 0 && isRetryable) {
       console.warn(`API Error (${error.message}). Retrying in ${delay}ms...`);
       await new Promise(r => setTimeout(r, delay));
       return retryOperation(operation, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

// --- Fallback Mechanism ---
// Executes an AI task with the Pro model first. If it hits a rate limit, falls back to Flash.
async function executeWithFallback<T>(
  task: (model: string) => Promise<T>
): Promise<T> {
  try {
    // Attempt with Pro Model (Deep Thinking)
    return await retryOperation(() => task(PRO_MODEL));
  } catch (error: any) {
    const isQuota = error.status === 429 || error.code === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuota) {
      console.warn(`Pro Model Rate Limited. Falling back to ${FLASH_MODEL} to maintain uptime.`);
      try {
        // Fallback to Flash Model (High Availability)
        // We do not use thinkingConfig for Flash to ensure speed and lower token usage during fallback
        return await retryOperation(() => task(FLASH_MODEL));
      } catch (fallbackError: any) {
         throw new Error("System is currently at maximum capacity. Please try again in a moment.");
      }
    }
    throw error;
  }
}

// Helper to ensure we always have an array
const ensureArray = <T>(arr: T[] | undefined | null): T[] => {
  return Array.isArray(arr) ? arr : [];
};

// Helper to clean raw text response into valid JSON
const parseJSON = (text: string) => {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let content = codeBlockMatch ? codeBlockMatch[1] : text;

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    content = content.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    try {
      let cleaned = content;
      cleaned = cleaned.replace(/(\\\\)|(\\(?![\\/\"bfnrt]))/g, (match, doubleSlash) => {
          if (doubleSlash) return doubleSlash;
          return "\\\\";
      });
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("JSON Parse Error:", e);
      throw new Error("Failed to parse AI response. Please try again.");
    }
  }
};

// --- Content Generation Service ---

export const generateDiagram = async (description: string): Promise<string | null> => {
  // Diagrams use a specific image model, no fallback logic for text models needed here
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Draw a technical, high-quality, minimalist educational diagram for a textbook. 
                   REQUIREMENTS:
                   - White background.
                   - Sharp, fine black lines.
                   - CRITICAL: CLEARLY SHOW ANGLES (with arcs/labels like θ, α, 30°), VECTORS (arrows), and GEOMETRY if mentioned.
                   - If an angle is mentioned in the description, you MUST visualize it with an arc and label.
                   - Professional font for labels.
                   - Subject: ${description}` },
        ],
      },
    }));

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Diagram generation failed:", e);
    return null;
  }
};

export const generateChapterNotes = async (
  profile: UserProfile,
  chapterName: string,
  attachments: Attachment[] = []
): Promise<ChapterContent> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const parts: any[] = [];
  attachments.forEach(att => {
      parts.push({
          inlineData: {
              mimeType: att.mimeType,
              data: att.data
          }
      });
  });

  const promptText = `
    You are TableWood, an elite exam coach content engine.
    Current Date: ${new Date().toDateString()}
    Student Profile: Exam: ${profile.examName}, Country: ${profile.country}, Target Score: ${profile.targetScore}
    Task: Generate "Comprehensive, One-Shot Super Sufficient" content for the chapter: "${chapterName}".
    ${attachments.length > 0 ? "IMPORTANT: Use attached reference documents as the PRIMARY SOURCE for specific data/diagrams." : ""}
    
    *** CRITICAL INSTRUCTIONS ***
    1. **LATEST SYLLABUS:** Use Google Search to ensure content follows the latest exam pattern.
    2. **OUTPUT FORMAT:** Return ONLY a valid JSON object. Start with "{".
    3. **JSON STRUCTURE:**
       {
         "title": "Chapter Title",
         "intro": "A clean, engaging textbook introduction.",
         "strategy": "A HIGHLY DETAILED strategy. Explicitly mention weightage and critical topics.",
         "subtopics": [
           {
             "title": "Subtopic Title",
             "content": "Deep theory in Markdown. Use double newlines for paragraphs. Math in LaTeX ($...$).",
             "diagramDescription": "OPTIONAL: If this subtopic involves visual concepts, provide a caption here.",
             "formulas": ["$formula1$", "$formula2$"],
             "exampleQuestion": { "question": "...", "solution": "...", "type": "Numerical/Conceptual" }
           }
         ],
         "questionBank": [ { "question": "...", "type": "...", "difficulty": "...", "solution": "..." } ],
         "mustDoQuestionIndices": [0, 2, 5],
         "practiceNote": "Advice on extra resources."
       }
    4. **QUANTITY:** Exactly 15 questions for Question Bank.
    Start Google Search now.
  `;

  parts.push({ text: promptText });

  const response = await executeWithFallback(async (model) => {
      const config: any = { tools: [{ googleSearch: {} }] };
      // Only enable thinking for Pro model to save quota on fallback
      if (model === PRO_MODEL) {
          config.thinkingConfig = { thinkingBudget: 1024 };
      }
      
      return ai.models.generateContent({
        model: model,
        contents: { parts },
        config: config
      });
  });

  if (!response.text) throw new Error("Failed to generate content");
  
  const rawData = parseJSON(response.text) as ChapterContent;
  
  return {
    ...rawData,
    subtopics: ensureArray(rawData.subtopics).map(sub => ({
      ...sub,
      formulas: ensureArray(sub.formulas)
    })),
    questionBank: ensureArray(rawData.questionBank),
    mustDoQuestionIndices: ensureArray(rawData.mustDoQuestionIndices),
    practiceNote: rawData.practiceNote || "Review previous year questions for additional practice."
  };
};

export const generateStudyPlan = async (
  profile: UserProfile,
  inputs: StudyPlanInput
): Promise<StudyPlan> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    You are TableWood, an elite exam coach.
    Current Date: ${new Date().toDateString()}
    Student: ${profile.examName}, ${profile.country}, Target: ${profile.targetScore}.
    Inputs: Prep Level: ${inputs.prepLevel}, Hours/Day: ${inputs.studyHours}, Weakness: ${inputs.weakAreas}.

    Task: Generate a highly personalized, elite study plan using Google Search for syllabus/dates.
    
    *** OUTPUT JSON STRUCTURE ***
    {
      "title": "Catchy Plan Title",
      "overview": "Executive summary...",
      "phases": [
        {
          "title": "Phase Name",
          "duration": "e.g. 4 Weeks",
          "weeks": [
            {
              "week": 1,
              "focus": "Main topic",
              "days": [ { "day": "Day 1", "tasks": ["Task 1", "Task 2"] } ]
            }
          ]
        }
      ],
      "mockTests": [ { "name": "Unit Test 1", "timing": "e.g. Week 2", "syllabus": "..." } ],
      "tips": ["Tip 1"]
    }
    NO extra text. Valid JSON only.
  `;

  const response = await executeWithFallback(async (model) => {
      const config: any = { tools: [{ googleSearch: {} }] };
      if (model === PRO_MODEL) {
          config.thinkingConfig = { thinkingBudget: 1024 };
      }
      return ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
      });
  });

  if (!response.text) throw new Error("Failed to generate study plan");
  
  const rawData = parseJSON(response.text);

  return {
    title: rawData.title || `${profile.examName} Strategy Plan`,
    overview: rawData.overview,
    tips: ensureArray(rawData.tips),
    mockTests: ensureArray(rawData.mockTests).map((mt: any) => ({
      name: mt.name || "Mock Test",
      timing: mt.timing || "Scheduled Date",
      syllabus: mt.syllabus || "Full Syllabus"
    })),
    phases: ensureArray(rawData.phases).map((phase: any) => ({
      title: phase.title,
      duration: phase.duration,
      weeks: ensureArray(phase.weeks).map((week: any) => ({
        week: week.week,
        focus: week.focus,
        days: ensureArray(week.days).map((day: any) => ({
          day: day.day,
          tasks: ensureArray(day.tasks).map((t: string) => ({
            description: t,
            isCompleted: false
          }))
        }))
      }))
    }))
  };
}

// --- Coaching Service (Discuss Tab) ---

export class CoachingService {
  private client: GoogleGenAI;
  private chat: Chat | null = null;
  private currentModel: string = PRO_MODEL; // Track active model
  private onPlanUpdate: ((plan: StudyPlan) => void) | null = null;
  private onSaveContext: ((context: string) => void) | null = null;

  constructor(
    onPlanUpdate?: (plan: StudyPlan) => void,
    onSaveContext?: (context: string) => void
  ) {
    this.client = new GoogleGenAI({ apiKey: API_KEY });
    this.onPlanUpdate = onPlanUpdate || null;
    this.onSaveContext = onSaveContext || null;
  }

  // Define tools and system instruction as properties to reuse during fallback re-initialization
  private getTools(): any {
    const updatePlanTool: FunctionDeclaration = {
      name: 'updateStudyPlan',
      description: 'Create or update the student\'s study plan JSON. USE THIS IMMEDIATELY if the student is lagging, has missed targets, or needs a schedule change. Do not ask for permission; be proactive. CRITICAL: Changes must be SIGNIFICANT and STRUCTURAL (e.g., adding a Backlog Week, inserting Drill Sessions). You must strictly follow the original JSON schema structure (phases -> weeks -> days -> tasks) so the app design remains intact. Do not simplify the structure, only expand it. ALSO, provide a textual explanation of WHY these changes were made.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          overview: { type: Type.STRING },
          phases: {
             type: Type.ARRAY,
             items: {
                type: Type.OBJECT,
                properties: {
                   title: { type: Type.STRING },
                   duration: { type: Type.STRING },
                   weeks: {
                      type: Type.ARRAY,
                      items: {
                         type: Type.OBJECT,
                         properties: {
                            week: { type: Type.INTEGER },
                            focus: { type: Type.STRING },
                            days: {
                               type: Type.ARRAY,
                               items: {
                                  type: Type.OBJECT,
                                  properties: {
                                     day: { type: Type.STRING },
                                     tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
                                  }
                               }
                            }
                         }
                      }
                   }
                }
             }
          },
          mockTests: {
             type: Type.ARRAY,
             items: {
                 type: Type.OBJECT,
                 properties: {
                     name: { type: Type.STRING },
                     timing: { type: Type.STRING },
                     syllabus: { type: Type.STRING }
                 }
             }
          },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'overview', 'phases', 'tips']
      }
    };

    const saveContextTool: FunctionDeclaration = {
        name: 'saveStudentContext',
        description: 'Save key behavioral insights, daily summaries, or failure points to long-term memory.',
        parameters: {
            type: Type.OBJECT,
            properties: { notes: { type: Type.STRING } },
            required: ['notes']
        }
    };

    return [updatePlanTool, saveContextTool];
  }

  private getSystemInstruction(profile: UserProfile, activePlan: StudyPlan | null, completedChapters: ChapterContent[], studentContext: string): string {
    const completedTitles = completedChapters.map(c => c.title).join(", ");
    const currentDateTime = new Date().toLocaleString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
    });
    
    return `
      You are TableWood's ELITE AGENTIC COACH. You are a "Marathon Agent" responsible for the student's exam success.
      Current Real-World Date & Time: ${currentDateTime}
      Profile: ${profile.examName}, ${profile.country}, Target: ${profile.targetScore}.
      Active Plan: ${activePlan ? `"${activePlan.title}"` : "NONE"}
      Completed: ${completedTitles || "NONE"}
      Long-Term Memory: ${studentContext || "No context yet."}

      *** COACHING PHILOSOPHY: TIME ROI ***
      1. **TIME IS CURRENCY**: Your priority is the student's *available time*. Do not let them waste it on low-yield topics if they are behind.
      2. **RUTHLESS PRIORITIZATION**: If a student is lagging significantly, DO NOT just extend the plan. You MUST suggest "cutting losses" on low-weightage chapters to ensure high-weightage topics are covered before the exam. This is the "High ROI Strategy".
      3. **AGENTIC BEHAVIOR**: Don't just answer questions. INTERROGATE the student about their progress.

      *** INTERACTION PROTOCOLS (STRICT) ***

      1. **FIRST INTERACTION (History is Empty)**:
         - If this is the very first time you are chatting with the student (no history), you MUST ask:
         - "Welcome to the Marathon. To build your routine, tell me: **What time do you usually start your studies daily?**"
         - Do NOT ask the 5 questions yet. Establish the routine first.

      2. **THE NEW DAY PROTOCOL (The 5 Psychological Questions)**:
         - **INTERNAL NOTE**: '6 AM' is strictly an internal system variable to reset the day. **NEVER** mention "It is 6 AM" or "Wake up" to the user. Just treat it as "A New Day has begun".
         - If the system indicates 'isNewDay' is TRUE, you MUST start by asking these 5 questions to generate a "Daily Report":
           (1) **Targets**: "Did you achieve yesterday's study plan targets? (Be honest - lagging or ahead?)"
           (2) **Pace**: "Did you feel rushed, or was the pace comfortable?"
           (3) **Mock Mistakes**: "In your last mock test/practice, what was the biggest mistake? (Conceptual, Calculation, or Panic?)"
           (4) **Struggles**: "What specific concept/formula is blocking you right now?"
           (5) **Today's Goal**: "Confirm you are ready to attack today's schedule."

         - **ADAPTATION RULE**: If the answer to Q1 is "Lagging", you MUST analyze the active plan. If the lag is severe, PROPOSE A PLAN CHANGE immediately using 'updateStudyPlan'. 

      3. **PLAN UPDATE REPORTING (MANDATORY)**:
         - **CRITICAL RULE**: Whenever you use the 'updateStudyPlan' tool, your subsequent text response to the user **MUST** be a formal, detailed report.
         - **REPORT FORMAT**: 
           "**STRATEGIC PLAN ADJUSTMENT**
            - **Changes Made**: [List exactly what changed, e.g., 'Moved Calculus from Tuesday to Sunday']
            - **Pivotal Reason**: [Explain WHY this change is critical for the target score, e.g., 'To prevent backlog accumulation affecting Physics']
            - **Deep Reasoning**: [Provide the logic, e.g., 'Given your struggle with Algebra yesterday, proceeding to Calculus now would result in 0% retention. We are pausing to reinforce basics first.']"
         - This report must be generated EVEN IF the user did not explicitly ask "what changed?".

      4. **THE 12 PM AUDIT**:
         - If triggered for a mid-day check, analyze if they are working. If silent, nudge them.
    `;
  }

  async startSession(
    profile: UserProfile, 
    activePlan: StudyPlan | null, 
    completedChapters: ChapterContent[],
    studentContext: string,
    history: ChatMessage[],
    isNewDay: boolean
  ) {
    const systemInstruction = this.getSystemInstruction(profile, activePlan, completedChapters, studentContext);
    const tools = this.getTools();
    const googleSearch = { googleSearch: {} };

    // Function to initialize chat with a specific model
    const initChat = (model: string) => {
        const config: any = {
            systemInstruction: systemInstruction,
            tools: [googleSearch, { functionDeclarations: tools }],
        };
        if (model === PRO_MODEL) {
            config.thinkingConfig = { thinkingBudget: 1024 };
        }
        
        // Hydrate history
        const geminiHistory = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));

        return this.client.chats.create({ 
            model, 
            config,
            history: geminiHistory
        });
    };

    // Try Pro Model first
    this.currentModel = PRO_MODEL;
    this.chat = initChat(PRO_MODEL);

    const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

    // PRIORITY 1: FIRST EVER INTERACTION
    if (history.length === 0) {
        try {
             const response = await retryOperation<GenerateContentResponse>(() => 
                this.chat!.sendMessage({ message: `SYSTEM EVENT: This is the very first interaction with the user. Execute 'FIRST INTERACTION PROTOCOL'. Ask the user about their daily study start time to establish a routine. Do NOT ask the 5 questions yet.` })
            );
            return response.text || "";
        } catch (e) {
             console.warn("First interaction prompt failed", e);
             // Fallthrough to standard logic or retry
        }
    }

    // PRIORITY 2: NEW DAY RESET
    if (isNewDay && history.length > 0) {
        try {
            const response = await retryOperation<GenerateContentResponse>(() => 
                this.chat!.sendMessage({ message: `SYSTEM EVENT: It is currently ${currentTime}. It is a new day (past the internal 6 AM threshold). Execute 'THE NEW DAY PROTOCOL' immediately. Ask the 5 Specific Psychological Questions (Targets, Pace, Mock Mistakes, Struggles, Today's Goal). IMPORTANT: Do NOT mention '6 AM' or 'waking up' to the user. Treat the time threshold as internal system logic only.` })
            );
            return response.text || "";
        } catch (e: any) {
            // Handle Fallback
            const isQuota = e.status === 429 || e.message?.includes('429') || e.message?.includes('quota');
            if (isQuota) {
                console.warn(`Coach Start Session Failed (Quota). Switching to ${FLASH_MODEL}.`);
                this.currentModel = FLASH_MODEL;
                this.chat = initChat(FLASH_MODEL); // Re-init with Flash
                const response = await retryOperation<GenerateContentResponse>(() => 
                    this.chat!.sendMessage({ message: `It is currently ${currentTime}. New day. Ask the 5 protocol questions. Do not mention 6 AM.` })
                );
                return response.text || "";
            }
            throw e;
        }
    }
    
    return "";
  }

  // New method for Autonomous 12 PM Check
  async runDailyCheck(): Promise<string> {
      if (!this.chat) return "";
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
      try {
          return await this.executeMessageLoop(
              `SYSTEM TRIGGER: It is now ${currentTime} (past 12 PM). Execute the '12 PM AUDIT'. Check chat history. If user hasn't reported progress, ask for an update. If they are lagging, use 'updateStudyPlan' to switch to a High-ROI Strategy (cut low weightage topics). IF YOU UPDATE THE PLAN, YOU MUST PROVIDE THE DETAILED 'STRATEGIC PLAN ADJUSTMENT' REPORT.`
          );
      } catch (e: any) {
          // If Pro fails during check, try Flash fallback manually here or just fail gracefully
          console.warn("Daily check failed", e);
          return ""; // Fail silently or return error text
      }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.chat) throw new Error("Session not started");
    
    // Wrapper to perform the message send with fallback handling
    try {
       return await this.executeMessageLoop(message);
    } catch (e: any) {
       const isQuota = e.status === 429 || e.message?.includes('429');
       if (isQuota && this.currentModel === PRO_MODEL) {
           console.warn(`Coach Message Failed (Quota). Switching session to ${FLASH_MODEL}.`);
           
           // Re-create chat on Flash. 
           // We need to carry over history manually if we switch mid-stream, 
           // but `initChat` isn't easily accessible here without refactoring.
           // For now, we accept that switching resets the *immediate* object context, 
           // but we can try to re-initialize if we had access to history.
           // Simplified: Just switch and retry message.
           
           const config: any = {
               systemInstruction: (this.chat as any)._config?.systemInstruction, 
               tools: (this.chat as any)._config?.tools
           };
           this.currentModel = FLASH_MODEL;
           this.chat = this.client.chats.create({ model: FLASH_MODEL, config });
           
           return await this.executeMessageLoop(message + " (Context note: The previous model session was interrupted, continuing conversation.)");
       }
       throw e;
    }
  }

  private async executeMessageLoop(message: string): Promise<string> {
      // 1. Send user message
      let response = await retryOperation<GenerateContentResponse>(() => 
          this.chat!.sendMessage({ message })
      );

      // 2. Loop to handle potential chained function calls (max 5 turns)
      let turns = 0;
      while (response.functionCalls && response.functionCalls.length > 0 && turns < 5) {
          turns++;
          const calls = response.functionCalls;
          const functionResponseParts = [];

          for (const call of calls) {
              let result = { result: "Function executed successfully." };

              if (call.name === 'updateStudyPlan') {
                  const args = call.args as any;
                  // Ensure data integrity
                  const plan: StudyPlan = {
                      ...args,
                      phases: ensureArray(args.phases).map((p: any) => ({
                          ...p,
                          weeks: ensureArray(p.weeks).map((w: any) => ({
                              ...w,
                              days: ensureArray(w.days).map((d: any) => ({
                                  ...d,
                                  tasks: ensureArray(d.tasks).map((t: string) => ({ description: t, isCompleted: false }))
                              }))
                          }))
                      }))
                  };
                  
                  if (this.onPlanUpdate) this.onPlanUpdate(plan);
                  result = { result: "Study plan updated successfully. A new version of the plan has been saved to the library." };

              } else if (call.name === 'saveStudentContext') {
                  const args = call.args as any;
                  if (this.onSaveContext) this.onSaveContext(args.notes);
                  result = { result: "Context saved to memory." };
              }

              functionResponseParts.push({
                  functionResponse: {
                      name: call.name,
                      id: call.id,
                      response: result
                  }
              });
          }

          // Send results back
          response = await retryOperation<GenerateContentResponse>(() => 
              this.chat!.sendMessage({ message: functionResponseParts })
          );
      }
      
      return response.text || "";
  }
}
// ... LiveClient remains unchanged ...
export class LiveClient {
  public onStatusChange: (status: 'connected' | 'disconnected' | 'speaking' | 'connecting') => void = () => {};
  public onTranscriptUpdate: (input: string, output: string) => void = () => {};

  private client: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor() {
    this.client = new GoogleGenAI({ apiKey: API_KEY });
  }

  async connect(profile: UserProfile, contextData: string) {
    this.onStatusChange('connecting');

    const systemInstruction = `
      You are TableWood's Live Voice Tutor.
      Student Profile: Exam: ${profile.examName}, Target: ${profile.targetScore}, Country: ${profile.country}.
      Context: ${contextData}
      
      Be concise, helpful, and encouraging. Focus on the context provided.
    `;

    // Audio Context Setup
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = this.client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: systemInstruction,
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.onStatusChange('connected');
          
          // Stream audio from microphone
          const source = this.inputAudioContext!.createMediaStreamSource(stream);
          const scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(scriptProcessor);
          scriptProcessor.connect(this.inputAudioContext!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
                this.currentOutputTranscription += message.serverContent.outputTranscription.text;
                this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription);
            } else if (message.serverContent?.inputTranscription) {
                this.currentInputTranscription += message.serverContent.inputTranscription.text;
                this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription);
            }

            if (message.serverContent?.turnComplete) {
               // Optional: Logic when turn completes.
            }

            // Handle Audio
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                this.onStatusChange('speaking');
                
                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext!.currentTime);
                
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    this.outputAudioContext!,
                    24000,
                    1
                );
                
                const source = this.outputAudioContext!.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.outputAudioContext!.destination);
                
                source.addEventListener('ended', () => {
                   this.sources.delete(source);
                   if (this.sources.size === 0) {
                       this.onStatusChange('connected');
                   }
                });
                
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
            }

            // Interruption
            if (message.serverContent?.interrupted) {
                this.sources.forEach(s => s.stop());
                this.sources.clear();
                this.nextStartTime = 0;
                this.currentOutputTranscription = '';
                this.onStatusChange('connected');
                this.onTranscriptUpdate(this.currentInputTranscription, this.currentOutputTranscription);
            }
        },
        onclose: () => {
            this.onStatusChange('disconnected');
        },
        onerror: (e) => {
            console.error(e);
            this.onStatusChange('disconnected');
        }
      }
    });

    this.session = await sessionPromise;
  }

  async disconnect() {
    if (this.session) {
        (this.session as any).close();
    }
    
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    
    this.onStatusChange('disconnected');
  }
}

// --- Audio Encoding / Decoding Helpers ---

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  const bytes = new Uint8Array(int16.buffer);
  const base64 = encode(bytes);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}