import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Dimensions, ScrollView as RNScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  getAllDays, DayEntry, formatDate, getDayScore,
  todayString, exportAllData, importAllData,
  getProfile, UserProfile,
} from '../utils/storage';
import { initHealth } from '../utils/health';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  border: '#1E1E1E',
  borderSub: '#242424',
  accent: '#E8F97D',
  text: '#F2F2F2',
  textSub: '#888',
  textMuted: '#444',
  green: '#34d399',
  red: '#f87171',
  blue: '#60a5fa',
  orange: '#fb923c',
  purple: '#a78bfa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
const CELL = 13;
const CELL_GAP = 3;
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const DOW_LABELS = ['L', '', 'M', '', 'V', '', 'D'];

function cellColor(score: number): string {
  if (score === -2) return 'transparent';
  if (score <= 0) return '#1E1E1E';
  if (score < 40) return '#7a3838';
  if (score < 75) return '#b8d44a';
  return C.green;
}

function WeekHeatmap({ days, profile }: { days: DayEntry[]; profile: UserProfile | null }) {
  const scrollRef = useRef<RNScrollView>(null);
  const today = todayString();

  const startDate = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setMonth(d.getMonth() - 11);
    d.setDate(1);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    return getMonday(ds);
  })();

  const weeks: { date: string; score: number }[][] = [];
  let cur = startDate;
  while (cur <= today) {
    const week: { date: string; score: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dayStr = offsetDate(cur, d);
      if (dayStr > today) {
        week.push({ date: dayStr, score: -2 });
      } else {
        const entry = days.find(e => e.date === dayStr);
        week.push({ date: dayStr, score: entry ? getDayScore(entry, profile?.goal) : -1 });
      }
    }
    weeks.push(week);
    cur = offsetDate(cur, 7);
  }

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
  }, [weeks.length]);

  let lastMonth = -1;
  const monthLabels: (string | null)[] = weeks.map(week => {
    const m = new Date(week[0].date + 'T00:00:00').getMonth();
    if (m !== lastMonth) { lastMonth = m; return MONTHS_FR[m]; }
    return null;
  });

  return (
    <View style={wh.card}>
      <Text style={wh.title}>Consistance</Text>
      <View style={wh.wrap}>
        {/* Jours fixes gauche */}
        <View style={wh.dowCol}>
          <View style={{ height: 16 }} />
          {DOW_LABELS.map((label, i) => (
            <View key={i} style={wh.dowCell}>
              <Text style={wh.dowTxt}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Semaines scrollables */}
        <RNScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <View>
            {/* Labels mois */}
            <View style={wh.monthRow}>
              {weeks.map((_, wi) => (
                <View key={wi} style={{ width: CELL, marginRight: CELL_GAP }}>
                  {monthLabels[wi] ? (
                    <Text style={wh.monthTxt}>{monthLabels[wi]}</Text>
                  ) : null}
                </View>
              ))}
            </View>
            {/* Grille */}
            <View style={wh.grid}>
              {weeks.map((week, wi) => (
                <View key={wi} style={wh.weekCol}>
                  {week.map(({ date, score }) => (
                    <View
                      key={date}
                      style={[
                        wh.cell,
                        { backgroundColor: cellColor(score) },
                        date === today && wh.cellToday,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </RNScrollView>
      </View>

      {/* Légende */}
      <View style={wh.legend}>
        <Text style={wh.legLbl}>Moins</Text>
        {['#1E1E1E', '#7a3838', '#b8d44a', C.green].map(c => (
          <View key={c} style={[wh.legCell, { backgroundColor: c }]} />
        ))}
        <Text style={wh.legLbl}>Plus</Text>
      </View>
    </View>
  );
}

const wh = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden',
  },
  title: {
    color: C.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  wrap: { flexDirection: 'row', gap: 8 },
  dowCol: { flexDirection: 'column', gap: CELL_GAP },
  dowCell: { height: CELL, justifyContent: 'center' },
  dowTxt: { color: '#333', fontSize: 8, fontWeight: '700' },
  monthRow: { flexDirection: 'row', marginBottom: 4, height: 12 },
  monthTxt: { color: '#333', fontSize: 8, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: CELL_GAP },
  weekCol: { flexDirection: 'column', gap: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  cellToday: { borderWidth: 1.5, borderColor: C.text },
  legend: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  legLbl: { color: C.textMuted, fontSize: 9, fontWeight: '600', marginHorizontal: 2 },
  legCell: { width: CELL, height: CELL, borderRadius: 3 },
});

// ─── Summary Dashboard ────────────────────────────────────────────────────────
function SummaryDashboard({ days, profile }: { days: DayEntry[]; profile: UserProfile | null }) {
  const today = todayString();
  const last7 = Array.from({ length: 7 }, (_, i) => offsetDate(today, -i));
  const recent = days.filter(d => last7.includes(d.date));

  const avgScore = recent.length > 0
    ? Math.round(recent.reduce((s, d) => s + getDayScore(d, profile?.goal), 0) / 7)
    : 0;
  const avgWater = recent.length > 0
    ? (recent.reduce((s, d) => s + d.water, 0) / 7).toFixed(1)
    : '0.0';
  const avgCals = recent.length > 0
    ? Math.round(recent.reduce((s, d) => s + (d.calories || 0), 0) / 7)
    : 0;
  const avgSteps = recent.length > 0
    ? Math.round(recent.reduce((s, d) => s + (d.steps || 0), 0) / 7)
    : 0;

  // Cherche les 2 dernières pesées dans tout l'historique (pas juste la semaine)
  const allWeighed = days.filter(d => d.weight).sort((a, b) => a.date.localeCompare(b.date));
  const wDiff = allWeighed.length >= 2
    ? allWeighed[allWeighed.length - 1].weight! - allWeighed[allWeighed.length - 2].weight!
    : null;

  const scoreColor = avgScore >= 75 ? C.green : avgScore >= 40 ? C.accent : C.red;

  return (
    <View style={sd.card}>
      <View style={sd.hero}>
        <Text style={[sd.heroVal, { color: scoreColor }]}>{avgScore}</Text>
        <View>
          <Text style={sd.heroLabel}>Score moyen</Text>
          <Text style={sd.heroSub}>Dernière semaine</Text>
        </View>
      </View>

      <View style={sd.grid}>
        {avgSteps > 0 && (
          <View style={sd.item}>
            <Ionicons name="walk" size={13} color={C.green} />
            <Text style={sd.val}>{(avgSteps / 1000).toFixed(1)}k</Text>
            <Text style={sd.lbl}>Pas</Text>
          </View>
        )}
        {avgCals > 0 && (
          <View style={sd.item}>
            <Ionicons name="nutrition-outline" size={13} color={C.orange} />
            <Text style={sd.val}>{avgCals.toLocaleString()}</Text>
            <Text style={sd.lbl}>Kcal</Text>
          </View>
        )}
        <View style={sd.item}>
          <Ionicons name="water" size={13} color={C.blue} />
          <Text style={sd.val}>{avgWater}</Text>
          <Text style={sd.lbl}>Eau</Text>
        </View>
        {wDiff !== null && (
          <View style={sd.item}>
            <Ionicons
              name={wDiff <= 0 ? 'trending-down' : 'trending-up'}
              size={13}
              color={wDiff <= 0 ? C.green : C.red}
            />
            <Text style={[sd.val, { color: wDiff <= 0 ? C.green : C.red }]}>
              {wDiff > 0 ? '+' : ''}{wDiff.toFixed(1)}
            </Text>
            <Text style={sd.lbl}>kg</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const sd = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroVal: { fontSize: 52, fontWeight: '900', letterSpacing: -2 },
  heroLabel: { color: C.text, fontSize: 15, fontWeight: '800' },
  heroSub: { color: C.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderTopWidth: 1, borderTopColor: C.borderSub, paddingTop: 14,
  },
  item: { alignItems: 'center', gap: 4 },
  val: { color: C.text, fontSize: 14, fontWeight: '800' },
  lbl: { color: C.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
});

// ─── Mini Stats ───────────────────────────────────────────────────────────────
function MiniStats({ days }: { days: DayEntry[] }) {
  const activeDays = days.filter(d => d.walk).length;
  const withNotes = days.filter(d => d.note).length;
  const withSleep = days.filter(d => d.sleep && d.sleep > 0).length;
  const avgSleep = withSleep > 0
    ? (days.filter(d => d.sleep).reduce((s, d) => s + d.sleep!, 0) / withSleep).toFixed(1)
    : null;

  const items = [
    { icon: 'walk' as const, val: String(activeDays), lbl: 'Actifs', color: C.green },
    { icon: 'moon' as const, val: avgSleep ? `${avgSleep}h` : '–', lbl: 'Sommeil', color: C.purple },
    { icon: 'create-outline' as const, val: String(withNotes), lbl: 'Notes', color: C.accent },
    { icon: 'calendar-outline' as const, val: String(days.length), lbl: 'Total', color: C.textSub },
  ];

  return (
    <View style={ms.row}>
      {items.map(({ icon, val, lbl, color }) => (
        <View key={lbl} style={ms.item}>
          <Ionicons name={icon} size={12} color={color} />
          <Text style={ms.val}>{val}</Text>
          <Text style={ms.lbl}>{lbl}</Text>
        </View>
      ))}
    </View>
  );
}

const ms = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  item: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 10, alignItems: 'center', gap: 4,
  },
  val: { color: C.text, fontSize: 14, fontWeight: '800' },
  lbl: { color: C.textMuted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
});

// ─── Day Card compact ─────────────────────────────────────────────────────────
function DayCard({ entry, goal }: { entry: DayEntry; goal?: number }) {
  const score = getDayScore(entry, goal);
  const scoreColor = score >= 75 ? C.green : score >= 40 ? C.accent : C.red;
  const steps = entry.steps || 0;

  return (
    <View style={dc.row}>
      <View style={[dc.scoreCircle, { borderColor: scoreColor + '44' }]}>
        <Text style={[dc.scoreNum, { color: scoreColor }]}>{score}</Text>
      </View>
      <View style={dc.info}>
        <Text style={dc.date} numberOfLines={1}>{formatDate(entry.date)}</Text>
        <View style={dc.chips}>
          {steps > 0 && (
            <View style={dc.chip}>
              <Text style={[dc.chipTxt, { color: C.green }]}>
                {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps} pas
              </Text>
            </View>
          )}
          {(entry.calories ?? 0) > 0 && (
            <View style={dc.chip}>
              <Text style={[dc.chipTxt, { color: C.orange }]}>{entry.calories!.toLocaleString()} kcal</Text>
            </View>
          )}
          {entry.water > 0 && (
            <View style={dc.chip}>
              <Text style={[dc.chipTxt, { color: C.blue }]}>{entry.water}/8</Text>
            </View>
          )}
          {!!entry.sleep && (
            <View style={dc.chip}>
              <Text style={[dc.chipTxt, { color: C.purple }]}>
                {Math.floor(entry.sleep)}h{Math.round((entry.sleep % 1) * 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          {!!entry.weight && (
            <View style={dc.chip}>
              <Text style={[dc.chipTxt, { color: C.textSub }]} numberOfLines={1}>
                {entry.weight.toFixed(1)} kg
              </Text>
            </View>
          )}
        </View>
        {entry.note ? (
          <Text style={dc.note} numberOfLines={1}>{entry.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  scoreCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  scoreNum: { fontSize: 12, fontWeight: '900' },
  info: { flex: 1, minWidth: 0 },
  date: {
    color: C.text, fontSize: 12, fontWeight: '700',
    textTransform: 'capitalize', marginBottom: 4,
  },
  chips: { flexDirection: 'row', gap: 4, overflow: 'hidden' },
  chip: {
    backgroundColor: C.surface, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0,
  },
  chipTxt: { fontSize: 10, fontWeight: '700' },
  note: { color: C.textMuted, fontSize: 10, fontStyle: 'italic', marginTop: 3 },
});

// ─── History List ─────────────────────────────────────────────────────────────
function HistoryList({ days, goal }: { days: DayEntry[]; goal?: number }) {
  if (days.length === 0) {
    return (
      <View style={hl.empty}>
        <Ionicons name="leaf-outline" size={40} color={C.textMuted} />
        <Text style={hl.emptyTxt}>Ton parcours commence ici</Text>
        <Text style={hl.emptySub}>Commence à tracker aujourd'hui.</Text>
      </View>
    );
  }
  return (
    <View style={hl.list}>
      {days.map(entry => (
        <DayCard key={entry.date} entry={entry} goal={goal} />
      ))}
    </View>
  );
}

const hl = StyleSheet.create({
  list: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 14, overflow: 'hidden',
  },
  empty: {
    alignItems: 'center', paddingVertical: 50,
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
  },
  emptyTxt: { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 14 },
  emptySub: { color: C.textMuted, fontSize: 12, marginTop: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<DayEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadData = useCallback(async () => {
    const [allDays, p] = await Promise.all([getAllDays(), getProfile()]);
    setDays(allDays);
    setProfile(p);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleExport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const data = await exportAllData();
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, data);
      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'exporter les données.');
    }
  };

  const handleImport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (!result.canceled && result.assets[0]) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        await importAllData(content);
        Alert.alert('Succès', 'Données importées !', [{ text: 'OK', onPress: loadData }]);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'importer le fichier.');
    }
  };

  const handleConnectHealth = async () => {
    try {
      await initHealth();
      Alert.alert('Santé connectée', 'Les données seront synchronisées automatiquement.');
    } catch {
      Alert.alert('Erreur', 'Impossible de se connecter à Apple Santé.');
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.heading}>Bilan</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Profile');
          }}
          style={s.settingsBtn}
        >
          <Ionicons name="settings-outline" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <SummaryDashboard days={days} profile={profile} />
        <MiniStats days={days} />
        <WeekHeatmap days={days} profile={profile} />

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Historique</Text>
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{days.length} jours</Text>
          </View>
        </View>

        <HistoryList days={days} goal={profile?.goal} />

        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={handleExport}>
            <Ionicons name="cloud-upload-outline" size={16} color={C.accent} />
            <Text style={s.actionLbl}>Sauvegarder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleImport}>
            <Ionicons name="cloud-download-outline" size={16} color={C.text} />
            <Text style={s.actionLbl}>Restaurer</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.healthBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleConnectHealth();
          }}
        >
          <Ionicons name="heart" size={16} color="#000" />
          <Text style={s.healthLbl}>Connecter Apple Santé</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  heading: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -1.2 },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  badge: {
    backgroundColor: C.surface, paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  badgeTxt: { color: C.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.card, height: 46, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  actionLbl: { color: C.text, fontSize: 13, fontWeight: '700' },
  healthBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.accent, height: 50, borderRadius: 16, marginTop: 10,
  },
  healthLbl: { color: '#000', fontSize: 14, fontWeight: '900' },
});