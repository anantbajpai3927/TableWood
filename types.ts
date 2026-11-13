export interface UserProfile {
  examName: string;
  targetScore: string;
  country: string;
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64 string
}

export interface ChapterRequest {
  chapterName: string;
}

// Structured content response from Gemini
export interface Subtopic {
  title: string;
  content: string; // Markdown theory
  diagramDescription?: string; // Description for image generation
  diagramUrl?: string; // Base64 Data URL for persisted images
  formulas: string[];
  exampleQuestion: {
    question: string;
    solution: string;
    type: string; // e.g., "Numerical", "Conceptual"
  };
}

export interface ChapterContent {
  id?: string; // For persistence
  savedAt?: number;
  isCompleted?: boolean; // New field for completion status
  title: string;
  intro: string;
  subtopics: Subtopic[];
  questionBank: {
    question: string;
    type: 'Previous Year' | 'Expected' | 'Mixed Concept';
    difficulty: 'Medium' | 'Hard';
    solution: string;
  }[];
  mustDoQuestionIndices: number[]; // Indices of questionBank
  strategy: string;
  practiceNote?: string; // New field for practice resources
}

export interface StudyPlanInput {
  prepLevel: string;
  studyHours: string;
  weakAreas: string;
}

export interface Task {
  description: string;
  isCompleted: boolean;
}

export interface MockTest {
  name: string;
  timing: string;
  syllabus: string;
}

export interface StudyPlan {
  id?: string; // For persistence
  savedAt?: number;
  isActive?: boolean; // New field for currently followed plan
  title: string; // Added for identification
  overview: string;
  phases: {
    title: string;
    duration: string;
    weeks: {
      week: number;
      focus: string;
      days: {
        day: string;
        tasks: Task[]; // Changed from string[] to object for checkboxes
      }[];
    }[];
  }[];
  mockTests?: MockTest[];
  tips: string[];
}

export enum AppState {
  ONBOARDING,
  DASHBOARD,
  GENERATING_CHAPTER,
  READING_CHAPTER,
  WIZARD_PLAN,
  GENERATING_PLAN,
  VIEWING_PLAN,
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export type DashboardTab = 'library' | 'discuss';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}