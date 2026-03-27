import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Platform, Dimensions,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  DayEntry, updateDay, getAllDays,
  computeStreak, getDayScore, getDay, getProfile,
  calculateCalorieGoal, getScoreLabel,
} from '../utils/storage';
import { requestPermissions, scheduleAll } from '../utils/notifications';
import {
  getTodayCalories, getLatestWeight, getTodaySteps,
  getTodayActiveEnergy, getLatestHeartRate, getSleepDetails,
  getLatestBodyFat, logAllHealthData, getMealBreakdown,
  MealBreakdown, initHealth,
} from '../utils/health';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Date utils ───────────────────────────────────────────────────────────────
function todayLocalString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildFlatDates(todayStr: string, pastDays = 60): string[] {
  return Array.from({ length: pastDays + 1 }, (_, i) => offsetDate(todayStr, i - pastDays));
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  border: '#1E1E1E',
  accent: '#E8F97D',
  accentDim: 'rgba(232,249,125,0.12)',
  text: '#F2F2F2',
  textSub: '#888',
  textMuted: '#444',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)',
  red: '#f87171',
  orange: '#fb923c',
  orangeDim: 'rgba(251,146,60,0.12)',
  blue: '#60a5fa',
  blueDim: 'rgba(96,165,250,0.1)',
  purple: '#a78bfa',
};

// ─── App Header ───────────────────────────────────────────────────────────────
function AppHeader({
  activeDate, todayStr, streak, onSelectDate,
}: {
  activeDate: string; todayStr: string; streak: number; onSelectDate: (date: string) => void;
}) {
  const isToday = activeDate === todayStr;

  const changeDay = (dir: number) => {
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (next > todayStr) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectDate(next);
  };

  const label = (() => {
    if (isToday) return "Aujourd'hui";
    const d = new Date(activeDate + 'T00:00:00');
    const diff = Math.round((new Date(todayStr).getTime() - d.getTime()) / 86400000);
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  return (
    <View style={h.wrapper}>
      <View style={h.topRow}>
        <Text style={h.greeting}>Bonjour</Text>
        <View style={h.streakPill}>
          <Ionicons name="flame" size={13} color={C.accent} />
          <Text style={h.streakNum}>{streak}</Text>
          <Text style={h.streakDay}> jours</Text>
        </View>
      </View>
      <View style={h.dateRow}>
        <TouchableOpacity style={h.arrow} onPress={() => changeDay(-1)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.textSub} />
        </TouchableOpacity>
        <View style={h.dateCenter}>
          <Text style={h.dateLabel} numberOfLines={1}>{label}</Text>
        </View>
        <TouchableOpacity
          style={[h.arrow, isToday && h.arrowDisabled]}
          onPress={() => changeDay(1)}
          disabled={isToday}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={20} color={isToday ? C.textMuted : C.textSub} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  wrapper: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  greeting: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  streakNum: { color: C.accent, fontSize: 14, fontWeight: '800' },
  streakDay: { color: C.textSub, fontSize: 11, fontWeight: '500' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  arrow: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.2 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { color: C.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, textTransform: 'capitalize' },
});

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const { color } = getScoreLabel(score);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 68, height: 68 }}>
      <View style={{ position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: C.border }} />
      <Text style={{ color, fontSize: 21, fontWeight: '800', letterSpacing: -1 }}>{score}</Text>
      <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginTop: -2 }}>/ 100</Text>
    </View>
  );
}

