import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Animated,
  Dimensions, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getProfile, updateProfile, UserProfile, getDay, todayString, getAllDays, updateDay, getDayScoreBreakdown, ScoreBreakdown } from '../utils/storage';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  cardAlt: '#1A1A1A',
  border: '#1E1E1E',
  borderSub: '#242424',
  accent: '#E8F97D',
  accentDim: 'rgba(232,249,125,0.10)',
  text: '#F2F2F2',
  textSub: '#888',
  textMuted: '#444',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)',
  red: '#f87171',
  redDim: 'rgba(248,113,113,0.12)',
  blue: '#60a5fa',
  blueDim: 'rgba(96,165,250,0.12)',
  orange: '#fb923c',
  orangeDim: 'rgba(251,146,60,0.12)',
};

// ─── Animated Button ──────────────────────────────────────────────────────────
function AnimatedBtn({ children, onPress, style, activeOpacity = 0.8 }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, suffix, keyboardType = 'numeric', hint, icon, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix?: string;
  keyboardType?: any;
  hint?: string;
  icon?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, { toValue: (focused && !disabled) ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused, disabled]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.accent + '88'],
  });

  return (
    <View style={[f.wrap, disabled && { opacity: 0.7 }]}>
      <View style={f.labelRow}>
        <Ionicons name={(disabled ? 'lock-closed' : icon) as any} size={14} color={disabled ? C.accent : C.textMuted} />
        <Text style={[f.label, disabled && { color: C.accent }]}>{label}</Text>
        {disabled && <Text style={{ color: C.textSub, fontSize: 10, marginLeft: 8 }}>(Déjà saisi aujourd'hui)</Text>}
      </View>
      <Animated.View style={[f.row, { borderColor }, disabled && { backgroundColor: C.surface, borderColor: C.border }]}>
        <TextInput
          style={f.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <Text style={f.suffix}>{suffix}</Text>}
      </Animated.View>
      {hint && <Text style={f.hint}>{hint}</Text>}
    </View>
  );
}

const f = StyleSheet.create({
  wrap: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginLeft: 4 },
  label: { color: C.textSub, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, height: 58,
  },
  input: { flex: 1, color: C.text, fontSize: 17, fontWeight: '700' },
  suffix: { color: C.textSub, fontSize: 15, fontWeight: '600' },
  hint: { color: C.textMuted, fontSize: 11, marginTop: 6, marginLeft: 8, fontStyle: 'italic' },
});

// ─── Activity Grid ────────────────────────────────────────────────────────────
const ACTIVITY_OPTIONS = [
  { value: 1.2, label: 'Sédentaire', desc: 'Peu d\'activité', icon: 'bed-outline', color: C.textMuted },
  { value: 1.375, label: 'Léger', desc: '1-3x / sem', icon: 'walk-outline', color: C.blue },
  { value: 1.55, label: 'Modéré', desc: '3-5x / sem', icon: 'bicycle-outline', color: C.green },
  { value: 1.725, label: 'Actif', desc: '6-7x / sem', icon: 'flash-outline', color: C.orange },
];

