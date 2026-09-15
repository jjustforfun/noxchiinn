import type topics from '../data/topics.json';

export type Page = 'learn' | 'practice' | 'achievements' | 'profile' | 'parents';
export type Content = {
  id: string; chechen: string; russian: string; transcription: string; lower?: string;
  audio: string; audioStatus: string; image: string | null; ageGroup: string; type: string;
  number?: number; swatch?: string; topicId?: string; sourceId?: string;
  recording?: { reviewed: boolean; permission: string; revision?: string };
};
export type Letter = Content;
export type Course = { id: string; title: string; level: number; version: number; language: string; reviewStatus: string; note: string; sourceIds?: string[]; sources?: string[]; items: Content[]; lessons: { id: string; title: string; description: string; duration: number; items: string[] }[] };
export type Topic = typeof topics[number];
export type GameMode = 'visual' | 'audio' | 'match' | 'build' | 'speed';
export type Result = { roundId: string; generation: string; lessonId: string; correct: number; total: number; answered: number; finished: boolean; practice: boolean; mode: string; learned: string[] };
export type Round = {
  version: number; id: string; generation: string; lessonId: string; age: string; mode: GameMode; practice: boolean; createdAt: number;
  questions: { answer: string; options: string[] }[]; index: number; responses: string[]; selected: string | null; phase: 'question' | 'feedback' | 'result';
  draft: number[]; bank: string[]; pairOrder: string[]; matched: string[]; missed: string[]; mismatch: string | null;
  remainingMs: number; tickAt: number | null; timedOut: boolean; aborted: boolean;
};
export type Profile = {
  version: number; generation: string; updatedAt: number; name: string; age: string; avatar: string; xp: number;
  hearts: number; heartUpdated: number; streak: number; lastPlayed: string | null;
  lastLogin: string; dailyXP: number; dailyDate: string;
  completed: Record<string, { stars: number; correct: number; total: number; mode?: string }>;
  learned: string[]; sessions: number; practiceDays: string[];
  rewardedRounds: string[]; spentAttempts: string[];
  bestStreak: number;
  preferences: Preferences;
  activity: Record<string, DayStats>;
  history: HistoryRecord[];
  historySince: string | null;
};
export type ReminderSettings = { enabled: boolean; consent: boolean; channel: 'in-app' | 'system'; time: string; days: number[]; lastDay: string | null; lastAt: number };
export type Preferences = { dailyGoal: number; effects: boolean; volume: number; reminders: ReminderSettings };
export type DayStats = { rounds: number; successful: number; practice: number; correct: number; total: number; xp: number };
export type HistoryRecord = { id: string; date: string; lessonId: string; mode: string; correct: number; total: number; finished: boolean; passed: boolean; practice: boolean; xp: number };
export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };