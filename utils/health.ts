import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
} from 'react-native-health';
import { Platform } from 'react-native';

const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
      AppleHealthKit.Constants.Permissions.Weight,
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.BodyFatPercentage,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
      AppleHealthKit.Constants.Permissions.FlightsClimbed,
      AppleHealthKit.Constants.Permissions.RespiratoryRate,
      AppleHealthKit.Constants.Permissions.BodyMassIndex,
      AppleHealthKit.Constants.Permissions.LeanBodyMass,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.Vo2Max,
      AppleHealthKit.Constants.Permissions.OxygenSaturation,
      AppleHealthKit.Constants.Permissions.Height,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.WalkingHeartRateAverage,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.EnergyConsumed,
      AppleHealthKit.Constants.Permissions.Weight,
    ],
  },
};

// ─── Mapping des stades de sommeil ────────────────────────────────────────────
// react-native-health retourne les valeurs sous forme de STRING (pas de number)
// Valeurs possibles : 'INBED', 'AWAKE', 'CORE', 'DEEP', 'REM'
const SLEEP_STAGE_STRINGS = {
  CORE: 'CORE',
  DEEP: 'DEEP',
  REM:  'REM',
  AWAKE: 'AWAKE',
} as const;

const VALID_SLEEP_STAGES = [
  SLEEP_STAGE_STRINGS.CORE,
  SLEEP_STAGE_STRINGS.DEEP,
  SLEEP_STAGE_STRINGS.REM,
  SLEEP_STAGE_STRINGS.AWAKE,
];

// ─── Init ─────────────────────────────────────────────────────────────────────
export const initHealth = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'ios') {
      return resolve();
    }

    AppleHealthKit.initHealthKit(permissions, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

// ─── Calories consommées ──────────────────────────────────────────────────────
export const getTodayCalories = (dateStr?: string): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    AppleHealthKit.getEnergyConsumedSamples(options, (err, results) => {
      if (err) return resolve(0);
      const total = results.reduce((acc, sample) => acc + (sample.value || 0), 0);
      resolve(Math.round(total));
    });
  });
};

// ─── Pas ──────────────────────────────────────────────────────────────────────
export const getTodaySteps = async (dateStr?: string): Promise<number> => {
  if (Platform.OS !== 'ios') return 0;
  
  const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  
  // Use getStepCount which returns HealthKit's aggregated value (includes ALL sources)
  const aggregatedSteps = await new Promise<number>((resolve) => {
    AppleHealthKit.getStepCount({ date: targetDate.toISOString() }, (err, results) => {
      resolve(err ? 0 : (results?.value || 0));
    });
  });
  
  // Fallback to daily samples if needed
  if (aggregatedSteps === 0) {
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    return new Promise((resolve) => {
      (AppleHealthKit as any).getDailyStepCountSamples(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err: any, results: any) => {
          if (err || !results) return resolve(0);
          const total = results.reduce((acc: number, sample: any) => acc + (sample.value || 0), 0);
          resolve(Math.round(total));
        }
      );
    });
  }
  
  return aggregatedSteps;
};

// ─── Énergie active ───────────────────────────────────────────────────────────
export const getTodayActiveEnergy = (dateStr?: string): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    AppleHealthKit.getActiveEnergyBurned(options, (err, results) => {
      if (err) return resolve(0);
      const total = results.reduce((acc, sample) => acc + (sample.value || 0), 0);
      resolve(Math.round(total));
    });
  });
};

// ─── Fréquence cardiaque ──────────────────────────────────────────────────────
export const getLatestHeartRate = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    AppleHealthKit.getHeartRateSamples({ limit: 1 }, (err, results) => {
      if (err || !results.length) return resolve(null);
      resolve(Math.round(results[0].value));
    });
  });
};

export const getRestingHeartRate = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    AppleHealthKit.getRestingHeartRate({}, (err, result) => {
      if (err || !result) return resolve(null);
      resolve(Math.round(result.value));
    });
  });
};