// ─── Walk Tile ────────────────────────────────────────────────────────────────
function WalkTile({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      style={[wt.tile, done && wt.tileDone]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={[wt.iconBox, done && wt.iconBoxDone]}>
        <Ionicons
          name={done ? 'checkmark' : 'walk-outline'}
          size={18}
          color={done ? '#1a1a00' : C.textSub}
        />
      </View>
      <Text style={[wt.label, done && wt.labelDone]}>
        {done ? 'Marche validée' : 'Marche du jour'}
      </Text>
      <View style={[wt.ring, done && wt.ringDone]}>
        {done && <Ionicons name="checkmark" size={12} color="#1a1a00" />}
      </View>
    </TouchableOpacity>
  );
}

const wt = StyleSheet.create({
  tile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  tileDone: { backgroundColor: '#E8F97D', borderColor: '#E8F97D' },
  iconBox: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxDone: { backgroundColor: 'rgba(0,0,0,0.1)', borderColor: 'transparent' },
  label: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  labelDone: { color: '#1a1a00' },
  ring: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ringDone: { backgroundColor: 'rgba(0,0,0,0.18)', borderColor: 'transparent' },
});

// ─── Nutrition Card ───────────────────────────────────────────────────────────
function NutritionCard({ data, goal }: { data: MealBreakdown; goal: number }) {
  const pct = Math.min(100, Math.round((data.total / goal) * 100));
  const over = data.total > goal;
  const barColor = over ? C.red : pct > 80 ? C.green : C.orange;
  const ICONS: Record<string, string> = {
    'Petit-déj': 'cafe-outline', 'Déjeuner': 'restaurant-outline',
    'Dîner': 'moon-outline', 'Collation': 'nutrition-outline',
  };
  return (
    <View style={nc.card}>
      <View style={nc.header}>
        <View style={[nc.iconBg, { backgroundColor: C.orangeDim }]}>
          <Ionicons name="nutrition-outline" size={14} color={C.orange} />
        </View>
        <Text style={nc.title}>Nutrition</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[nc.kcal, { color: over ? C.red : C.text }]}>{data.total.toLocaleString()}</Text>
          <Text style={nc.kcalGoal}> / {goal.toLocaleString()} kcal</Text>
        </View>
      </View>
      <View style={nc.barBg}>
        <View style={[nc.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[nc.pct, { color: barColor }]}>
        {over ? `+${data.total - goal} kcal au-dessus` : `${goal - data.total} kcal restantes`}
      </Text>
      {data.meals.length > 0 ? (
        <View style={nc.mealList}>
          {data.meals.map((m, i) => (
            <View key={i} style={[nc.mealRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <View style={[nc.mealIcon, { backgroundColor: C.surface }]}>
                <Ionicons name={(ICONS[m.meal] || 'ellipse-outline') as any} size={12} color={C.textSub} />
              </View>
              <Text style={nc.mealName}>{m.meal}</Text>
              <Text style={nc.mealTime}>{m.time}</Text>
              <Text style={nc.mealKcal}>{m.value} kcal</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={nc.empty}>Aucun repas enregistré</Text>
      )}
    </View>
  );
}

const nc = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  kcal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  kcalGoal: { color: C.textSub, fontSize: 12, fontWeight: '500' },
  barBg: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  pct: { fontSize: 11, fontWeight: '600', marginBottom: 12 },
  mealList: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  mealRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  mealIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  mealName: { color: C.text, fontSize: 13, fontWeight: '500', flex: 1 },
  mealTime: { color: C.textMuted, fontSize: 11 },
  mealKcal: { color: C.accent, fontSize: 13, fontWeight: '700' },
  empty: { color: C.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});

// ─── Activity Card ────────────────────────────────────────────────────────────
function ActivityCard({ steps, activeEnergy, sleep, heartRate }: {
  steps: number; activeEnergy: number; sleep?: number | null; heartRate?: number;
}) {
  const pct = Math.min(100, (steps / 10000) * 100);
  return (
    <View style={ac.card}>
      <View style={ac.header}>
        <View style={[ac.iconBg, { backgroundColor: C.greenDim }]}>
          <Ionicons name="fitness-outline" size={14} color={C.green} />
        </View>
        <Text style={ac.title}>Activité</Text>
      </View>
      <View style={ac.stepsRow}>
        <View style={{ flex: 1 }}>
          <Text style={ac.stepsNum}>{steps.toLocaleString()}</Text>
          <Text style={ac.stepsLabel}>pas · objectif 10 000</Text>
          <View style={ac.stepBar}>
            <View style={[ac.stepFill, { width: `${pct}%` }]} />
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Ionicons name="flame" size={16} color={C.orange} />
          <Text style={[ac.stepsNum, { color: C.orange, fontSize: 20 }]}>{activeEnergy}</Text>
          <Text style={ac.stepsLabel}>kcal actives</Text>
        </View>
      </View>
      {(heartRate || sleep) ? (
        <View style={ac.vitalsRow}>
          {heartRate ? (
            <View style={ac.vital}>
              <Ionicons name="heart" size={12} color={C.red} />
              <Text style={[ac.vitalVal, { color: C.red }]}>{heartRate}</Text>
              <Text style={ac.vitalUnit}>bpm</Text>
            </View>
          ) : null}
          {sleep ? (
            <View style={ac.vital}>
              <Ionicons name="moon" size={12} color={C.purple} />
              <Text style={[ac.vitalVal, { color: C.purple }]}>
                {Math.floor(sleep)}h{Math.round((sleep % 1) * 60).toString().padStart(2, '0')}
              </Text>
              <Text style={ac.vitalUnit}>sommeil</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const ac = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  iconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 14, fontWeight: '700' },
  stepsRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  stepsNum: { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  stepsLabel: { color: C.textSub, fontSize: 11, fontWeight: '500', marginBottom: 8 },
  stepBar: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  stepFill: { height: '100%', backgroundColor: C.green, borderRadius: 2 },
  vitalsRow: { flexDirection: 'row', gap: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  vital: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  vitalVal: { fontSize: 14, fontWeight: '700' },
  vitalUnit: { color: C.textSub, fontSize: 10, fontWeight: '500' },
});

// ─── Water Card ─────────────────────────────────────────────────────────────--──
function WaterCard({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={wc.card}>
      <View style={wc.header}>
        <View style={[wc.iconBg, { backgroundColor: C.blueDim }]}>
          <Ionicons name="water" size={14} color={C.blue} />
        </View>
        <Text style={wc.title}>Hydratation</Text>
        <Text style={[wc.count, { color: value >= 6 ? C.green : C.blue }]}>
          {value}<Text style={wc.total}>/8</Text>
        </Text>
      </View>
      <View style={wc.glassRow}>
        {Array.from({ length: 8 }, (_, i) => i < value).map((filled, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onChange(i < value ? i : i + 1);
            }}
            style={[wc.glass, filled && { backgroundColor: C.blue, borderColor: C.blue }]}
            activeOpacity={0.7}
          >
            <Ionicons name={filled ? 'water' : 'water-outline'} size={15} color={filled ? '#fff' : C.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const wc = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  count: { fontSize: 18, fontWeight: '800' },
  total: { fontSize: 12, color: C.textSub, fontWeight: '500' },
  glassRow: { flexDirection: 'row', gap: 8 },
  glass: { flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
});

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <View style={notec.card}>
      <View style={notec.header}>
        <View style={[notec.iconBg, { backgroundColor: C.accentDim }]}>
          <Ionicons name="create-outline" size={14} color={C.accent} />
        </View>
        <Text style={notec.title}>Note du jour</Text>
      </View>
      <TextInput
        style={notec.input}
        placeholder="Comment s'est passée ta journée ?"
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
      />
    </View>
  );
}

const notec = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 14, fontWeight: '700' },
  input: { color: C.text, fontSize: 14, lineHeight: 21, backgroundColor: C.surface, borderRadius: 12, padding: 12, minHeight: 72, textAlignVertical: 'top', borderWidth: 1, borderColor: C.border },
});

// ─── Day Page ─────────────────────────────────────────────────────────────────
const PRELOAD_RADIUS = 2;

function DayPage({ date, isActive, isPreloaded, goal, onUpdate }: {
  date: string; isActive: boolean; isPreloaded: boolean; goal: number; onUpdate: () => void;
}) {
  const [entry, setEntry] = useState<DayEntry>({ date, walk: false, steps: 0, food: null, water: 0, sleep: null });
  const [note, setNote] = useState('');
  const [mealData, setMealData] = useState<MealBreakdown>({ total: 0, meals: [] });
  const [score, setScore] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryRef = useRef(entry);
  const noteRef = useRef(note);

  useEffect(() => { entryRef.current = entry; }, [entry]);
  useEffect(() => { noteRef.current = note; }, [note]);

  const load = useCallback(async () => {
    const d = await getDay(date);
    if (d) {
      setEntry(d);
      setNote(d.note || '');
      setScore(getDayScore(d, goal));
    }

    // ─── Récupération du sommeil : additionne Core + Deep + REM ───────────
    const sleepDetails = await getSleepDetails(date);
    const sleepTotal = sleepDetails
      ? parseFloat((sleepDetails.core + sleepDetails.deep + sleepDetails.rem).toFixed(2))
      : null;

    const [hKcal, hSteps, hEnergy, hWeight, hFat, hHeart, meals] = await Promise.all([
      getTodayCalories(date),
      getTodaySteps(date),
      getTodayActiveEnergy(date),
      getLatestWeight(date),
      getLatestBodyFat(),
      getLatestHeartRate(),
      getMealBreakdown(date),
    ]);

    setMealData(meals);

    const patch: Partial<DayEntry> = {};
    if (hKcal > 0) patch.calories = hKcal;
    if (hWeight && !d?.weight) patch.weight = parseFloat(hWeight.toFixed(1));
    if (hEnergy > 0) patch.activeEnergy = hEnergy;
    if (hHeart) patch.heartRate = hHeart;
    if (hFat) patch.bodyFat = hFat;

    // Sauvegarde le sommeil avec les détails pour le scoring de qualité
    if (sleepDetails && sleepTotal !== null) {
      patch.sleep = sleepTotal;
      patch.sleepDetails = {
        core: sleepDetails.core,
        deep: sleepDetails.deep,
        rem: sleepDetails.rem,
        awake: sleepDetails.awake,
      };
    }

    // Mettre à jour les pas HealthKit sans écraser la validation manuelle de marche
    if (hSteps !== d?.steps) {
      patch.steps = hSteps;
    }

    if (Object.keys(patch).length > 0) {
      await updateDay(date, patch);
      const next = await getDay(date);
      if (next) { setEntry(next); setScore(getDayScore(next, goal)); }
    }

    setLoaded(true);
  }, [date, goal]);

  useEffect(() => {
    if (isPreloaded && !loaded) load();
  }, [isPreloaded, loaded, load]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => { load(); }, 60_000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isActive, load]);

  const triggerSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateDay(date, { ...entryRef.current, note: noteRef.current });
      onUpdate();
    }, 600);
  };

  const update = (patch: Partial<DayEntry>) => {
    setEntry(prev => {
      const next = { ...prev, ...patch };
      setScore(getDayScore(next, goal));
      return next;
    });
    triggerSave();
  };

  const steps = entry.steps || 0;
  const { text: scoreText, color: scoreColor } = getScoreLabel(score);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        style={{ width: SCREEN_W }}
        contentContainerStyle={{ padding: 16, paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={pg.hero}>
          <ScoreRing score={score} />
          <View style={{ flex: 1 }}>
            <Text style={pg.heroTitle}>Score du jour</Text>
            <View style={pg.heroBg}>
              <View style={[pg.heroFill, { width: `${score}%`, backgroundColor: scoreColor }]} />
            </View>
            <Text style={[pg.heroSub, { color: scoreColor }]}>
              {scoreText}
            </Text>
            
            {/* Détail du score - 2 colonnes */}
            <View style={{ flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[pg.tinyDot, { backgroundColor: C.blue }]} />
                <Text style={{ color: C.textSub, fontSize: 9, fontWeight: '500' }}>Activité:</Text>
                <Text style={{ color: C.blue, fontSize: 9, fontWeight: '700' }}>{Math.round((entry.walk ? 30 : (entry.steps || 0) >= 10000 ? 30 : Math.min(30, ((entry.steps || 0) / 10000) * 30)))}/30</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[pg.tinyDot, { backgroundColor: C.orange }]} />
                <Text style={{ color: C.textSub, fontSize: 9, fontWeight: '500' }}>Nutrition:</Text>
                <Text style={{ color: entry.calories ? C.orange : C.textMuted, fontSize: 9, fontWeight: '700' }}>
                  {entry.calories && goal > 0 ? (() => {
                    const diff = entry.calories! - goal;
                    if (diff >= -300 && diff <= -100) return 30;
                    if (diff > -100 && diff <= 0) return 27;
                    if (diff > 0 && diff <= 100) return 25;
                    if (diff > 100 && diff <= 250) return 18;
                    if (diff > 250 && diff <= 500) return 10;
                    if (diff > 500 && diff <= 800) return 4;
                    if (diff < -300 && diff >= -600) return 20;
                    if (diff < -600) return 12;
                    return 0;
                  })() : '--'}/30
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[pg.tinyDot, { backgroundColor: C.accent }]} />
                <Text style={{ color: C.textSub, fontSize: 9, fontWeight: '500' }}>Eau:</Text>
                <Text style={{ color: (entry.water || 0) > 0 ? C.accent : C.textMuted, fontSize: 9, fontWeight: '700' }}>{Math.min(20, Math.round(((entry.water || 0) / 8) * 20))}/20</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[pg.tinyDot, { backgroundColor: C.green }]} />
                <Text style={{ color: C.textSub, fontSize: 9, fontWeight: '500' }}>Sommeil:</Text>
                <Text style={{ color: entry.sleep ? C.green : C.textMuted, fontSize: 9, fontWeight: '700' }}>{entry.sleep ? Math.min(20, Math.round((entry.sleep / 8) * 20)) : '--'}/20</Text>
              </View>
            </View>
          </View>
        </View>

        <WalkTile
          done={entry.walk}
          onToggle={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            update({ walk: !entry.walk });
          }}
        />

        <NutritionCard data={mealData} goal={goal} />
        <ActivityCard
          steps={steps}
          activeEnergy={entry.activeEnergy || 0}
          sleep={entry.sleep}
          heartRate={entry.heartRate}
        />
        <WaterCard value={entry.water} onChange={v => update({ water: v })} />
        <NoteCard value={note} onChange={t => { setNote(t); triggerSave(); }} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const pg = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  heroTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  heroBg: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  heroFill: { height: '100%', borderRadius: 3 },
  heroSub: { fontSize: 12, fontWeight: '600' },
  tinyDot: { width: 5, height: 5, borderRadius: 2.5 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const today = todayLocalString();

  const flatDates = useMemo(() => buildFlatDates(today, 60), [today]);
  const todayFlatIdx = flatDates.indexOf(today);

  const [activeDate, setActiveDate] = useState(today);
  const [activeFlatIdx, setActiveFlatIdx] = useState(todayFlatIdx);
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState(2000);

  const pageRef = useRef<FlatList>(null);
  const activeDateRef = useRef(activeDate);
  useEffect(() => { activeDateRef.current = activeDate; }, [activeDate]);

  const loadMeta = useCallback(async () => {
    // Demander les permissions HealthKit d'abord
    try {
      await initHealth();
    } catch (e) {
      console.log('[HealthKit] Permission error or already granted:', e);
    }
    
    const all = await getAllDays();
    setStreak(computeStreak(all));
    const p = await getProfile();
    if (p) {
      const lastWeight = all.find(d => d.weight)?.weight || 80;
      setGoal(calculateCalorieGoal(p, lastWeight));
    }
    const ok = await requestPermissions();
    if (ok) await scheduleAll(!!all.find(d => d.date === today)?.weight);
    await logAllHealthData();
  }, [today]);

  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));

  const onSelectDate = (date: string) => {
    const idx = flatDates.indexOf(date);
    if (idx < 0) return;
    setActiveDate(date);
    setActiveFlatIdx(idx);
    pageRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const onPageSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    const date = flatDates[idx];
    if (date && date !== activeDateRef.current) {
      setActiveDate(date);
      setActiveFlatIdx(idx);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <AppHeader
        activeDate={activeDate}
        todayStr={today}
        streak={streak}
        onSelectDate={onSelectDate}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={pageRef}
          data={flatDates}
          keyExtractor={d => d}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={todayFlatIdx}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={onPageSwipeEnd}
          scrollEventThrottle={16}
          windowSize={PRELOAD_RADIUS * 2 + 1}
          maxToRenderPerBatch={PRELOAD_RADIUS * 2 + 1}
          initialNumToRender={PRELOAD_RADIUS * 2 + 1}
          renderItem={({ item, index }) => (
            <DayPage
              date={item}
              isActive={index === activeFlatIdx}
              isPreloaded={Math.abs(index - activeFlatIdx) <= PRELOAD_RADIUS}
              goal={goal}
              onUpdate={loadMeta}
            />
          )}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});