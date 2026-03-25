// SleepStagesChart.tsx
// Reproduction fidèle de l'hypnogramme iOS Health App
// Inspiré de kirgudkov/react-native-sleep-stages
// Dépendances : react-native-svg, react-native-reanimated, react-native-gesture-handler

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Rect, Line,
  Text as SvgText,
  Defs, LinearGradient, Stop, G,
} from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

export interface SleepSample {
  stage: SleepStage;
  /** ISO-8601 string */
  startDate: string;
  endDate: string;
}

interface Props {
  /** Array of real HealthKit-style sleep samples */
  samples: SleepSample[];
  /** Chart width, defaults to screen width - 32 */
  width?: number;
  /** Chart height (excluding labels), defaults to 96 */
  height?: number;
  /** Show bottom time labels, default true */
  showTimeAxis?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER: SleepStage[] = ['awake', 'rem', 'light', 'deep'];

const STAGE_COLORS: Record<SleepStage, string> = {
  awake: '#ff6b6b',
  rem:   '#bf5af2',
  light: '#0a84ff',
  deep:  '#0051c5',
};

const STAGE_LABELS: Record<SleepStage, string> = {
  awake: 'Éveil',
  rem:   'REM',
  light: 'Léger',
  deep:  'Profond',
};

const LABEL_W = 44;
const BAR_RADIUS = 2;
// Y fraction for each stage row (0 = top, 1 = bottom)
const STAGE_Y: Record<SleepStage, number> = {
  awake: 0,
  rem:   1,
  light: 2,
  deep:  3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMs(iso: string): number {
  return new Date(iso).getTime();
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Given a list of samples, return the chart's time domain [startMs, endMs]
 */
function getTimeDomain(samples: SleepSample[]): [number, number] {
  const starts = samples.map(s => parseMs(s.startDate));
  const ends   = samples.map(s => parseMs(s.endDate));
  return [Math.min(...starts), Math.max(...ends)];
}

/**
 * Build the SVG path for a single sample bar (a flat horizontal rect as a path)
 * Each stage bar has a given row. Neighbouring same-stage samples get merged.
 */
function sampleToRect(
  sample: SleepSample,
  domainStart: number,
  domainEnd: number,
  chartW: number,
  chartH: number,
  rowH: number,
  paddingV: number,
): { x: number; y: number; w: number; h: number; color: string } {
  const range = domainEnd - domainStart;
  const x = ((parseMs(sample.startDate) - domainStart) / range) * chartW;
  const w = Math.max(2, ((parseMs(sample.endDate) - parseMs(sample.startDate)) / range) * chartW);
  const row = STAGE_Y[sample.stage];
  const y = row * rowH + paddingV;
  const h = rowH - paddingV * 2;
  return { x, y, w, h, color: STAGE_COLORS[sample.stage] };
}

// ─── SleepStagesChart ─────────────────────────────────────────────────────────

export function SleepStagesChart({
  samples,
  width = SCREEN_W - 32,
  height = 96,
  showTimeAxis = true,
}: Props) {
  if (!samples || samples.length === 0) return null;

  const chartW = width - LABEL_W;
  const rowH   = height / 4;
  const paddingV = 2;

  const [domainStart, domainEnd] = getTimeDomain(samples);
  const domainMs = domainEnd - domainStart;

  // Build tick marks for X axis (every 2 hours or so, up to 5 ticks)
  const tickCount = 5;
  const ticks: { x: number; label: string }[] = [];
  for (let i = 0; i <= tickCount; i++) {
    const ms = domainStart + (domainMs / tickCount) * i;
    const x = ((ms - domainStart) / domainMs) * chartW;
    ticks.push({ x, label: formatHour(new Date(ms)) });
  }

  return (
    <View style={{ width, overflow: 'hidden' }}>
      <Svg width={width} height={height + (showTimeAxis ? 20 : 0)}>
        <Defs>
          {/* Gradient under each row for depth */}
          {STAGE_ORDER.map(stage => (
            <LinearGradient
              key={`grad-${stage}`}
              id={`grad-${stage}`}
              x1="0" y1="0" x2="0" y2="1"
            >
              <Stop offset="0" stopColor={STAGE_COLORS[stage]} stopOpacity="0.18" />
              <Stop offset="1" stopColor={STAGE_COLORS[stage]} stopOpacity="0.04" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Y-axis labels */}
        {STAGE_ORDER.map((stage, i) => {
          const y = i * rowH + rowH / 2 + 4;
          return (
            <SvgText
              key={`label-${stage}`}
              x={0}
              y={y}
              fontSize={9}
              fontWeight="600"
              fill={STAGE_COLORS[stage]}
              opacity={0.9}
              textAnchor="start"
            >
              {STAGE_LABELS[stage]}
            </SvgText>
          );
        })}

        <G x={LABEL_W}>
          {/* Row backgrounds */}
          {STAGE_ORDER.map((stage, i) => (
            <Rect
              key={`bg-${stage}`}
              x={0} y={i * rowH + paddingV}
              width={chartW} height={rowH - paddingV * 2}
              fill={`url(#grad-${stage})`}
              rx={BAR_RADIUS}
            />
          ))}

          {/* Grid lines between rows */}
          {[1, 2, 3].map(i => (
            <Line
              key={`grid-${i}`}
              x1={0} y1={i * rowH}
              x2={chartW} y2={i * rowH}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={0.5}
            />
          ))}

          {/* Sample bars */}
          {samples.map((sample, idx) => {
            const { x, y, w, h, color } = sampleToRect(
              sample, domainStart, domainEnd, chartW, height, rowH, paddingV
            );
            return (
              <Rect
                key={`sample-${idx}`}
                x={x} y={y}
                width={w} height={h}
                fill={color}
                rx={BAR_RADIUS}
                opacity={0.9}
              />
            );
          })}

          {/* X-axis tick lines */}
          {showTimeAxis && ticks.map((tick, i) => (
            <Line
              key={`tick-${i}`}
              x1={tick.x} y1={0}
              x2={tick.x} y2={height}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
              strokeDasharray="2,4"
            />
          ))}

          {/* X-axis labels */}
          {showTimeAxis && ticks.map((tick, i) => (
            <SvgText
              key={`time-${i}`}
              x={tick.x}
              y={height + 14}
              fontSize={9}
              fill="rgba(255,255,255,0.25)"
              textAnchor={i === 0 ? 'start' : i === tickCount ? 'end' : 'middle'}
            >
              {tick.label}
            </SvgText>
          ))}
        </G>
      </Svg>
    </View>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

export function SleepStagesLegend() {
  return (
    <View style={leg.row}>
      {STAGE_ORDER.map(stage => (
        <View key={stage} style={leg.item}>
          <View style={[leg.dot, { backgroundColor: STAGE_COLORS[stage] }]} />
          <Text style={leg.label}>{STAGE_LABELS[stage]}</Text>
        </View>
      ))}
    </View>
  );
}

const leg = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  label: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '500' },
});

// ─── Utility: build fake samples from aggregate durations ──────────────────
// Use this when you only have total hours per stage (no raw HealthKit samples)

export function buildSamplesFromDurations(
  bedtime: Date,
  deep: number,   // hours
  rem: number,    // hours
  light: number,  // hours
  awake: number,  // hours
): SleepSample[] {
  const samples: SleepSample[] = [];

  type Seg = { stage: SleepStage; mins: number };

  const deepM  = Math.max(5,  deep  * 60);
  const remM   = Math.max(3,  rem   * 60);
  const lightM = Math.max(10, light * 60);
  const awakeM = Math.max(3,  awake * 60);
  const totalM = deepM + remM + lightM + awakeM;

  // Realistic cycle approximation: 90-min cycles
  const rawSegs: Seg[] = [
    { stage: 'awake', mins: awakeM * 0.25 },
    { stage: 'light', mins: lightM * 0.12 },
    { stage: 'deep',  mins: deepM  * 0.40 },
    { stage: 'light', mins: lightM * 0.08 },
    { stage: 'rem',   mins: remM   * 0.22 },
    { stage: 'awake', mins: awakeM * 0.15 },
    { stage: 'light', mins: lightM * 0.10 },
    { stage: 'deep',  mins: deepM  * 0.40 },
    { stage: 'light', mins: lightM * 0.10 },
    { stage: 'rem',   mins: remM   * 0.38 },
    { stage: 'awake', mins: awakeM * 0.15 },
    { stage: 'light', mins: lightM * 0.14 },
    { stage: 'rem',   mins: remM   * 0.40 },
    { stage: 'light', mins: lightM * 0.12 },
    { stage: 'awake', mins: awakeM * 0.20 },
    { stage: 'light', mins: lightM * 0.12 },
    { stage: 'awake', mins: awakeM * 0.25 },
  ];

  const rawTotal = rawSegs.reduce((a, b) => a + b.mins, 0);
  const scale = totalM / rawTotal;

  let cursor = bedtime.getTime();
  rawSegs.forEach(seg => {
    const durationMs = seg.mins * scale * 60_000;
    const startDate = new Date(cursor).toISOString();
    cursor += durationMs;
    const endDate = new Date(cursor).toISOString();
    samples.push({ stage: seg.stage, startDate, endDate });
  });

  return samples;
}
