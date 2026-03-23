import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { getProfile } from '../utils/storage';
import * as Haptics from 'expo-haptics';
import {
  getWeightHistory, getBodyFatHistory,
  getBMIHistory, getLeanBodyMassHistory,
} from '../utils/health';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;
const CHART_H = 180;
const PAD = { l: 40, r: 16, t: 12, b: 32 };
const PLOT_W = CHART_W - PAD.l - PAD.r;
const PLOT_H = CHART_H - PAD.t - PAD.b;

const C = {
  bg: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  cardAlt: '#131313',
  border: '#1E1E1E',
  borderSub: '#161616',
  accent: '#E8F97D',
  accentDim: 'rgba(232,249,125,0.10)',
  text: '#F2F2F2',
  textSub: '#666',
  textMuted: '#333',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.10)',
  red: '#f87171',
  redDim: 'rgba(248,113,113,0.10)',
  blue: '#60a5fa',
  blueDim: 'rgba(96,165,250,0.10)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167,139,250,0.10)',
  orange: '#fb923c',
  orangeDim: 'rgba(251,146,60,0.10)',
};

type DataPoint = { date: string; value: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function niceRange(vals: number[]): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.18 || 0.5;
  const min = Math.floor((lo - pad) * 10) / 10;
  const max = Math.ceil((hi + pad) * 10) / 10;
  const step = parseFloat(((max - min) / 4).toFixed(1));
  const ticks = [0, 1, 2, 3, 4].map(i => parseFloat((min + step * i).toFixed(1)));
  return { min, max, ticks };
}

