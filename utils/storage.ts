import AsyncStorage from '@react-native-async-storage/async-storage';

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
  walk: boolean | number; // false | true | nombre de pas (HealthKit)
  food: number | null;    // legacy — non utilisé (conservé pour migration)
  water: number;          // verres
  sleep: number | null;   // heures (HealthKit)
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
  const existing = await getDay(date) || { date, walk: false, food: null, water: 0, sleep: null };
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

// ─── Score ────────────────────────────────────────────────────────────────────
// Barème :
//   Activité  → 30 pts  (walk = true/nombre de pas)
//   Nutrition → 30 pts  (calories vs objectif, via HealthKit)
//   Hydratation → 20 pts
//   Sommeil   → 20 pts

export function getDayScore(day: DayEntry, goal?: number): number {
  let score = 0;

  // Activité (30 pts)
  if (typeof day.walk === 'number' && day.walk > 0) {
    // Basé sur le nombre de pas : objectif 10 000
    const stepPct = Math.min(1, day.walk / 10000);
    score += Math.round(stepPct * 30);
  } else if (day.walk === true) {
    score += 30;
  }

  // Nutrition (30 pts) — calories HealthKit vs objectif
  if (goal && goal > 0 && (day.calories ?? 0) > 0) {
    const diff = Math.abs(day.calories! - goal);
    if (diff <= 100) score += 30;
    else if (diff <= 200) score += 22;
    else if (diff <= 400) score += 14;
    else if (diff <= 600) score += 7;
    else score += 2;
  }
  // Pas de fallback food stars — si pas de données calories, 0 pts nutrition

  // Hydratation (20 pts)
  if (day.water >= 8) score += 20;
  else if (day.water >= 6) score += 15;
  else if (day.water >= 4) score += 10;
  else if (day.water >= 2) score += 5;

  // Sommeil (20 pts) — basé sur les heures (HealthKit)
  if (day.sleep && day.sleep > 0) {
    if (day.sleep >= 7.5) score += 20;
    else if (day.sleep >= 6.5) score += 14;
    else if (day.sleep >= 5.5) score += 8;
    else score += 4;
  }

  return Math.min(100, Math.round(score));
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