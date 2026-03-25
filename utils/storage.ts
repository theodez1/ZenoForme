import AsyncStorage from '@react-native-async-storage/async-storage';

import { calculateSleepScore, sleepScoreToGlobalPoints } from './health';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  image?: string;
}

export interface DayEntry {
  date: string;           // YYYY-MM-DD
  walk: boolean;          // false | true (validation manuelle)
  steps: number;          // nombre de pas (HealthKit)
  food: number | null;    // legacy — non utilisé (conservé pour migration)
  water: number;          // verres
  sleep: number | null;   // heures de sommeil RÉEL (Core + Deep + REM, sans éveil)
  sleepDetails?: {        // détails pour calcul du score de qualité
    core: number;
    deep: number;
    rem: number;
    awake: number;
  };
  note?: string;
  weight?: number;        // kg
  bodyFat?: number;       // %
  calories?: number;      // kcal mangées (HealthKit, toujours à jour)
  activeEnergy?: number;  // kcal actives (HealthKit)
  heartRate?: number;     // bpm
  caloriesItems?: FoodItem[];
  foodTags?: string[];
  photoUri?: string;      // legacy
}

export interface UserProfile {
  height: number;
  age: number;
  gender: 'male' | 'female';
  activityFactor: number;
  goal?: number;
  deficitType?: 'light' | 'standard' | 'intense';
}

const KEY_PREFIX = 'day_';
const PROFILE_KEY = 'user_profile';

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  const existing = await getProfile() || { height: 175, age: 30, gender: 'male', activityFactor: 1.2 };
  await saveProfile({ ...existing, ...patch });
}

export function calculateCalorieGoal(profile: UserProfile, weight: number): number {
  const { height, age, gender, activityFactor, deficitType } = profile;
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = bmr * (activityFactor || 1.2);
  const deficit = deficitType === 'light' ? 250 : deficitType === 'intense' ? 750 : 500;
  return Math.round(tdee - deficit);
}

// ─── Day CRUD ─────────────────────────────────────────────────────────────────

export async function saveDay(entry: DayEntry): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${entry.date}`, JSON.stringify(entry));
}

export async function updateDay(date: string, patch: Partial<DayEntry>): Promise<void> {
  // On s'assure que la valeur initiale de walk est compatible (false par exemple)
  const existing = await getDay(date) || {
    date,
    walk: false,
    steps: 0,
    food: null,
    water: 0,
    sleep: null
  };
  await saveDay({ ...existing, ...patch });
}

export async function getDay(date: string): Promise<DayEntry | null> {
  const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${date}`);
  if (!raw) return null;
  const data = JSON.parse(raw);

  // Migration: anciens ratings string → number (legacy)
  if (typeof data.food === 'string') {
    if (data.food === 'great') data.food = 5;
    else if (data.food === 'ok') data.food = 3;
    else if (data.food === 'bad') data.food = 1;
    else data.food = null;
  }
  
  // Migration: anciennes données walk (nombre) vers steps, et walk devient booléen
  if (typeof data.walk === 'number') {
    data.steps = data.walk;
    data.walk = data.steps > 0; // Si pas > 0, considère comme validé
  } else if (data.walk === undefined) {
    data.walk = false;
  }
  
  // S'assurer que steps existe
  if (data.steps === undefined) data.steps = 0;

  // Migration: anciennes données sleep string → number
  if (typeof data.sleep === 'string') {
    data.sleep = data.sleep === 'great' ? 8 : data.sleep === 'ok' ? 6 : 4;
  }

  return data;
}

