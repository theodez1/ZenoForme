// SleepScreen.tsx
// Swipe natif paginé (FlatList) + sélecteur de date identique à HomeScreen

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
  TouchableOpacity, ActivityIndicator, FlatList,
  Animated, Modal, Pressable, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSleepDetails, calculateSleepScore } from '../utils/health';
import {
  SleepStagesChart,
  SleepStagesLegend,
  buildSamplesFromDurations,
  SleepSample,
} from '../components/SleepStagesChart';

const { width: SCREEN_W } = Dimensions.get('window');
const PRELOAD_RADIUS = 2;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0A0A0A',
  surface:   '#111111',
  card:      '#161616',
  border:    '#1E1E1E',
  accent:    '#E8F97D',
  text:      '#F2F2F2',
  textSub:   '#888',
  textMuted: '#3A3A3A',
  green:     '#34d399',
  red:       '#f87171',
  orange:    '#fb923c',
  blue:      '#60a5fa',
  purple:    '#a78bfa',
};

// ─── Date Utils ───────────────────────────────────────────────────────────────
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

function getDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Aujourd'hui";
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round(
    (new Date(todayStr + 'T00:00:00').getTime() - d.getTime()) / 86400000,
  );
  if (diff === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function minsToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
function hoursToLabel(h: number): string { return minsToLabel(Math.round(h * 60)); }

// ─── Score ────────────────────────────────────────────────────────────────────
// Utilise la fonction partagée pour cohérence avec le score global
function calcScore(core: number, deep: number, rem: number, awake: number) {
  const score = calculateSleepScore(core, deep, rem, awake);
  if (score >= 85) return { score, label: 'Excellent', color: C.green };
  if (score >= 70) return { score, label: 'Bon', color: C.accent };
  if (score >= 50) return { score, label: 'Moyen', color: C.orange };
  return { score, label: 'À améliorer', color: C.red };
}

// ─── Info Modal ───────────────────────────────────────────────────────────────
function InfoModal({ visible, title, body, onClose }: {
  visible: boolean; title: string; body: string; onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={im.overlay} onPress={onClose}>
        <Pressable style={im.box}>
          <Text style={im.title}>{title}</Text>
          <Text style={im.body}>{body}</Text>
          <TouchableOpacity onPress={onClose} style={im.btn} activeOpacity={0.7}>
            <Text style={im.btnTxt}>Fermer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const im = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  box: { backgroundColor: '#1C1C1E', borderRadius: 22, padding: 24, width: '100%', borderWidth: 1, borderColor: '#2C2C2E' },
  title: { color: '#F2F2F2', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  body: { color: '#999', fontSize: 14, lineHeight: 22 },
  btn: { marginTop: 20, alignSelf: 'center', backgroundColor: '#2C2C2E', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 11 },
  btnTxt: { color: '#F2F2F2', fontSize: 14, fontWeight: '600' },
});

// ─── ⓘ Button ─────────────────────────────────────────────────────────────────
function IBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.5} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: C.textMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '800' }}>i</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Stage Row ────────────────────────────────────────────────────────────────
function StageRow({ label, value, pct, color, onInfo }: {
  label: string; value: number; pct: number; color: string; onInfo: () => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: color }} />
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
          <IBtn onPress={onInfo} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{hoursToLabel(value)}</Text>
          <Text style={{ color: C.textSub, fontSize: 12 }}>{pct.toFixed(0)}%</Text>
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: 2, opacity: 0.85 }} />
      </View>
    </View>
  );
}