function ActivityGrid({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={f.labelRow}>
        <Ionicons name="fitness-outline" size={14} color={C.textMuted} />
        <Text style={f.label}>Intensité hebdomadaire</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {ACTIVITY_OPTIONS.map(opt => {
          const active = Math.abs(value - opt.value) < 0.01;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[act.card, active && { borderColor: C.accent, backgroundColor: C.accentDim }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(opt.value);
              }}
              activeOpacity={0.8}
            >
              <View style={[act.iconBox, { backgroundColor: active ? C.accent : C.cardAlt }]}>
                <Ionicons name={opt.icon as any} size={16} color={active ? '#000' : opt.color} />
              </View>
              <View>
                <Text style={[act.label, active && { color: C.accent }]}>{opt.label}</Text>
                <Text style={act.desc}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const act = StyleSheet.create({
  card: {
    width: (SCREEN_W - 40 - 10) / 2,
    backgroundColor: C.card, borderRadius: 22,
    padding: 16, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { color: C.text, fontSize: 13, fontWeight: '800' },
  desc: { color: C.textSub, fontSize: 10, fontWeight: '500', marginTop: 1 },
});

// ─── BMR Dashboard ────────────────────────────────────────────────────────────
function HealthDashboard({ height, age, gender, activity, deficit, weight }: any) {
  const h = parseFloat(height);
  const a = parseInt(age);
  const w = parseFloat(weight);
  const act = parseFloat(activity);

  // Validation stricte — pas de valeurs fictives
  const isValid = h > 100 && h < 250 && a > 10 && a < 120 && w > 30 && w < 300 && act > 1;
  if (!isValid) {
    return (
      <View style={[dash.root, { padding: 24, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>
          Remplis ton poids, ta taille et ton âge{'\n'}pour voir ton objectif calorique.
        </Text>
      </View>
    );
  }

  // Mifflin-St Jeor (formule de référence)
  // Homme : 10×P + 6.25×T - 5×A + 5
  // Femme  : 10×P + 6.25×T - 5×A - 161
  const bmr = gender === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;

  const tdee = Math.round(bmr * act);
  const deficitKcal = deficit === 'light' ? 250 : deficit === 'standard' ? 500 : 750;
  const rawGoal = Math.round(tdee - deficitKcal);

  // Plancher de sécurité : 1500 kcal homme, 1200 kcal femme
  const safeFloor = gender === 'male' ? 1500 : 1200;
  const goal = Math.max(rawGoal, safeFloor);
  const isCapped = goal > rawGoal;

  const bmi = w / Math.pow(h / 100, 2);

  const getBMIColor = () => {
    if (bmi < 18.5) return C.blue;
    if (bmi < 25) return C.green;
    if (bmi < 30) return C.orange;
    return C.red;
  };

  return (
    <View style={dash.root}>
      <BlurView tint="dark" intensity={10} style={dash.glass}>
        <View style={dash.header}>
          <Text style={dash.title}>Résumé de santé</Text>
          <View style={dash.badge}>
            <View style={[dash.dot, { backgroundColor: getBMIColor() }]} />
            <Text style={dash.badgeText}>Analysé</Text>
          </View>
        </View>

        <View style={dash.row}>
          <View style={dash.mainMetric}>
            <Text style={dash.mainVal}>{goal}</Text>
            <Text style={dash.mainLabel}>kcal / jour</Text>
            <Text style={dash.mainSub}>
              {isCapped ? 'Plancher de sécurité' : 'Objectif nutritionnel'}
            </Text>
          </View>

          <View style={dash.divider} />

          <View style={dash.stats}>
            <View style={dash.statItem}>
              <Text style={dash.statLabel}>TDEE</Text>
              <Text style={dash.statVal}>{tdee}</Text>
            </View>
            <View style={dash.statItem}>
              <Text style={dash.statLabel}>IMC</Text>
              <Text style={[dash.statVal, { color: getBMIColor() }]}>{bmi.toFixed(1)}</Text>
            </View>
            <View style={dash.statItem}>
              <Text style={dash.statLabel}>BMR</Text>
              <Text style={dash.statVal}>{Math.round(bmr)}</Text>
            </View>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const dash = StyleSheet.create({
  root: { marginBottom: 30, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: C.border },
  glass: { padding: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: C.textSub, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { color: C.text, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

  row: { flexDirection: 'row', alignItems: 'center' },
  mainMetric: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  mainVal: { color: C.accent, fontSize: 44, fontWeight: '900', letterSpacing: -1.5 },
  mainLabel: { color: C.text, fontSize: 14, fontWeight: '800', marginTop: -4 },
  mainSub: { color: C.textMuted, fontSize: 10, fontWeight: '500', marginTop: 4 },

  divider: { width: 1, height: 80, backgroundColor: C.border, marginHorizontal: 10 },

  stats: { flex: 1, gap: 12 },
  statItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  statVal: { color: C.text, fontSize: 16, fontWeight: '800' },
});

// ─── Score Breakdown Card ───────────────────────────────────────────────────
function ScoreBreakdownCard({ breakdown, calorieGoal }: { breakdown: ScoreBreakdown; calorieGoal: number }) {
  const categories = [
    { key: 'activity', label: 'Activité', icon: 'walk-outline', color: C.blue },
    { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: C.orange },
    { key: 'hydration', label: 'Hydratation', icon: 'water-outline', color: C.accent },
    { key: 'sleep', label: 'Sommeil', icon: 'moon-outline', color: C.green },
  ] as const;

  return (
    <View style={sb.root}>
      <BlurView tint="dark" intensity={10} style={sb.glass}>
        <View style={sb.header}>
          <Text style={sb.title}>Score du jour</Text>
          <View style={sb.totalBadge}>
            <Text style={sb.totalVal}>{breakdown.total}</Text>
            <Text style={sb.totalLabel}>/ 100</Text>
          </View>
        </View>

        <View style={sb.categories}>
          {categories.map(cat => {
            const data = breakdown[cat.key];
            return (
              <View key={cat.key} style={sb.row}>
                <View style={sb.iconBox}>
                  <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                </View>
                <View style={sb.info}>
                  <View style={sb.labelRow}>
                    <Text style={sb.label}>{cat.label}</Text>
                    <Text style={[sb.points, { color: data.points > 0 ? cat.color : C.textMuted }]}>
                      {data.points}/{data.max}
                    </Text>
                  </View>
                  <Text style={sb.detail}>{data.detail}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {breakdown.nutrition.points > 0 && (
          <View style={sb.calorieJustify}>
            <Ionicons name="information-circle-outline" size={12} color={C.textSub} />
            <Text style={sb.calorieText}>
              Objectif: {calorieGoal} kcal • Consommé: {breakdown.nutrition.detail}
            </Text>
          </View>
        )}
      </BlurView>
    </View>
  );
}

const sb = StyleSheet.create({
  root: { marginBottom: 24, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: C.border },
  glass: { padding: 18, backgroundColor: 'rgba(255,255,255,0.02)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: C.textSub, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  totalBadge: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  totalVal: { color: C.accent, fontSize: 18, fontWeight: '900' },
  totalLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginLeft: 2 },

  categories: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: C.text, fontSize: 13, fontWeight: '700' },
  points: { fontSize: 13, fontWeight: '800' },
  detail: { color: C.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },

  calorieJustify: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  calorieText: { color: C.textSub, fontSize: 11, fontWeight: '500', flex: 1 },
});
export default function ProfileScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);

  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [isWeightSynced, setIsWeightSynced] = useState(false);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [activity, setActivity] = useState(1.2);
  const [deficit, setDeficit] = useState<'light' | 'standard' | 'intense'>('standard');
  const [goalWeight, setGoalWeight] = useState('');
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [todayEntry, setTodayEntry] = useState<any>(null);
  const [calorieGoal, setCalorieGoal] = useState<number>(2000);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const [p, today] = await Promise.all([getProfile(), getDay(todayString())]);

      if (p) {
        setHeight(p.height?.toString() || '');
        setAge(p.age?.toString() || '');
        setGender(p.gender || 'male');
        setActivity(p.activityFactor || 1.2);
        setDeficit(p.deficitType || 'standard');
        if (p.goal) setGoalWeight(p.goal.toString());
      }

      // Calculate today's calorie goal
      const h = p?.height || 175;
      const a = p?.age || 30;
      const w = today?.weight || 75;
      const act = p?.activityFactor || 1.2;
      const bmr = p?.gender === 'female'
        ? 10 * w + 6.25 * h - 5 * a - 161
        : 10 * w + 6.25 * h - 5 * a + 5;
      const tdee = Math.round(bmr * act);
      const deficitKcal = p?.deficitType === 'light' ? 250 : p?.deficitType === 'intense' ? 750 : 500;
      const calorieGoal = Math.max(p?.gender === 'female' ? 1200 : 1500, tdee - deficitKcal);
      setCalorieGoal(calorieGoal);

      if (today) {
        setTodayEntry(today);
        setScoreBreakdown(getDayScoreBreakdown(today, calorieGoal));
        if (today.weight) {
          setWeight(today.weight.toFixed(1));
          setIsWeightSynced(true);
        }
      } else {
        // Find last known weight if not today
        const all = await getAllDays();
        const last = all.find(d => d.weight);
        if (last?.weight) setWeight(last.weight.toFixed(1));
        setIsWeightSynced(false);
      }
    };
    load();
  }, []));

  const save = async () => {
    const wNum = parseFloat(parseFloat(weight).toFixed(1));
    await Promise.all([
      updateProfile({
        height: parseFloat(height) || 175,
        age: parseInt(age) || 30,
        gender,
        activityFactor: activity,
        deficitType: deficit,
        goal: goalWeight ? parseFloat(goalWeight) : undefined,
      }),
      !isWeightSynced && wNum > 0 ? updateDay(todayString(), { weight: wNum }) : Promise.resolve()
    ]);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      navigation.goBack();
    }, 800);
  };

  return (
    <View style={p.root}>
      {/* Immersive Header */}
      <View style={[p.header, { paddingTop: insets.top + 10 }]}>
        <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={p.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={p.heading}>Profil Santé</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[p.scroll, { paddingTop: 20 }]} showsVerticalScrollIndicator={false}>

          <HealthDashboard
            height={height} weight={weight} age={age}
            gender={gender} activity={activity} deficit={deficit}
          />

          {scoreBreakdown && (
            <ScoreBreakdownCard breakdown={scoreBreakdown} calorieGoal={calorieGoal} />
          )}

          {/* Section: Genre */}
          <View style={{ marginBottom: 24 }}>
            <View style={f.labelRow}>
              <Ionicons name="person-outline" size={14} color={C.textMuted} />
              <Text style={f.label}>Genre & Identité</Text>
            </View>
            <View style={p.genderGrid}>
              {[
                { v: 'male', l: 'Homme', i: 'male' },
                { v: 'female', l: 'Femme', i: 'female' }
              ].map(opt => {
                const active = gender === opt.v;
                return (
                  <TouchableOpacity
                    key={opt.v}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGender(opt.v as any);
                    }}
                    style={[p.genderBtn, active && p.genderBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={opt.i as any} size={18} color={active ? '#000' : C.textSub} />
                    <Text style={[p.genderLabel, active && p.genderLabelActive]}>{opt.l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Field
            label="Poids actuel"
            value={weight}
            onChange={setWeight}
            placeholder="75"
            suffix="kg"
            icon="scale-outline"
            disabled={isWeightSynced}
            hint={isWeightSynced ? "Synchro auto car saisi aujourd'hui" : "Saisis ton poids du jour"}
          />
          <Field label="Taille" value={height} onChange={setHeight} placeholder="175" suffix="cm" icon="resize-outline" hint="Utilisé pour le calcul de l'IMC" />
          <Field label="Âge actuel" value={age} onChange={setAge} placeholder="30" suffix="ans" icon="calendar-outline" />
          <Field label="Poids cible" value={goalWeight} onChange={setGoalWeight} placeholder="70" suffix="kg" icon="flag-outline" hint="Ton objectif de perte de poids" />

          <ActivityGrid value={activity} onChange={setActivity} />

          {/* Deficit Section */}
          <View style={{ marginBottom: 30 }}>
            <View style={f.labelRow}>
              <Ionicons name="flame-outline" size={14} color={C.textMuted} />
              <Text style={f.label}>Vitesse de perte de poids</Text>
            </View>
            <View style={p.defGrid}>
              {[
                { v: 'light', l: 'Doux', d: '-250', i: 'leaf-outline' },
                { v: 'standard', l: 'Normal', d: '-500', i: 'flash-outline' },
                { v: 'intense', l: 'Intense', d: '-750', i: 'flame-outline' },
              ].map(opt => {
                const active = deficit === opt.v;
                return (
                  <TouchableOpacity
                    key={opt.v}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDeficit(opt.v as any);
                    }}
                    style={[p.defCard, active && p.defCardActive]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={opt.i as any} size={16} color={active ? '#000' : C.textSub} />
                    <Text style={[p.defLabel, active && p.defLabelActive]}>{opt.l}</Text>
                    <Text style={[p.defSub, active && p.defSubActive]}>{opt.d} kcal</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <AnimatedBtn style={[p.saveBtn, saved && p.saveBtnDone]} onPress={save}>
            <Text style={p.saveBtnLabel}>{saved ? 'Enregistré ✨' : 'Sauvegarder les modifications'}</Text>
          </AnimatedBtn>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  heading: { color: C.text, fontSize: 17, fontWeight: '800' },
  scroll: { paddingHorizontal: 20 },

  genderGrid: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 58, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  genderBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  genderLabel: { color: C.textSub, fontSize: 14, fontWeight: '700' },
  genderLabelActive: { color: '#000' },

  defGrid: { flexDirection: 'row', gap: 10 },
  defCard: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, gap: 4 },
  defCardActive: { backgroundColor: C.accent, borderColor: C.accent },
  defLabel: { color: C.text, fontSize: 13, fontWeight: '800' },
  defLabelActive: { color: '#000' },
  defSub: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  defSubActive: { color: 'rgba(0,0,0,0.5)' },

  saveBtn: {
    height: 60, borderRadius: 22, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDone: { backgroundColor: C.green },
  saveBtnLabel: { color: '#000', fontSize: 16, fontWeight: '900' },
});