export async function getAllDays(): Promise<DayEntry[]> {
  const keys = await AsyncStorage.getAllKeys();
  const dayKeys = keys.filter((k: string) => k.startsWith(KEY_PREFIX));
  if (dayKeys.length === 0) return [];
  const pairs = await AsyncStorage.multiGet(dayKeys);
  return pairs
    .map(([, v]: [string, string | null]) => (v ? JSON.parse(v) : null))
    .filter(Boolean)
    .sort((a: DayEntry, b: DayEntry) => b.date.localeCompare(a.date));
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function isDayComplete(day: DayEntry): boolean {
  return !!day.walk || day.water > 0 || !!day.sleep || (day.calories ?? 0) > 0;
}

// ─── Score System ─────────────────────────────────────────────────────────────
//
// LE SCORE JOURNALIER (0-100 pts) mesure 4 piliers de santé :
//
// ┌─────────────────┬──────────┬─────────────────────────────────────────┐
// │ Catégorie       │ Points   │ Comment gagner des points               │
// ├─────────────────┼──────────┼─────────────────────────────────────────┤
// │ 🚶 ACTIVITÉ     │ 30 pts   │ • Marche cochée OU ≥10 000 pas = 30 pts │
// │                 │          │ • Proportionnel aux pas sinon           │
// ├─────────────────┼──────────┼─────────────────────────────────────────┤
// │ 🍎 NUTRITION    │ 30 pts   │ • Déficit -300 à -100 kcal = 30 pts ✅ │
// │ (favorise       │          │ • -100 à 0 kcal = 27 pts (déficit léger)│
// │  déficit)       │          │ • 0 à +100 kcal = 25 pts (léger excès)  │
// │                 │          │ • +100 à +250 = 18 pts (limite)         │
// │                 │          │ • +250 à +500 = 10 pts (trop mangé)     │
// │                 │          │ • +500 à +800 = 4 pts (excès important) │
// │                 │          │ • Déficit fort (-600 à -300) = 20 pts   │
// │                 │          │ • Trop restrictif (< -600) = 12 pts     │
// ├─────────────────┼──────────┼─────────────────────────────────────────┤
// │ 💧 HYDRATATION  │ 20 pts   │ │ ≥8 verres = 20 pts                      │
// │                 │          │ │ ≥6 verres = 15 pts                      │
// │                 │          │ │ ≥4 verres = 10 pts                      │
// │                 │          │ │ ≥2 verres = 5 pts                       │
// ├─────────────────┼──────────┼─────────────────────────────────────────┤
// │ 😴 SOMMEIL      │ 20 pts   │ │ ≥7.5h = 20 pts (excellent)              │
// │                 │          │ │ ≥6.5h = 14 pts (correct)                │
// │                 │          │ │ ≥5.5h = 8 pts (minimum)                 │
// │                 │          │ │ <5.5h = 4 pts (insuffisant)             │
// └─────────────────┴──────────┴─────────────────────────────────────────┘
//
// SCORE FINAL = min(100, somme des 4 catégories)
// INTERPRÉTATION: ≥75 = Parfait | ≥40 = Bien | <40 = À améliorer

const SCORE_WEIGHTS = {
  ACTIVITY: 30,
  NUTRITION: 30,
  HYDRATION: 20,
  SLEEP: 20,
} as const;

const STEP_GOAL = 10000;

export function getDayScore(day: DayEntry, calorieGoal?: number): number {
  let totalScore = 0;

  // ─── 1. ACTIVITÉ (30 pts) ───────────────────────────────────────────────────
  const hasWalked = day.walk === true;
  const stepCount = typeof day.steps === 'number' ? day.steps : 0;

  if (hasWalked || stepCount >= STEP_GOAL) {
    totalScore += SCORE_WEIGHTS.ACTIVITY;
  } else if (stepCount > 0) {
    const progress = Math.min(1, stepCount / STEP_GOAL);
    totalScore += Math.round(progress * SCORE_WEIGHTS.ACTIVITY);
  }
  // Si ni marche ni pas = 0 pts

  // ─── 2. NUTRITION (30 pts) ────────────────────────────────────────────────
  // Pour la perte de poids : on favorise le DÉFICIT (manger moins que l'objectif)
  // Légèrement en dessous de l'objectif = optimal pour maigrir
  const calories = day.calories ?? 0;
  if (calorieGoal && calorieGoal > 0 && calories > 0) {
    const diff = calories - calorieGoal; // Positif = trop mangé, Négatif = déficit
    let nutritionScore: number;

    // Déficit modéré (optimal pour perdre du poids sans famine)
    if (diff >= -300 && diff <= -100) nutritionScore = 30;      // ✅ Déficit parfait
    // Presque objectif (légèrement au-dessus ou en dessous)
    else if (diff > -100 && diff <= 0) nutritionScore = 27;    // Très bien (léger déficit)
    else if (diff > 0 && diff <= 100) nutritionScore = 25;     // Bien (légèrement au-dessus)
    // Trop mangé (excès calorique = contre-productif)
    else if (diff > 100 && diff <= 250) nutritionScore = 18;   // Limite dépassée
    else if (diff > 250 && diff <= 500) nutritionScore = 10;   // Excès significatif
    else if (diff > 500 && diff <= 800) nutritionScore = 4;   // Trop mangé
    else if (diff < -300 && diff >= -600) nutritionScore = 20; // Déficit un peu fort
    else if (diff < -600) nutritionScore = 12;               // Trop restrictif (risque)
    else nutritionScore = 0;                                   // Extrême

    totalScore += nutritionScore;
  }
  // Sans objectif ou sans données = 0 pts (on ne devine pas)

  // ─── 3. HYDRATATION (20 pts) ────────────────────────────────────────────
  const waterGlasses = day.water ?? 0;
  let hydrationScore: number;

  if (waterGlasses >= 8) hydrationScore = 20;
  else if (waterGlasses >= 6) hydrationScore = 15;
  else if (waterGlasses >= 4) hydrationScore = 10;
  else if (waterGlasses >= 2) hydrationScore = 5;
  else hydrationScore = 0;

  totalScore += hydrationScore;

  // ─── 4. SOMMEIL (20 pts) ────────────────────────────────────────────────
  // Utilise les détails de sommeil si disponibles pour un score de qualité
  // Sinon, fallback sur la durée seule
  let sleepScore = 0;
  
  if (day.sleepDetails) {
    // Score basé sur la qualité (0-100) converti en points (0-20)
    const qualityScore = calculateSleepScore(
      day.sleepDetails.core,
      day.sleepDetails.deep,
      day.sleepDetails.rem,
      day.sleepDetails.awake
    );
    sleepScore = sleepScoreToGlobalPoints(qualityScore);
  } else if (day.sleep && day.sleep > 0) {
    // Fallback: score basé uniquement sur la durée
    const sleepHours = day.sleep;
    if (sleepHours >= 7.5) sleepScore = 20;
    else if (sleepHours >= 7) sleepScore = 18;
    else if (sleepHours >= 6.5) sleepScore = 16;
    else if (sleepHours >= 6) sleepScore = 13;
    else if (sleepHours >= 5.5) sleepScore = 10;
    else if (sleepHours >= 5) sleepScore = 7;
    else if (sleepHours >= 4) sleepScore = 4;
    else sleepScore = Math.max(0, Math.round(sleepHours));
  }

  totalScore += sleepScore;

  // Cap à 100 pts et arrondir
  return Math.min(100, Math.round(totalScore));
}

// ─── Helper: Interprétation du score ───────────────────────────────────────
export function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 75) return { text: 'Journée parfaite', color: '#34d399' };  // Vert
  if (score >= 40) return { text: 'Bonne progression', color: '#E8F97D' }; // Jaune
  return { text: 'Commence par une marche', color: '#f87171' };             // Rouge
}