// ─── Info Content ─────────────────────────────────────────────────────────────
const INFO: Record<string, { title: string; body: string }> = {
  score: { title: 'Score de sommeil', body: 'Calculé sur 100 pts : durée totale (40 pts), sommeil profond (30 pts), REM (20 pts), équilibre léger (10 pts). ≥ 85 = Excellent.' },
  total: { title: 'Durée totale', body: 'Durée recommandée : 7–9h pour un adulte. En dessous de 6h, la récupération physique et cognitive est significativement impactée.' },
  chart: { title: 'Hypnogramme', body: 'Visualisation des stades au fil de la nuit. Chaque barre représente un échantillon HealthKit. Le sommeil profond domine en début de nuit, le REM en fin de nuit.' },
  deep:  { title: 'Sommeil Profond', body: 'Récupération physique maximale. Idéalement 20–25% de la nuit. Favorisé par une chambre fraîche (18–20°C), sans alcool, coucher régulier.' },
  rem:   { title: 'REM (Paradoxal)', body: 'Phase des rêves — cerveau très actif. Essentiel à la mémoire et la créativité. Idéalement 20–25%. Réduit par la caféine tardive et l\'alcool.' },
  light: { title: 'Sommeil Léger', body: 'Phase de transition. Représente 50–60% d\'une nuit normale. Les micro-réveils y sont fréquents et normaux.' },
  awake: { title: 'Éveil', body: 'Micro-réveils nocturnes. Jusqu\'à 5% est normal. Au-delà, cela fragmente les cycles et réduit la qualité de récupération.' },
};

// ─── Sleep Data ───────────────────────────────────────────────────────────────
interface SleepData {
  date: string; core: number; deep: number; rem: number; awake: number; total: number;
  samples?: SleepSample[];
}

// ─── Header avec sélecteur de date (identique à HomeScreen) ──────────────────
function SleepHeader({
  activeDate, todayStr, onSelectDate,
}: {
  activeDate: string; todayStr: string; onSelectDate: (date: string) => void;
}) {
  const isToday = activeDate === todayStr;

  const changeDay = (dir: number) => {
    const next = offsetDate(activeDate, dir);
    if (next > todayStr) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectDate(next);
  };

  const label = getDateLabel(activeDate, todayStr);

  return (
    <View style={hdr.wrapper}>
      <Text style={hdr.title}>Sommeil</Text>
      <Text style={hdr.subtitle}>Analyse de ton sommeil</Text>
      <View style={hdr.dateRow}>
        <TouchableOpacity style={hdr.arrow} onPress={() => changeDay(-1)} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.textSub} />
        </TouchableOpacity>
        <View style={hdr.dateCenter}>
          <Text style={hdr.dateLabel} numberOfLines={1}>{label}</Text>
        </View>
        <TouchableOpacity
          style={[hdr.arrow, isToday && hdr.arrowDisabled]}
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

const hdr = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: C.textSub, fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  arrow: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.2 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { color: C.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, textTransform: 'capitalize' },
});