// ─── Sommeil ──────────────────────────────────────────────────────────────────
// IMPORTANT : react-native-health retourne sample.value sous forme de STRING
// ('INBED', 'AWAKE', 'CORE', 'DEEP', 'REM') et NON pas les rawValues iOS (0, 2, 3, 4, 5)
export const getSleepDetails = (dateStr?: string): Promise<{
  rem: number;
  core: number;
  deep: number;
  awake: number;
  total: number;
  samples: { stage: string; startDate: string; endDate: string }[];
} | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);

    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(18, 0, 0, 0); // Depuis 18h la veille
    const endDate = new Date(targetDate);
    endDate.setHours(12, 0, 0, 0);   // Jusqu'à 12h le jour J

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    AppleHealthKit.getSleepSamples(options, (err, results) => {
      if (err) {
        return resolve(null);
      }

      if (!results || !results.length) {
        return resolve(null);
      }

      let coreMs = 0;
      let deepMs = 0;
      let remMs  = 0;
      let awakeMs = 0;
      let matchedCount = 0;

      results.forEach((sample) => {
        const valueStr = String(sample.value).toUpperCase().trim();
        const isValid = VALID_SLEEP_STAGES.includes(valueStr as any);

        if (!isValid) return;

        const start = new Date(sample.startDate).getTime();
        const end   = new Date(sample.endDate).getTime();
        const durationMs = end - start;

        matchedCount++;

        switch (valueStr) {
          case SLEEP_STAGE_STRINGS.CORE:
            coreMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.DEEP:
            deepMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.REM:
            remMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.AWAKE:
            awakeMs += durationMs;
            break;
        }
      });

      // 🐛 FIX : Déduplication des échantillons (certains jours ont des doublons HealthKit)
      const seen = new Set<string>();
      const uniqueSamples = results.filter((sample: any) => {
        const key = `${sample.startDate}|${sample.endDate}|${sample.value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Reset et recalcule avec les échantillons dédupliqués
      coreMs = 0;
      deepMs = 0;
      remMs = 0;
      awakeMs = 0;
      matchedCount = 0;

      uniqueSamples.forEach((sample: any) => {
        const valueStr = String(sample.value).toUpperCase().trim();
        if (!VALID_SLEEP_STAGES.includes(valueStr as any)) return;

        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        const durationMs = end - start;

        matchedCount++;

        switch (valueStr) {
          case SLEEP_STAGE_STRINGS.CORE:
            coreMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.DEEP:
            deepMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.REM:
            remMs += durationMs;
            break;
          case SLEEP_STAGE_STRINGS.AWAKE:
            awakeMs += durationMs;
            break;
        }
      });

      const MS_TO_HOURS = 1 / 3600000;

      // Convertir les échantillons pour le composant SleepStagesChart
      const samples = uniqueSamples
        .filter((s: any) => VALID_SLEEP_STAGES.includes(String(s.value).toUpperCase().trim() as any))
        .map((s: any) => ({
          stage: String(s.value).toUpperCase().trim() as 'awake' | 'rem' | 'light' | 'deep',
          startDate: s.startDate,
          endDate: s.endDate,
        }))
        // Mapper CORE vers 'light' car SleepStagesChart utilise la nomenclature standard
        .map((s: any) => ({
          ...s,
          stage: s.stage === 'CORE' ? 'light' : s.stage.toLowerCase()
        }));

      const result = {
        core:  coreMs * MS_TO_HOURS,
        deep:  deepMs * MS_TO_HOURS,
        rem:   remMs  * MS_TO_HOURS,
        awake: awakeMs * MS_TO_HOURS,
        total: (coreMs + deepMs + remMs + awakeMs) * MS_TO_HOURS,
        samples,
      };

      // Retourner null si aucun stade valide trouvé
      if (result.total === 0) {
        return resolve(null);
      }

      resolve(result);
    });
  });
};

export const getSleepDuration = (dateStr?: string): Promise<number | null> => {
  return new Promise(async (resolve) => {
    const details = await getSleepDetails(dateStr);
    if (!details) return resolve(null);
    // Return actual sleep time (core + deep + rem), excluding awake time
    const actualSleep = details.core + details.deep + details.rem;
    resolve(actualSleep);
  });
};

// ─── Sleep Score Calculation (shared between SleepScreen and global score) ────
// Returns score 0-100 based on sleep quality, excluding awake time
export const calculateSleepScore = (core: number, deep: number, rem: number, awake: number): number => {
  // Actual sleep time (excluding awake periods)
  const actualSleep = core + deep + rem;
  
  if (actualSleep === 0) return 0;
  
  // Calculate percentages of actual sleep
  const deepPct = deep / actualSleep;
  const remPct = rem / actualSleep;
  const awakePct = awake > 0 ? awake / (actualSleep + awake) : 0;
  
  let score = 0;
  
  // 1. DURATION (40 points) - based on actual sleep time (not time in bed)
  // Ideal: 7-9 hours of actual sleep
  if (actualSleep >= 7 && actualSleep <= 9) score += 40;
  else if (actualSleep >= 6.5) score += 35;
  else if (actualSleep >= 6) score += 28;
  else if (actualSleep >= 5.5) score += 20;
  else if (actualSleep >= 5) score += 12;
  else score += Math.max(0, actualSleep * 2); // 0-10 points for <5h
  
  // 2. DEEP SLEEP (30 points) - ideal: 15-25% of actual sleep
  if (deepPct >= 0.20) score += 30;
  else if (deepPct >= 0.15) score += 24;
  else if (deepPct >= 0.10) score += 16;
  else if (deepPct >= 0.05) score += 8;
  else score += Math.max(0, deepPct * 100); // 0-5 points
  
  // 3. REM SLEEP (20 points) - ideal: 20-25% of actual sleep
  if (remPct >= 0.20 && remPct <= 0.30) score += 20;
  else if (remPct >= 0.15) score += 15;
  else if (remPct >= 0.10) score += 10;
  else if (remPct >= 0.05) score += 5;
  else score += Math.max(0, remPct * 50); // 0-2.5 points
  
  // 4. EFFICIENCY (10 points) - low awake time is good
  // Penalize if awake time is more than 10% of total time in bed
  if (awakePct <= 0.05) score += 10;
  else if (awakePct <= 0.10) score += 7;
  else if (awakePct <= 0.15) score += 4;
  else if (awakePct <= 0.20) score += 2;
  else score += 0;
  
  return Math.min(100, Math.round(score));
};

// Helper to convert 0-100 sleep score to 0-20 global score points
export const sleepScoreToGlobalPoints = (sleepScore100: number): number => {
  // Linear conversion: 100 → 20, 0 → 0
  return Math.round((sleepScore100 / 100) * 20);
};

// ─── Poids & composition corporelle ──────────────────────────────────────────
export const getLatestWeight = (dateStr?: string): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    
    // Si une date est spécifiée, ne récupérer que les poids de cette date
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      unit: 'kg' as any,
    };
    
    AppleHealthKit.getWeightSamples(options, (err, results) => {
      if (err || !results || results.length === 0) return resolve(null);
      // Prendre le dernier poids de la journée (le plus récent)
      const lastWeight = results[results.length - 1].value;
      resolve(lastWeight);
    });
  });
};

export const getLatestBodyFat = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    const options: HealthInputOptions = { limit: 1 };
    (AppleHealthKit as any).getBodyFatPercentageSamples(options, (err: any, results: any) => {
      if (err || !results.length) return resolve(null);
      resolve(results[0].value * 100);
    });
  });
};

export const getWeightHistory = (days: number = 30): Promise<{ date: string; value: number }[]> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve([]);
    const options: HealthInputOptions = {
      startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
      unit: 'kg' as any,
    };
    AppleHealthKit.getWeightSamples(options, (err, results) => {
      if (err) return resolve([]);
      resolve(results.map(s => {
        // Correction: gérer le format de date avec fuseau horaire
        const dateStr = s.startDate?.split('T')[0] || 
                       (s.startDate?.includes('+') ? s.startDate.split('+')[0].split('T')[0] : 
                        s.startDate?.includes('Z') ? s.startDate.split('Z')[0].split('T')[0] : 
                        new Date(s.startDate).toISOString().split('T')[0]);
        return { date: dateStr, value: s.value };
      }).sort((a, b) => a.date.localeCompare(b.date)));
    });
  });
};

export const getBodyFatHistory = (days: number = 30): Promise<{ date: string; value: number }[]> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve([]);
    const options: HealthInputOptions = {
      startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
    };
    (AppleHealthKit as any).getBodyFatPercentageSamples(options, (err: any, results: any) => {
      if (err) return resolve([]);
      resolve(results.map((s: any) => {
        const dateStr = s.startDate?.split('T')[0] || 
                       (s.startDate?.includes('+') ? s.startDate.split('+')[0].split('T')[0] : 
                        s.startDate?.includes('Z') ? s.startDate.split('Z')[0].split('T')[0] : 
                        new Date(s.startDate).toISOString().split('T')[0]);
        return { date: dateStr, value: s.value * 100 };
      }).sort((a: any, b: any) => a.date.localeCompare(b.date)));
    });
  });
};

export const getBMIHistory = (days: number = 30): Promise<{ date: string; value: number }[]> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve([]);
    const options: HealthInputOptions = {
      startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
    };
    AppleHealthKit.getBmiSamples(options, (err, results) => {
      if (err) return resolve([]);
      resolve((results || []).map(s => {
        const dateStr = s.startDate?.split('T')[0] || 
                       (s.startDate?.includes('+') ? s.startDate.split('+')[0].split('T')[0] : 
                        s.startDate?.includes('Z') ? s.startDate.split('Z')[0].split('T')[0] : 
                        new Date(s.startDate).toISOString().split('T')[0]);
        return { date: dateStr, value: s.value };
      }).sort((a, b) => a.date.localeCompare(b.date)));
    });
  });
};

export const getLeanBodyMassHistory = (days: number = 30): Promise<{ date: string; value: number }[]> => {
  return new Promise(async (resolve) => {
    if (Platform.OS !== 'ios') return resolve([]);
    
    // Récupérer aussi le poids pour validation
    const [leanResults, weightResults] = await Promise.all([
      new Promise<any[]>((r) => {
        const options: HealthInputOptions = {
          startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
        };
        AppleHealthKit.getLeanBodyMassSamples(options, (err, results) => r(err ? [] : results || []));
      }),
      new Promise<Record<string, number>>((r) => {
        const options: HealthInputOptions = {
          startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
          unit: 'kg' as any,
        };
        AppleHealthKit.getWeightSamples(options, (err, results) => {
          if (err) return r({});
          const map: Record<string, number> = {};
          results.forEach((s: any) => {
            const date = s.startDate.split('T')[0];
            map[date] = s.value;
          });
          r(map);
        });
      })
    ]);

    // Fix: react-native-health convertit mal les unités (pense que c'est en lbs)
    // Diviser par 2.20462 pour corriger
    const LBS_TO_KG = 1 / 2.20462;
    const correctedSamples = leanResults.map((s: any) => ({
      ...s,
      value: s.value * LBS_TO_KG
    }));

    // Filtrer les valeurs incohérentes (lean > weight)
    const validSamples = correctedSamples.filter((s: any) => {
      const date = s.startDate.split('T')[0];
      const weightOnDate = weightResults[date];
      const isValid = !weightOnDate || s.value <= weightOnDate;
      return isValid;
    });

    resolve(validSamples.map((s: any) => {
      const dateStr = s.startDate?.split('T')[0] || 
                     (s.startDate?.includes('+') ? s.startDate.split('+')[0].split('T')[0] : 
                      s.startDate?.includes('Z') ? s.startDate.split('Z')[0].split('T')[0] : 
                      new Date(s.startDate).toISOString().split('T')[0]);
      return { date: dateStr, value: s.value };
    }).sort((a: any, b: any) => a.date.localeCompare(b.date)));
  });
};

// ─── Sauvegarde ───────────────────────────────────────────────────────────────
export const saveCaloriesToHealth = (kcal: number): Promise<void> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios' || kcal <= 0) return resolve();
    const options = { value: kcal, startDate: new Date().toISOString() } as any;
    if ((AppleHealthKit as any).saveEnergyConsumed) {
      (AppleHealthKit as any).saveEnergyConsumed(options, () => resolve());
    } else resolve();
  });
};

export const saveWeightToHealth = (weight: number): Promise<void> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios' || weight <= 0) return resolve();
    AppleHealthKit.saveWeight({ value: weight, startDate: new Date().toISOString() }, () => resolve());
  });
};

// ─── Divers ───────────────────────────────────────────────────────────────────
export const getTodayDistance = (): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    AppleHealthKit.getDistanceWalkingRunning({ date: new Date().toISOString() }, (err, results) => {
      if (err) return resolve(0);
      resolve(results.value || 0);
    });
  });
};

export const getTodayBasalEnergy = (): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    const options: HealthInputOptions = {
      startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    };
    AppleHealthKit.getBasalEnergyBurned(options, (err, results) => {
      if (err) return resolve(0);
      const total = results.reduce((acc, sample) => acc + (sample.value || 0), 0);
      resolve(Math.round(total));
    });
  });
};

export const getTodayFlightsClimbed = (): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    AppleHealthKit.getFlightsClimbed({ date: new Date().toISOString() }, (err, results) => {
      if (err) return resolve(0);
      resolve(results.value || 0);
    });
  });
};

export const getLatestRespiratoryRate = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    (AppleHealthKit as any).getRespiratoryRateSamples({ limit: 1 }, (err: any, results: any) => {
      if (err || !results.length) return resolve(null);
      resolve(results[0].value);
    });
  });
};

export const getLatestBMI = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    AppleHealthKit.getLatestBmi({}, (err, result) => {
      if (err || !result) return resolve(null);
      resolve(result.value);
    });
  });
};

export const getLatestLeanBodyMass = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    (AppleHealthKit as any).getLatestLeanBodyMass({}, (err: any, result: any) => {
      if (err || !result) return resolve(null);
      resolve(result.value);
    });
  });
};

// ─── Repas ────────────────────────────────────────────────────────────────────
export type MealEntry = { meal: string; value: number; time: string };
export type MealBreakdown = { total: number; meals: MealEntry[] };

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Petit-déj',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

export const getMealBreakdown = (dateStr?: string): Promise<MealBreakdown> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve({ total: 0, meals: [] });

    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    AppleHealthKit.getEnergyConsumedSamples(options, (err, results) => {
      if (err || !results.length) return resolve({ total: 0, meals: [] });
      let total = 0;
      const byMeal: Record<string, { value: number; time: string }> = {};
      results.forEach((s: any) => {
        const val = Math.round(s.value || 0);
        total += val;
        const rawMeal = s.metadata?.meal || s.metadata?.HKFoodMeal || '?';
        const label = MEAL_LABELS[rawMeal] || rawMeal;
        const time = (s.startDate || '').split('T')[1]?.substring(0, 5) || '';
        if (byMeal[label]) {
          byMeal[label].value += val;
        } else {
          byMeal[label] = { value: val, time };
        }
      });
      const meals: MealEntry[] = Object.entries(byMeal).map(([meal, d]) => ({
        meal,
        value: d.value,
        time: d.time,
      }));
      resolve({ total, meals });
    });
  });
};

// ─── Dump complet pour debug ──────────────────────────────────────────────────
export const logAllHealthData = async () => {
  // Fonction de debug désactivée - les logs ont été supprimés
  // Réactiver si besoin de diagnostiquer les données HealthKit
};

// ─── Debug des pas - pour diagnostiquer les données montre vs téléphone ───────
export const debugStepsData = async (dateStr?: string): Promise<void> => {
  if (Platform.OS !== 'ios') return;
  
  const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  console.log('=== DEBUG STEPS DATA ===');
  console.log('Date:', targetDate.toISOString().split('T')[0]);

  // 1. Test getStepCount (ancienne méthode)
  try {
    const stepCountResult = await new Promise<any>((resolve) => {
      AppleHealthKit.getStepCount({ date: targetDate.toISOString() }, (err, results) => {
        resolve({ err, results });
      });
    });
    console.log('1. getStepCount:', stepCountResult.err ? 'ERROR' : stepCountResult.results);
  } catch (e) {
    console.log('1. getStepCount: FAILED', e);
  }

  // 2. Test getDailyStepCountSamples
  try {
    const dailyResult = await new Promise<any>((resolve) => {
      (AppleHealthKit as any).getDailyStepCountSamples(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err: any, results: any) => resolve({ err, results })
      );
    });
    console.log('2. getDailyStepCountSamples:', dailyResult.err ? 'ERROR' : dailyResult.results);
  } catch (e) {
    console.log('2. getDailyStepCountSamples: FAILED', e);
  }

  // 3. Test getStepSamples (échantillons bruts avec source)
  try {
    const samplesResult = await new Promise<any>((resolve) => {
      (AppleHealthKit as any).getStepSamples(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err: any, results: any) => resolve({ err, results })
      );
    });
    console.log('3. getStepSamples count:', samplesResult.results?.length || 0);
    if (samplesResult.results && samplesResult.results.length > 0) {
      console.log('   First 3 samples:', samplesResult.results.slice(0, 3));
    }
  } catch (e) {
    console.log('3. getStepSamples: FAILED', e);
  }

  // 4. Test getDistanceWalkingRunning (peut être lié aux pas de montre)
  try {
    const distanceResult = await new Promise<any>((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        (err, results) => resolve({ err, results })
      );
    });
    console.log('4. getDistanceWalkingRunning:', distanceResult.err ? 'ERROR' : distanceResult.results);
  } catch (e) {
    console.log('4. getDistanceWalkingRunning: FAILED', e);
  }

  console.log('=== END DEBUG ===');
};

// ─── Raw step samples - pour voir toutes les sources de pas ────────────────────
export const getRawStepSamples = async (dateStr?: string): Promise<void> => {
  if (Platform.OS !== 'ios') return;
  
  const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const options: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  console.log('[STEPS] === RAW STEP SAMPLES ===');
  
  // Try to get raw step samples
  (AppleHealthKit as any).getStepSamples(options, (err: any, results: any) => {
    if (err || !results || results.length === 0) {
      console.log('[STEPS] Raw step samples: none found');
      return;
    }
    
    console.log(`[STEPS] Raw samples count: ${results.length}`);
    
    // Group by source
    const bySource: Record<string, { count: number; steps: number }> = {};
    results.forEach((sample: any) => {
      const source = sample.sourceName || sample.source || 'unknown';
      if (!bySource[source]) {
        bySource[source] = { count: 0, steps: 0 };
      }
      bySource[source].count++;
      bySource[source].steps += (sample.value || 0);
    });
    
    console.log('[STEPS] By source:', bySource);
  });
};

export const getWorkoutSteps = async (dateStr?: string): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    
    const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    // Get ONLY workout samples (not all samples)
    (AppleHealthKit as any).getWorkoutSamples(options, (err: any, results: any) => {
      if (err || !results || results.length === 0) {
        return resolve(0);
      }
      
      let workoutSteps = 0;
      results.forEach((workout: any) => {
        const steps = workout.steps || workout.metadata?.HKStepCount || 0;
        workoutSteps += steps;
      });
      
      resolve(Math.round(workoutSteps));
    });
  });
};

// ─── Toutes les metriques supplementaires ──────────────────────────────────────
export const getAllHealthMetrics = async (dateStr?: string) => {
  if (Platform.OS !== 'ios') return null;
  
  const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const options: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  const metrics: any = {};

  try {
    // 1. Steps
    metrics.steps = await getTodaySteps(dateStr);

    // 2. Distance walking/running
    metrics.distance = await new Promise((resolve) => {
      AppleHealthKit.getDistanceWalkingRunning(options, (err: any, result: any) => {
        resolve(err ? 0 : result?.value || 0);
      });
    });

    // 3. Active energy
    metrics.activeEnergy = await getTodayActiveEnergy(dateStr);

    // 4. Workouts count (may not exist)
    metrics.workouts = await new Promise((resolve) => {
      const hasMethod = !!(AppleHealthKit as any).getWorkoutSamples;
      if (!hasMethod) return resolve(0);
      (AppleHealthKit as any).getWorkoutSamples(options, (err: any, results: any) => {
        resolve(err ? 0 : results?.length || 0);
      });
    });

    // 5. Running pace (may not exist)
    metrics.runningPace = await new Promise((resolve) => {
      const hasMethod = !!(AppleHealthKit as any).getRunningSpeedSamples;
      if (!hasMethod) return resolve(null);
      (AppleHealthKit as any).getRunningSpeedSamples(options, (err: any, results: any) => {
        if (err || !results?.length) return resolve(null);
        const avg = results.reduce((acc: number, s: any) => acc + (s.value || 0), 0) / results.length;
        resolve(avg);
      });
    });

    // 6. Walking speed (may not exist)
    metrics.walkingSpeed = await new Promise((resolve) => {
      const hasMethod = !!(AppleHealthKit as any).getWalkingSpeedSamples;
      if (!hasMethod) return resolve(null);
      (AppleHealthKit as any).getWalkingSpeedSamples(options, (err: any, results: any) => {
        if (err || !results?.length) return resolve(null);
        const avg = results.reduce((acc: number, s: any) => acc + (s.value || 0), 0) / results.length;
        resolve(avg);
      });
    });

    // 7. Mindful sessions (may error if no permission)
    metrics.mindfulSessions = await new Promise((resolve) => {
      const hasMethod = !!(AppleHealthKit as any).getMindfulSession;
      if (!hasMethod) return resolve(null);
      (AppleHealthKit as any).getMindfulSession(options, (err: any, results: any) => {
        resolve(err ? 0 : results?.length || 0);
      });
    });

    // 8. Mobility (may not exist)
    metrics.mobility = await new Promise((resolve) => {
      const hasMethod = !!(AppleHealthKit as any).getSixMinuteWalkTestDistance;
      if (!hasMethod) return resolve(null);
      (AppleHealthKit as any).getSixMinuteWalkTestDistance(options, (err: any, results: any) => {
        resolve(err ? null : results?.[0]?.value || null);
      });
    });

    // 9. Heart rate
    metrics.heartRate = await getLatestHeartRate();
    metrics.restingHeartRate = await getRestingHeartRate();

    // 10. Sleep
    metrics.sleep = await getSleepDetails(dateStr);

    // 11. Blood oxygen (may error if no permission)
    metrics.bloodOxygen = await new Promise((resolve) => {
      (AppleHealthKit as any).getOxygenSaturationSamples?.({ limit: 1 }, (err: any, results: any) => {
        resolve(err ? null : results?.[0]?.value || null);
      }) || resolve(null);
    });

    // 12. Respiratory rate
    metrics.respiratoryRate = await getLatestRespiratoryRate();

    // 13. Body temperature (may error if no permission)
    metrics.bodyTemperature = await new Promise((resolve) => {
      (AppleHealthKit as any).getBodyTemperatureSamples?.({ limit: 1 }, (err: any, results: any) => {
        resolve(err ? null : results?.[0]?.value || null);
      }) || resolve(null);
    });

    // 14. Blood pressure (may error if no permission)
    metrics.bloodPressure = await new Promise((resolve) => {
      (AppleHealthKit as any).getBloodPressureSamples?.({ limit: 1 }, (err: any, results: any) => {
        resolve(err ? null : results?.[0] || null);
      }) || resolve(null);
    });

    return metrics;
  } catch (error) {
    console.error('[getAllHealthMetrics] Error:', error);
    return null;
  }
};

// ... (rest of the code remains the same)