// ─── Helper: Breakdown détaillé du score ───────────────────────────────────
export interface ScoreBreakdown {
  activity: { points: number; max: number; detail: string };
  nutrition: { points: number; max: number; detail: string };
  hydration: { points: number; max: number; detail: string };
  sleep: { points: number; max: number; detail: string };
  total: number;
}

export function getDayScoreBreakdown(day: DayEntry, calorieGoal?: number): ScoreBreakdown {
  const result: ScoreBreakdown = {
    activity: { points: 0, max: SCORE_WEIGHTS.ACTIVITY, detail: '' },
    nutrition: { points: 0, max: SCORE_WEIGHTS.NUTRITION, detail: '' },
    hydration: { points: 0, max: SCORE_WEIGHTS.HYDRATION, detail: '' },
    sleep: { points: 0, max: SCORE_WEIGHTS.SLEEP, detail: '' },
    total: 0,
  };

  // Activité
  const hasWalked = day.walk === true;
  const stepCount = typeof day.steps === 'number' ? day.steps : 0;
  if (hasWalked || stepCount >= STEP_GOAL) {
    result.activity.points = SCORE_WEIGHTS.ACTIVITY;
    result.activity.detail = hasWalked ? 'Marche validée' : '10 000 pas atteints';
  } else if (stepCount > 0) {
    const progress = Math.min(1, stepCount / STEP_GOAL);
    result.activity.points = Math.round(progress * SCORE_WEIGHTS.ACTIVITY);
    result.activity.detail = `${stepCount.toLocaleString()} pas`;
  } else {
    result.activity.detail = 'Aucune activité';
  }

  // Nutrition
  const calories = day.calories ?? 0;
  if (calorieGoal && calorieGoal > 0 && calories > 0) {
    const diff = calories - calorieGoal;
    if (diff >= -300 && diff <= -100) {
      result.nutrition.points = 30;
      result.nutrition.detail = `Déficit optimal (${diff > 0 ? '+' : ''}${diff} kcal)`;
    } else if (diff > -100 && diff <= 0) {
      result.nutrition.points = 27;
      result.nutrition.detail = `Léger déficit (${diff} kcal)`;
    } else if (diff > 0 && diff <= 100) {
      result.nutrition.points = 25;
      result.nutrition.detail = `Objectif presque atteint (+${diff} kcal)`;
    } else if (diff > 100 && diff <= 250) {
      result.nutrition.points = 18;
      result.nutrition.detail = `Limite dépassée (+${diff} kcal)`;
    } else if (diff > 250 && diff <= 500) {
      result.nutrition.points = 10;
      result.nutrition.detail = `Excès significatif (+${diff} kcal)`;
    } else if (diff > 500 && diff <= 800) {
      result.nutrition.points = 4;
      result.nutrition.detail = `Trop mangé (+${diff} kcal)`;
    } else if (diff < -300 && diff >= -600) {
      result.nutrition.points = 20;
      result.nutrition.detail = `Déficit fort (${diff} kcal)`;
    } else if (diff < -600) {
      result.nutrition.points = 12;
      result.nutrition.detail = `Trop restrictif (${diff} kcal)`;
    } else {
      result.nutrition.points = 0;
      result.nutrition.detail = 'Extrême';
    }
  } else {
    result.nutrition.detail = calorieGoal ? 'Pas de données' : 'Pas d\'objectif défini';
  }

  // Hydratation
  const waterGlasses = day.water ?? 0;
  if (waterGlasses >= 8) {
    result.hydration.points = 20;
    result.hydration.detail = `${waterGlasses} verres ✓`;
  } else if (waterGlasses >= 6) {
    result.hydration.points = 15;
    result.hydration.detail = `${waterGlasses} verres`;
  } else if (waterGlasses >= 4) {
    result.hydration.points = 10;
    result.hydration.detail = `${waterGlasses} verres`;
  } else if (waterGlasses >= 2) {
    result.hydration.points = 5;
    result.hydration.detail = `${waterGlasses} verres`;
  } else {
    result.hydration.detail = waterGlasses > 0 ? `${waterGlasses} verre(s)` : 'Pas d\'eau';
  }

  // Sommeil
  if (day.sleepDetails) {
    const qualityScore = calculateSleepScore(
      day.sleepDetails.core,
      day.sleepDetails.deep,
      day.sleepDetails.rem,
      day.sleepDetails.awake
    );
    result.sleep.points = sleepScoreToGlobalPoints(qualityScore);
    
    // Détail basé sur le score de qualité
    if (qualityScore >= 85) {
      result.sleep.detail = `${day.sleep?.toFixed(1)}h — Excellent (${qualityScore}/100)`;
    } else if (qualityScore >= 70) {
      result.sleep.detail = `${day.sleep?.toFixed(1)}h — Bon (${qualityScore}/100)`;
    } else if (qualityScore >= 50) {
      result.sleep.detail = `${day.sleep?.toFixed(1)}h — Moyen (${qualityScore}/100)`;
    } else {
      result.sleep.detail = `${day.sleep?.toFixed(1)}h — À améliorer (${qualityScore}/100)`;
    }
  } else if (day.sleep && day.sleep > 0) {
    const sleepHours = day.sleep;
    if (sleepHours >= 7.5) {
      result.sleep.points = 20;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Excellent`;
    } else if (sleepHours >= 7) {
      result.sleep.points = 18;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Très bien`;
    } else if (sleepHours >= 6.5) {
      result.sleep.points = 16;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Bien`;
    } else if (sleepHours >= 6) {
      result.sleep.points = 13;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Correct`;
    } else if (sleepHours >= 5.5) {
      result.sleep.points = 10;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Acceptable`;
    } else if (sleepHours >= 5) {
      result.sleep.points = 7;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Insuffisant`;
    } else if (sleepHours >= 4) {
      result.sleep.points = 4;
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Faible`;
    } else {
      result.sleep.points = Math.max(0, Math.round(sleepHours));
      result.sleep.detail = `${sleepHours.toFixed(1)}h — Très faible`;
    }
  } else {
    result.sleep.detail = 'Pas de données';
  }

  result.total = Math.min(100, result.activity.points + result.nutrition.points + result.hydration.points + result.sleep.points);
  return result;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function computeStreak(days: DayEntry[]): number {
  if (days.length === 0) return 0;
  const sorted = [...days].filter(isDayComplete).sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) return 0;

  const today = todayString();
  const yesterday = new Date(today + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (sorted[0].date !== today && sorted[0].date !== yesterdayStr) return 0;

  let streak = 0;
  let current = sorted[0].date;

  for (const day of sorted) {
    if (day.date === current) {
      streak++;
      const d = new Date(current + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      current = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────

export async function exportAllData(): Promise<string> {
  const keys = await AsyncStorage.getAllKeys();
  const all = await AsyncStorage.multiGet(keys);
  const data: Record<string, any> = {};
  all.forEach(([k, v]) => { if (v) data[k] = JSON.parse(v); });
  return JSON.stringify(data);
}

export async function importAllData(jsonStr: string): Promise<void> {
  const data = JSON.parse(jsonStr);
  const pairs = Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)] as [string, string]);
  await AsyncStorage.multiSet(pairs);
}