// ─── Day Page (une page par jour) ─────────────────────────────────────────────
function SleepDayPage({
  date, isActive, isPreloaded,
  onShowModal,
}: {
  date: string;
  isActive: boolean;
  isPreloaded: boolean;
  onShowModal: (key: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<SleepData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getSleepDetails(date);
      if (d) {
        const core  = d.core  || 0;
        const deep  = d.deep  || 0;
        const rem   = d.rem   || 0;
        const awake = d.awake ?? Math.max(0, (d.total || 0) * 0.05);
        const total = d.total || 0;
        const samples: SleepSample[] = d.samples && d.samples.length > 0
          ? d.samples as SleepSample[]
          : buildSamplesFromDurations(
              new Date(`${date}T23:00:00`),
              deep, rem, core, awake,
            );
        setData({ date, core, deep, rem, awake, total, samples });
      } else { setData(null); }
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => {
    if (isPreloaded) load();
  }, [isPreloaded, load]);

  useEffect(() => {
    if (isActive) load();
  }, [isActive]);

  // ── Render ──────────────────────────────────────────────────────────────────
  // Ne montre le loading que si pas de données (premier chargement)
  // Pendant le swipe, garde l'ancienne donnée visible
  if (loading && !data) {
    return (
      <View style={[pg.page, pg.center]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[pg.page, pg.center]}>
        <Ionicons name="moon-outline" size={36} color={C.textMuted} />
        <Text style={{ color: C.textSub, fontSize: 15, fontWeight: '500', marginTop: 14 }}>Aucune donnée</Text>
        <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 5, textAlign: 'center' }}>
          Pas de données de sommeil pour cette nuit.
        </Text>
      </View>
    );
  }

  const actualSleep = data.core + data.deep + data.rem;
  
  // Helper functions to calculate points for each category
  const calculateDurationPoints = (hours: number): number => {
    if (hours >= 7 && hours <= 9) return 40;
    if (hours >= 6.5) return 35;
    if (hours >= 6) return 28;
    if (hours >= 5.5) return 20;
    if (hours >= 5) return 12;
    return Math.max(0, Math.round(hours * 2));
  };
  
  const calculateDeepPoints = (ratio: number): number => {
    if (ratio >= 0.20) return 30;
    if (ratio >= 0.15) return 24;
    if (ratio >= 0.10) return 16;
    if (ratio >= 0.05) return 8;
    return Math.max(0, Math.round(ratio * 100));
  };
  
  const calculateRemPoints = (ratio: number): number => {
    if (ratio >= 0.20 && ratio <= 0.30) return 20;
    if (ratio >= 0.15) return 15;
    if (ratio >= 0.10) return 10;
    if (ratio >= 0.05) return 5;
    return Math.max(0, Math.round(ratio * 50));
  };
  
  const calculateEfficiencyPoints = (awakeRatio: number): number => {
    if (awakeRatio <= 0.05) return 10;
    if (awakeRatio <= 0.10) return 7;
    if (awakeRatio <= 0.15) return 4;
    if (awakeRatio <= 0.20) return 2;
    return 0;
  };

  const { score, label: sLabel, color: sColor } = calcScore(data.core, data.deep, data.rem, data.awake);
  const t = data.total;
  const deepR = t > 0 ? data.deep / t : 0;
  const remR  = t > 0 ? data.rem  / t : 0;

  let tip = { icon: 'checkmark-circle-outline', color: C.green,  text: 'Excellent équilibre. Maintiens cette régularité pour consolider ton rythme circadien.' };
  if      (t < 6.5)      tip = { icon: 'time-outline',       color: C.orange, text: 'Couche-toi 30 min plus tôt. La régularité de l\'heure de coucher est le levier principal.' };
  else if (deepR < 0.15) tip = { icon: 'thermometer-outline', color: C.blue,  text: 'Maintiens ta chambre à 18–20°C — la fraîcheur est le premier levier du sommeil profond.' };
  else if (remR  < 0.15) tip = { icon: 'cafe-outline',        color: C.purple,text: 'Évite la caféine après 14h et l\'alcool le soir : ils suppriment le sommeil REM.' };

  return (
    <ScrollView
      style={pg.page}
      contentContainerStyle={pg.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Score + Durée + Détail */}
      <View style={pg.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Text style={pg.metaLabel}>SCORE</Text>
              <IBtn onPress={() => onShowModal('score')} />
            </View>
            <Text style={[pg.bigNum, { color: sColor }]}>{score}</Text>
            <Text style={{ color: sColor, fontSize: 13, fontWeight: '500', marginTop: 2 }}>{sLabel}</Text>
          </View>
          <View style={{ width: 1, height: 68, backgroundColor: C.border, marginTop: 2 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Text style={pg.metaLabel}>DURÉE</Text>
              <IBtn onPress={() => onShowModal('total')} />
            </View>
            <Text style={[pg.bigNum, { fontSize: 30 }]}>{hoursToLabel(t)}</Text>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '400', marginTop: 2 }}>
              {t >= 7 && t <= 9 ? 'Durée idéale' : t < 7 ? 'Insuffisant' : 'Trop long'}
            </Text>
          </View>
        </View>
        <View style={{ height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginTop: 16 }}>
          <View style={{ height: '100%', width: `${score}%`, backgroundColor: sColor, borderRadius: 2 }} />
        </View>
        
        {/* Détail du score - 2 colonnes avec petits points */}
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
          {[
            { label: 'Temps dormi', color: C.blue, points: calculateDurationPoints(actualSleep), max: 40 },
            { label: 'Sommeil profond', color: '#0051c5', points: calculateDeepPoints(data.deep / actualSleep), max: 30 },
          ].map((item, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[pg.tinyDot, { backgroundColor: item.color }]} />
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: '500' }}>{item.label}:</Text>
              <Text style={{ color: item.points > 0 ? item.color : C.textMuted, fontSize: 10, fontWeight: '700' }}>
                {item.points}/{item.max}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {[
            { label: 'Phase rêves', color: '#bf5af2', points: calculateRemPoints(data.rem / actualSleep), max: 20 },
            { label: 'Sans réveil', color: C.green, points: calculateEfficiencyPoints(data.awake / t), max: 10 },
          ].map((item, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[pg.tinyDot, { backgroundColor: item.color }]} />
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: '500' }}>{item.label}:</Text>
              <Text style={{ color: item.points > 0 ? item.color : C.textMuted, fontSize: 10, fontWeight: '700' }}>
                {item.points}/{item.max}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Hypnogramme */}
      <View style={pg.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }}>
          <Text style={pg.metaLabel}>HYPNOGRAMME</Text>
          <IBtn onPress={() => onShowModal('chart')} />
        </View>
        <SleepStagesChart
          samples={data.samples || []}
          width={SCREEN_W - 64}
          height={140}
          showTimeAxis
        />
        <View style={{ marginTop: 14 }}>
          <SleepStagesLegend />
        </View>
      </View>

      {/* Stades */}
      <View style={pg.card}>
        <Text style={[pg.metaLabel, { marginBottom: 16 }]}>STADES</Text>
        {[
          { key: 'deep',  label: 'Profond', value: data.deep,  color: '#0051c5' },
          { key: 'rem',   label: 'REM',     value: data.rem,   color: '#bf5af2' },
          { key: 'light', label: 'Léger',   value: data.core,  color: '#0a84ff' },
          { key: 'awake', label: 'Éveil',   value: data.awake, color: '#ff6b6b' },
        ].map(st => (
          <StageRow
            key={st.key}
            label={st.label}
            value={st.value}
            pct={t > 0 ? (st.value / t) * 100 : 0}
            color={st.color}
            onInfo={() => onShowModal(st.key)}
          />
        ))}
      </View>

      {/* Conseil */}
      <View style={[pg.card, { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }]}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${tip.color}14`, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <Ionicons name={tip.icon as any} size={15} color={tip.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pg.metaLabel, { marginBottom: 5 }]}>CONSEIL</Text>
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 21 }}>{tip.text}</Text>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const pg = StyleSheet.create({
  page:      { width: SCREEN_W, flex: 1 },
  scroll:    { paddingHorizontal: 16, paddingTop: 4 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  card:      { backgroundColor: C.card, borderRadius: 22, padding: 20, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  metaLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  bigNum:    { fontSize: 42, fontWeight: '800', letterSpacing: -2, color: C.text },
  tinyDot:   { width: 6, height: 6, borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SleepScreen() {
  const insets  = useSafeAreaInsets();
  const today   = todayLocalString();

  const flatDates    = useMemo(() => buildFlatDates(today, 60), [today]);
  const todayFlatIdx = flatDates.indexOf(today);

  const [activeDate,    setActiveDate]    = useState(today);
  const [activeFlatIdx, setActiveFlatIdx] = useState(todayFlatIdx);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

  const pageRef       = useRef<FlatList>(null);
  const activeDateRef = useRef(activeDate);
  useEffect(() => { activeDateRef.current = activeDate; }, [activeDate]);

  // Sélection via les chevrons du header
  const onSelectDate = (date: string) => {
    const idx = flatDates.indexOf(date);
    if (idx < 0) return;
    setActiveDate(date);
    setActiveFlatIdx(idx);
    pageRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  // Swipe natif → synchronise le header
  const onPageSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx  = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    const date = flatDates[idx];
    if (date && date !== activeDateRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveDate(date);
      setActiveFlatIdx(idx);
    }
  };

  const showInfo = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModal(INFO[key] || null);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header avec sélecteur identique à HomeScreen */}
      <SleepHeader
        activeDate={activeDate}
        todayStr={today}
        onSelectDate={onSelectDate}
      />

      {/* FlatList paginé — swipe natif, même pattern que HomeScreen */}
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
          <SleepDayPage
            date={item}
            isActive={index === activeFlatIdx}
            isPreloaded={Math.abs(index - activeFlatIdx) <= PRELOAD_RADIUS}
            onShowModal={showInfo}
          />
        )}
        style={{ flex: 1 }}
      />

      {modal && (
        <InfoModal visible title={modal.title} body={modal.body} onClose={() => setModal(null)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});