function project(val: number, min: number, max: number, idx: number, total: number) {
  const x = PAD.l + (idx / Math.max(total - 1, 1)) * PLOT_W;
  const y = PAD.t + PLOT_H - ((val - min) / (max - min)) * PLOT_H;
  return { x, y };
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    d += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function areaPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${last.x} ${PAD.t + PLOT_H} L ${first.x} ${PAD.t + PLOT_H} Z`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function delta(data: DataPoint[]): number | null {
  if (data.length < 2) return null;
  return data[data.length - 1].value - data[0].value;
}

// ─── Period selector ──────────────────────────────────────────────────────────
const PERIODS = [
  { label: '7j', days: 7 },
  { label: '30j', days: 30 },
  { label: '90j', days: 90 },
];

// ─── Area Chart ───────────────────────────────────────────────────────────────
function AreaChart({
  data,
  color,
  gradId,
  unit,
  decimals = 1,
  invertDelta = false,
}: {
  data: DataPoint[];
  color: string;
  gradId: string;
  unit: string;
  decimals?: number;
  invertDelta?: boolean;
}) {
  if (data.length < 2) {
    return (
      <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>Pas assez de données</Text>
      </View>
    );
  }

  const vals = data.map(d => d.value);
  const { min, max, ticks } = niceRange(vals);
  const pts = data.map((d, i) => project(d.value, min, max, i, data.length));
  const linePath = smoothPath(pts);
  const fillPath = areaPath(pts);

  // Tick labels every ~N points on x-axis
  const xLabelCount = Math.min(data.length, 5);
  const xIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / (xLabelCount - 1)) * (data.length - 1))
  );

  // Last point highlight
  const last = pts[pts.length - 1];
  const lastVal = vals[vals.length - 1];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </LinearGradient>
      </Defs>

      {/* Y-axis grid lines + labels */}
      {ticks.map((tick, i) => {
        const y = PAD.t + PLOT_H - ((tick - min) / (max - min)) * PLOT_H;
        return (
          <G key={i}>
            <Line
              x1={PAD.l} y1={y} x2={PAD.l + PLOT_W} y2={y}
              stroke={C.border} strokeWidth={0.5}
              strokeDasharray={i === 0 ? undefined : '0'}
            />
            <SvgText
              x={PAD.l - 6} y={y + 4}
              fontSize={9} fill={C.textMuted}
              textAnchor="end"
            >
              {tick.toFixed(decimals)}
            </SvgText>
          </G>
        );
      })}

      {/* X-axis labels */}
      {xIndices.map((idx) => {
        const p = pts[idx];
        return (
          <SvgText
            key={idx}
            x={p.x} y={CHART_H - 4}
            fontSize={9} fill={C.textMuted}
            textAnchor="middle"
          >
            {fmtDate(data[idx].date)}
          </SvgText>
        );
      })}

      {/* Area fill */}
      <Path d={fillPath} fill={`url(#${gradId})`} />

      {/* Line */}
      <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Last point dot + callout */}
      <Circle cx={last.x} cy={last.y} r={5} fill={C.bg} stroke={color} strokeWidth={2} />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />

      {/* Value callout above last point */}
      <SvgText
        x={last.x} y={last.y - 10}
        fontSize={11} fill={color}
        fontWeight="700"
        textAnchor={last.x > CHART_W - 60 ? 'end' : 'middle'}
      >
        {lastVal.toFixed(decimals)}{unit}
      </SvgText>
    </Svg>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({
  title, subtitle, value, unit, data, color, gradId,
  decimals = 1, delta: d, invertDelta = false,
  children,
}: {
  title: string; subtitle?: string;
  value: string; unit: string;
  data: DataPoint[]; color: string; gradId: string;
  decimals?: number; delta?: number | null;
  invertDelta?: boolean;
  children?: React.ReactNode;
}) {
  const positive = d !== null && d !== undefined ? (invertDelta ? d <= 0 : d >= 0) : null;
  const deltaColor = positive === null ? C.textMuted : positive ? C.green : C.red;
  const deltaIcon = d === null || d === undefined ? null : (invertDelta ? (d <= 0 ? 'arrow-down' : 'arrow-up') : (d >= 0 ? 'arrow-up' : 'arrow-down'));

  return (
    <View style={cc.card}>
      <View style={cc.header}>
        <View style={{ flex: 1 }}>
          <Text style={cc.title}>{title}</Text>
          {subtitle && <Text style={cc.sub}>{subtitle}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            <Text style={[cc.val, { color }]}>{value}</Text>
            <Text style={cc.unit}>{unit}</Text>
          </View>
          {d !== null && d !== undefined && (
            <View style={[cc.deltaBadge, { backgroundColor: deltaColor + '18' }]}>
              <Ionicons name={deltaIcon as any} size={10} color={deltaColor} />
              <Text style={[cc.deltaText, { color: deltaColor }]}>
                {Math.abs(d).toFixed(decimals)}{unit}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={cc.chartWrap}>
        <AreaChart data={data} color={color} gradId={gradId} unit={unit} decimals={decimals} />
      </View>
      {children}
    </View>
  );
}

const cc = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title: { color: C.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  sub: { color: C.textSub, fontSize: 11, fontWeight: '500', marginTop: 2 },
  val: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  unit: { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  deltaText: { fontSize: 11, fontWeight: '700' },
  chartWrap: { marginHorizontal: -4 },
});

// ─── Composition Bar ──────────────────────────────────────────────────────────
function CompositionBar({ fat, lean, weight }: { fat?: number; lean?: number; weight?: number }) {
  if (!fat || !weight) return null;
  const fatKg = weight * (fat / 100);
  const leanKg = lean || weight - fatKg;
  const fatPct = (fatKg / weight) * 100;
  const leanPct = (leanKg / weight) * 100;

  return (
    <View style={cb.wrap}>
      <View style={cb.bar}>
        <View style={[cb.seg, { flex: fatPct, backgroundColor: C.orange }]} />
        <View style={[cb.seg, { flex: leanPct, backgroundColor: C.green }]} />
      </View>
      <View style={cb.legend}>
        <View style={cb.legItem}>
          <View style={[cb.dot, { backgroundColor: C.orange }]} />
          <Text style={cb.legLabel}>Graisse</Text>
          <Text style={cb.legVal}>{fatKg.toFixed(1)} kg</Text>
        </View>
        <View style={cb.legItem}>
          <View style={[cb.dot, { backgroundColor: C.green }]} />
          <Text style={cb.legLabel}>Masse maigre</Text>
          <Text style={cb.legVal}>{leanKg.toFixed(1)} kg</Text>
        </View>
      </View>
    </View>
  );
}

const cb = StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  seg: { height: '100%' },
  legend: { flexDirection: 'row', justifyContent: 'space-around' },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legLabel: { color: C.textSub, fontSize: 12, fontWeight: '500' },
  legVal: { color: C.text, fontSize: 12, fontWeight: '700' },
});

// ─── BMI Gauge ────────────────────────────────────────────────────────────────
function BMIGauge({ bmi }: { bmi: number }) {
  const zones = [
    { label: 'Insuffisant', max: 18.5, color: C.blue },
    { label: 'Normal', max: 25, color: C.green },
    { label: 'Surpoids', max: 30, color: C.orange },
    { label: 'Obésité', max: 40, color: C.red },
  ];
  const clamp = Math.max(15, Math.min(40, bmi));
  const pct = ((clamp - 15) / 25) * 100;
  const zone = zones.find(z => bmi < z.max) || zones[zones.length - 1];

  return (
    <View style={bg2.wrap}>
      <View style={bg2.barRow}>
        {zones.map((z, i) => (
          <View key={i} style={[bg2.seg, { backgroundColor: z.color + '30', flex: z.max - (zones[i - 1]?.max || 15) }]} />
        ))}
        {/* Needle */}
        <View style={[bg2.needle, { left: `${pct}%` as any }]} />
      </View>
      <View style={bg2.labels}>
        {zones.map((z, i) => (
          <Text key={i} style={[bg2.zLabel, { flex: z.max - (zones[i - 1]?.max || 15) }]}>{z.label}</Text>
        ))}
      </View>
      <View style={bg2.result}>
        <Text style={[bg2.bmiVal, { color: zone.color }]}>{bmi.toFixed(1)}</Text>
        <Text style={[bg2.bmiZone, { color: zone.color }]}>{zone.label}</Text>
      </View>
    </View>
  );
}

const bg2 = StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  barRow: { height: 10, flexDirection: 'row', borderRadius: 5, overflow: 'visible', marginBottom: 6, position: 'relative' },
  seg: { height: '100%' },
  needle: { position: 'absolute', top: -4, width: 3, height: 18, backgroundColor: C.text, borderRadius: 2, marginLeft: -1.5 },
  labels: { flexDirection: 'row', marginBottom: 10 },
  zLabel: { color: C.textMuted, fontSize: 8, fontWeight: '600', textAlign: 'center' },
  result: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bmiVal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  bmiZone: { fontSize: 13, fontWeight: '600' },
});

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={sr.row}>
      <Text style={sr.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={[sr.value, { color }]}>{value}</Text>
        <Text style={sr.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { color: C.textSub, fontSize: 13, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  unit: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EvolutionScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState(30);
  const [weightData, setWeightData] = useState<DataPoint[]>([]);
  const [fatData, setFatData] = useState<DataPoint[]>([]);
  const [bmiData, setBmiData] = useState<DataPoint[]>([]);
  const [leanData, setLeanData] = useState<DataPoint[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const load = useCallback(async () => {
    const [wH, fH, bH, lH, p] = await Promise.all([
      getWeightHistory(period),
      getBodyFatHistory(period),
      getBMIHistory(period),
      getLeanBodyMassHistory(period),
      getProfile(),
    ]);
    const sort = (a: DataPoint[]) => [...a].sort((x, y) => x.date.localeCompare(y.date));
    setWeightData(sort(wH));
    setFatData(sort(fH));
    setBmiData(sort(bH));
    setLeanData(sort(lH));
    setProfile(p);
  }, [period]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const currentW = weightData[weightData.length - 1]?.value;
  const currentFat = fatData[fatData.length - 1]?.value;
  const currentLean = leanData[leanData.length - 1]?.value;
  const bmi = currentW && profile?.height
    ? currentW / Math.pow(profile.height / 100, 2)
    : bmiData[bmiData.length - 1]?.value;

  const dW = delta(weightData);
  const dFat = delta(fatData);
  const dLean = delta(leanData);

  // Min/Max weight in period
  const wVals = weightData.map(d => d.value);
  const wMin = wVals.length ? Math.min(...wVals) : null;
  const wMax = wVals.length ? Math.max(...wVals) : null;
  const wAvg = wVals.length ? wVals.reduce((a, b) => a + b, 0) / wVals.length : null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.heading}>Évolution</Text>
          <Text style={s.subheading}>Composition corporelle</Text>
        </View>

        {/* ── Period Picker ── */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.days}
              style={[s.periodBtn, period === p.days && s.periodBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPeriod(p.days);
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.periodLabel, period === p.days && s.periodLabelActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Poids ── */}
        <ChartCard
          title="Poids"
          subtitle={`${period} derniers jours`}
          value={currentW?.toFixed(1) || '--'}
          unit=" kg"
          data={weightData}
          color={C.accent}
          gradId="wGrad"
          delta={dW}
          invertDelta
        >
          {/* Stats row sous le graphe */}
          {wMin && wMax && wAvg ? (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
              <StatRow label="Minimum" value={wMin.toFixed(1)} unit="kg" color={C.green} />
              <StatRow label="Maximum" value={wMax.toFixed(1)} unit="kg" color={C.red} />
              <StatRow label="Moyenne" value={wAvg.toFixed(1)} unit="kg" color={C.textSub} />
            </View>
          ) : null}
        </ChartCard>

        {/* ── Masse grasse ── */}
        <ChartCard
          title="Masse grasse"
          value={currentFat?.toFixed(1) || '--'}
          unit="%"
          data={fatData}
          color={C.orange}
          gradId="fGrad"
          delta={dFat}
          invertDelta
        >
          <CompositionBar fat={currentFat} lean={currentLean} weight={currentW} />
        </ChartCard>

        {/* ── IMC ── */}
        {bmi ? (
          <View style={cc.card}>
            <View style={cc.header}>
              <View style={{ flex: 1 }}>
                <Text style={cc.title}>IMC</Text>
                {profile?.height && (
                  <Text style={cc.sub}>Calculé pour {profile.height} cm</Text>
                )}
              </View>
            </View>
            <BMIGauge bmi={bmi} />
            {bmiData.length > 1 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '600', marginBottom: 8 }}>
                  HISTORIQUE
                </Text>
                <AreaChart data={bmiData} color={C.blue} gradId="bGrad" unit="" decimals={1} />
              </View>
            )}
          </View>
        ) : null}

        {/* ── Masse maigre ── */}
        {leanData.length > 0 && (
          <ChartCard
            title="Masse maigre"
            subtitle="Muscles + os + eau"
            value={currentLean?.toFixed(1) || '--'}
            unit=" kg"
            data={leanData}
            color={C.green}
            gradId="lGrad"
            delta={dLean}
          />
        )}

        {/* ── Résumé ── */}
        {currentW && currentFat && bmi ? (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Résumé</Text>
            <StatRow label="Poids" value={currentW.toFixed(1)} unit="kg" color={C.accent} />
            <StatRow label="IMC" value={bmi.toFixed(1)} unit="" color={C.blue} />
            <StatRow label="Masse grasse" value={currentFat.toFixed(1)} unit="%" color={C.orange} />
            {currentLean && <StatRow label="Masse maigre" value={currentLean.toFixed(1)} unit="kg" color={C.green} />}
            {currentW && currentFat && (
              <StatRow
                label="Graisse totale"
                value={(currentW * currentFat / 100).toFixed(1)}
                unit="kg"
                color={C.red}
              />
            )}
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  header: { paddingTop: 16, marginBottom: 20 },
  heading: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  subheading: { color: C.textSub, fontSize: 13, fontWeight: '500', marginTop: 3 },

  periodRow: {
    flexDirection: 'row', gap: 8, marginBottom: 20,
    backgroundColor: C.surface, borderRadius: 14,
    padding: 4, borderWidth: 1, borderColor: C.border,
  },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodBtnActive: { backgroundColor: C.card },
  periodLabel: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  periodLabelActive: { color: C.text },

  summaryCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 20,
    marginBottom: 14, borderWidth: 1, borderColor: C.border,
  },
  summaryTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
});