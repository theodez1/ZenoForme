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

export const initHealth = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'ios') {
      console.log('[HealthKit] Pas iOS, initialisation ignorée');
      return resolve();
    }

    console.log('[HealthKit] Initialisation avec permissions:', permissions);
    
    AppleHealthKit.initHealthKit(permissions, (error) => {
      if (error) {
        console.log('[HealthKit] Initialization Error: ', error);
        reject(error);
      } else {
        console.log('[HealthKit] Initialisation réussie');
        resolve();
      }
    });
  });
};

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

export const getTodaySteps = (dateStr?: string): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') {
      console.log('[HealthKit] Pas iOS, retourne 0 pas');
      return resolve(0);
    }
    
    const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const options: HealthInputOptions = {
      date: targetDate.toISOString(),
    };
    
    console.log(`[HealthKit] Récupération des pas pour ${dateStr || "aujourd'hui"}...`);
    
    AppleHealthKit.getStepCount(options, (err, results) => {
      if (err) {
        console.log('[HealthKit] Erreur récupération pas:', err);
        return resolve(0);
      }
      const steps = results.value || 0;
      console.log(`[HealthKit] Pas récupérés: ${steps}`);
      resolve(steps);
    });
  });
};

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

// Fonction pour obtenir les détails du sommeil par stade Apple HealthKit
export const getSleepDetails = (dateStr?: string): Promise<{
  rem: number;
  core: number;
  deep: number;
  total: number;
} | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);

    // For sleep, we usually want "last night" (from evening before to today)
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(18, 0, 0, 0); // Start from 6 PM yesterday
    const endDate = new Date(targetDate);
    endDate.setHours(12, 0, 0, 0); // To 12 PM today

    const options: HealthInputOptions = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
    
    console.log(`[HealthKit] Récupération du sommeil pour ${dateStr || "aujourd'hui"}...`);
    console.log(`[HealthKit] Plage de dates: ${startDate.toISOString()} → ${endDate.toISOString()}`);
    
    AppleHealthKit.getSleepSamples(options, (err, results) => {
      if (err) {
        console.log(`[HealthKit] Erreur récupération sommeil:`, err);
        return resolve(null);
      }
      
      console.log(`[HealthKit] Nombre d'échantillons bruts reçus: ${results?.length || 0}`);
      
      if (!results || !results.length) {
        console.log(`[HealthKit] Aucun échantillon de sommeil trouvé`);
        return resolve(null);
      }
      
      // Log de tous les échantillons bruts pour diagnostic
      console.log(`[HealthKit] === ÉCHANTILLONS BRUTS ===`);
      results.forEach((sample, index) => {
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        const duration = end - start;
        console.log(`[HealthKit] Sample ${index}: value=${sample.value}, type=${typeof sample.value}, start=${sample.startDate}, end=${sample.endDate}, duration=${(duration/3600000).toFixed(2)}h`);
      });
      
      // Garder uniquement ces 3 valeurs de sommeil Apple HealthKit
      // HKCategoryValueSleepAnalysis.asleepREM.rawValue = 5
      // HKCategoryValueSleepAnalysis.asleepCore.rawValue = 3  
      // HKCategoryValueSleepAnalysis.asleepDeep.rawValue = 4
      const validSleepValues = [3, 4, 5]; // Core, Deep, REM
      
      console.log(`[HealthKit] Valeurs de sommeil valides recherchées: [${validSleepValues.join(', ')}]`);
      
      // Initialiser les stades de sommeil
      const sleepStages = {
        rem: 0,    // REM (5)
        core: 0,    // Core (3)
        deep: 0,    // Deep (4)
      };
      
      let totalMs = 0;
      let matchedCount = 0;
      
      results.forEach(sample => {
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        const duration = end - start;
        
        // Filtrer uniquement les 3 stades de sommeil valides
        const isValid = validSleepValues.includes(sample.value);
        console.log(`[HealthKit] Traitement sample: value=${sample.value}, valid=${isValid}`);
        
        if (isValid) {
          matchedCount++;
          switch (sample.value) {
            case 3: // Core
              sleepStages.core += duration;
              break;
            case 4: // Deep
              sleepStages.deep += duration;
              break;
            case 5: // REM
              sleepStages.rem += duration;
              break;
          }
          totalMs += duration;
          
          console.log(`[HealthKit] ✓ Stade sommeil matché: ${sample.value === 3 ? 'Core' : sample.value === 4 ? 'Deep' : 'REM'}, durée: ${(duration / (1000 * 60 * 60)).toFixed(2)}h`);
        }
      });
      
      console.log(`[HealthKit] Nombre d'échantillons matchés: ${matchedCount}/${results.length}`);
      
      const result = {
        rem: sleepStages.rem / (1000 * 60 * 60),
        core: sleepStages.core / (1000 * 60 * 60),
        deep: sleepStages.deep / (1000 * 60 * 60),
        total: totalMs / (1000 * 60 * 60),
      };
      
      console.log(`[HealthKit] RÉSULTAT FINAL - Core: ${result.core.toFixed(2)}h, Deep: ${result.deep.toFixed(2)}h, REM: ${result.rem.toFixed(2)}h, Total: ${result.total.toFixed(2)}h`);
      
      resolve(result);
    });
  });
};

export const getSleepDuration = (dateStr?: string): Promise<number | null> => {
  return new Promise(async (resolve) => {
    const details = await getSleepDetails(dateStr);
    if (!details) return resolve(null);
    
    // Retourner le temps total de sommeil (Core + Deep + REM)
    const totalSleep = details.total; // Temps total des 3 stades
    console.log(`[HealthKit] Sommeil total calculé: ${totalSleep.toFixed(2)}h`);
    
    resolve(totalSleep);
  });
};

export const getLatestWeight = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    AppleHealthKit.getLatestWeight({ unit: 'kg' } as any, (err, result) => {
      if (err) return resolve(null);
      resolve(result ? result.value : null);
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
      const samples = results.map(s => ({
        date: s.startDate.split('T')[0],
        value: s.value
      }));
      resolve(samples);
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
      const samples = results.map((s: any) => ({
        date: s.startDate.split('T')[0],
        value: s.value * 100
      }));
      resolve(samples);
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
      const samples = (results || []).map(s => ({
        date: s.startDate.split('T')[0],
        value: s.value
      }));
      resolve(samples);
    });
  });
};

export const getLeanBodyMassHistory = (days: number = 30): Promise<{ date: string; value: number }[]> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve([]);
    const options: HealthInputOptions = {
      startDate: new Date(new Date().setDate(new Date().getDate() - days)).toISOString(),
    };
    AppleHealthKit.getLeanBodyMassSamples(options, (err, results) => {
      if (err) return resolve([]);
      const samples = (results || []).map(s => ({
        date: s.startDate.split('T')[0],
        value: s.value
      }));
      resolve(samples);
    });
  });
};

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

export const getTodayDistance = (): Promise<number> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(0);
    const options: HealthInputOptions = {
      date: new Date().toISOString(),
    };
    AppleHealthKit.getDistanceWalkingRunning(options, (err, results) => {
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
    const options: HealthInputOptions = {
      date: new Date().toISOString(),
    };
    AppleHealthKit.getFlightsClimbed(options, (err, results) => {
      if (err) return resolve(0);
      resolve(results.value || 0);
    });
  });
};

export const getLatestRespiratoryRate = (): Promise<number | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    const options: HealthInputOptions = { limit: 1 };
    (AppleHealthKit as any).getRespiratoryRateSamples(options, (err: any, results: any) => {
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

    // Default to today if no date provided
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
      // Group by meal type and sum
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

export const logAllHealthData = async () => {
  if (Platform.OS !== 'ios') return;
  console.log('\n🚀🚀🚀 [HealthKit] DEBUT DU DUMP COMPLET 🚀🚀🚀\n');

  const d7 = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();
  const d30 = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();

  const safe = (fn: () => Promise<any>, label: string) =>
    fn().then(v => v).catch(() => { console.log(`  ⚠️ ${label} : erreur`); return null; });

  const fetchSamples = (method: string, opts: any = {}): Promise<any[]> =>
    new Promise((resolve) => {
      const fn = (AppleHealthKit as any)[method];
      if (!fn) return resolve([]);
      fn(opts, (err: any, res: any) => err ? resolve([]) : resolve(res || []));
    });

  const printHistory = (label: string, samples: any[], valueFn: (s: any) => string) => {
    if (!samples || !samples.length) {
      console.log(`│   (aucune donnée)`);
      return;
    }
    samples.slice(0, 5).forEach((s: any) => {
      const date = (s.startDate || s.start || '').split('T')[0];
      console.log(`│   ${date} → ${valueFn(s)}`);
    });
  };

  try {
    // ═══════════════ ACTIVITÉ ═══════════════
    const steps = await safe(getTodaySteps, 'Pas');
    const distance = await safe(getTodayDistance, 'Distance');
    const flights = await safe(getTodayFlightsClimbed, 'Étages');
    const activeEnergy = await safe(getTodayActiveEnergy, 'Énergie Active');
    const basalEnergy = await safe(getTodayBasalEnergy, 'Énergie Basale');

    // Historique pas (7j)
    const stepHistory: any[] = await safe(() => fetchSamples('getDailyStepCountSamples', { startDate: d7 }), 'Pas Histo');
    // Historique distance (7j)
    const distHistory: any[] = await safe(() => fetchSamples('getDailyDistanceWalkingRunningSamples', { startDate: d7 }), 'Dist Histo');
    // Historique étages (7j)
    const flightHistory: any[] = await safe(() => fetchSamples('getDailyFlightsClimbedSamples', { startDate: d7 }), 'Étages Histo');

    console.log('┌──────────────────────────────────────┐');
    console.log('│           🏃 ACTIVITÉ                │');
    console.log('├──────────────────────────────────────┤');
    console.log(`│ Aujourd'hui :`);
    console.log(`│   Pas            : ${steps}`);
    console.log(`│   Distance       : ${distance ? (distance / 1000).toFixed(2) : 0} km`);
    console.log(`│   Étages         : ${flights}`);
    console.log(`│   É. Active      : ${activeEnergy} kcal`);
    console.log(`│   É. Basale      : ${basalEnergy} kcal`);
    console.log(`│   Total Brûlées  : ${(activeEnergy || 0) + (basalEnergy || 0)} kcal`);
    console.log('│');
    console.log('│ 📊 Historique Pas (7j) :');
    printHistory('Pas', stepHistory, s => `${s.value} pas`);
    console.log('│ 📊 Historique Distance (7j) :');
    printHistory('Distance', distHistory, s => `${(s.value / 1000).toFixed(2)} km`);
    console.log('│ 📊 Historique Étages (7j) :');
    printHistory('Étages', flightHistory, s => `${s.value} étages`);
    console.log('└──────────────────────────────────────┘');

    // ═══════════════ NUTRITION ═══════════════
    const calories = await safe(getTodayCalories, 'Calories');
    const calHistory: any[] = await safe(() => fetchSamples('getEnergyConsumedSamples', { startDate: d7 }), 'Cal Histo');

    console.log('┌──────────────────────────────────────┐');
    console.log('│           🍎 NUTRITION               │');
    console.log('├──────────────────────────────────────┤');
    console.log(`│ Aujourd'hui       : ${calories} kcal`);
    console.log('│');
    console.log('│ 📊 Historique Calories (7j, détail repas) :');
    if (calHistory && calHistory.length) {
      // Group by day
      const byDay: Record<string, { total: number; meals: { meal: string; value: number; time: string }[] }> = {};
      calHistory.forEach((s: any) => {
        const date = (s.startDate || '').split('T')[0];
        const time = (s.startDate || '').split('T')[1]?.substring(0, 5) || '';
        const meal = s.metadata?.HKFoodMeal || s.metadata?.meal || s.meal || s.metadata?.HKFoodType || '?';
        if (!byDay[date]) byDay[date] = { total: 0, meals: [] };
        byDay[date].total += (s.value || 0);
        byDay[date].meals.push({ meal, value: Math.round(s.value || 0), time });
      });
      Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).forEach(([date, data]) => {
        console.log(`│   ${date} — Total: ${Math.round(data.total)} kcal`);
        data.meals.forEach(m => {
          console.log(`│     ${m.time} ${m.meal} : ${m.value} kcal`);
        });
      });
    } else {
      console.log('│   (aucune donnée)');
    }
    console.log('└──────────────────────────────────────┘');

    // ═══════════════ COMPOSITION CORPORELLE ═══════════════
    const weight = await safe(getLatestWeight, 'Poids');
    const fat = await safe(getLatestBodyFat, 'Masse Grasse');
    const bmiHistory = await safe(() => getBMIHistory(1), 'BMI');
    const bmi = bmiHistory?.[0]?.value || null;
    const leanHistory = await safe(() => getLeanBodyMassHistory(1), 'Masse Maigre');
    const lean = leanHistory?.[0]?.value || null;

    const height: number | null = await safe(() => new Promise((resolve) => {
      AppleHealthKit.getLatestHeight({}, (err, result) => {
        if (err || !result) return resolve(null);
        resolve(result.value);
      });
    }), 'Taille');

    // Historiques 30j
    const weightHistory: any[] = await safe(() => fetchSamples('getWeightSamples', { startDate: d30, unit: 'kg' }), 'Poids Histo');
    const fatSamples: any[] = await safe(() => fetchSamples('getBodyFatPercentageSamples', { startDate: d30, limit: 10 }), 'Fat Histo');
    const bmiSamples: any[] = await safe(() => getBMIHistory(30), 'BMI Histo');
    const leanSamples: any[] = await safe(() => getLeanBodyMassHistory(30), 'Lean Histo');

    console.log('┌──────────────────────────────────────┐');
    console.log('│   🏋️ COMPOSITION CORPORELLE (Renpho) │');
    console.log('├──────────────────────────────────────┤');
    console.log(`│ Dernier relevé :`);
    console.log(`│   Taille         : ${height ? (height * 2.54).toFixed(1) : '?'} cm`);
    console.log(`│   Poids          : ${weight?.toFixed(1)} kg`);
    console.log(`│   IMC (BMI)      : ${bmi?.toFixed(1)}`);
    console.log(`│   Masse Grasse   : ${fat?.toFixed(1)} %`);
    console.log(`│   Masse Maigre   : ${lean?.toFixed(1)} kg`);
    console.log('│');
    console.log('│ 📊 Historique Poids (30j) :');
    printHistory('Poids', weightHistory, s => `${s.value?.toFixed(1)} kg`);
    console.log('│ 📊 Historique Masse Grasse (30j) :');
    printHistory('Fat', fatSamples, s => `${(s.value * 100).toFixed(1)} %`);
    console.log('│ 📊 Historique IMC (30j) :');
    printHistory('BMI', bmiSamples, s => `${s.value?.toFixed(1)}`);
    console.log('│ 📊 Historique Masse Maigre (30j) :');
    printHistory('Lean', leanSamples, s => `${s.value?.toFixed(1)} kg`);
    console.log('└──────────────────────────────────────┘');

    // ═══════════════ SANTÉ & VITAUX ═══════════════
    const hr = await safe(getLatestHeartRate, 'FC');
    const rhr = await safe(getRestingHeartRate, 'FC Repos');
    const resp = await safe(getLatestRespiratoryRate, 'FR');
    const sleep = await safe(getSleepDuration, 'Sommeil');

    // HRV
    const hrvSamples: any[] = await safe(() => new Promise((resolve) => {
      AppleHealthKit.getHeartRateVariabilitySamples(
        { startDate: d7, limit: 5 } as any,
        (err, res) => err ? resolve([]) : resolve(res || [])
      );
    }), 'HRV Histo');

    // VO2 Max
    const vo2Samples: any[] = await safe(() => fetchSamples('getVo2MaxSamples', { startDate: d30, limit: 5 }), 'VO2 Histo');

    // SpO2
    const spo2Samples: any[] = await safe(() => fetchSamples('getOxygenSaturationSamples', { startDate: d7, limit: 5 }), 'SpO2 Histo');

    // Blood Pressure
    const bpSamples: any[] = await safe(() => fetchSamples('getBloodPressureSamples', { startDate: d30, limit: 5 }), 'BP Histo');

    // Walking HR Average
    const walkHr: number | null = await safe(() => new Promise((resolve) => {
      (AppleHealthKit as any).getWalkingHeartRateAverage(
        {},
        (err: any, res: any) => (err || !res) ? resolve(null) : resolve(res.value)
      );
    }), 'FC Marche');

    // Heart rate history (7j)
    const hrHistory: any[] = await safe(() => new Promise((resolve) => {
      AppleHealthKit.getHeartRateSamples(
        { startDate: d7, limit: 10 } as any,
        (err, res) => err ? resolve([]) : resolve(res || [])
      );
    }), 'HR Histo');

    // Sleep history (7j)
    const sleepHistory: any[] = await safe(() => new Promise((resolve) => {
      AppleHealthKit.getSleepSamples(
        { startDate: d7 },
        (err, res) => err ? resolve([]) : resolve(res || [])
      );
    }), 'Sleep Histo');

    // Respiratory rate history
    const respHistory: any[] = await safe(() => fetchSamples('getRespiratoryRateSamples', { startDate: d7, limit: 5 }), 'Resp Histo');

    console.log('┌──────────────────────────────────────┐');
    console.log('│        ❤️ SANTÉ & VITAUX             │');
    console.log('├──────────────────────────────────────┤');
    console.log(`│ Dernier relevé :`);
    console.log(`│   FC              : ${hr} bpm`);
    console.log(`│   FC Repos        : ${rhr} bpm`);
    console.log(`│   FC Marche Moy.  : ${walkHr} bpm`);
    console.log(`│   VFC (HRV)       : ${hrvSamples.length ? hrvSamples[0].value?.toFixed(0) : '?'} ms`);
    console.log(`│   VO2 Max         : ${vo2Samples.length ? vo2Samples[0].value?.toFixed(1) : '?'} mL/kg/min`);
    console.log(`│   SpO2            : ${spo2Samples.length ? (spo2Samples[0].value * 100).toFixed(0) : '?'} %`);
    console.log(`│   Tension         : ${bpSamples.length ? `${bpSamples[0].bloodPressureSystolicValue}/${bpSamples[0].bloodPressureDiastolicValue} mmHg` : 'N/A'}`);
    console.log(`│   Fréq. Resp.     : ${resp} mov/min`);
    console.log(`│   Sommeil         : ${sleep?.toFixed(1)} h`);
    console.log('│');
    console.log('│ 📊 Historique FC (7j, 10 derniers) :');
    printHistory('HR', hrHistory, s => `${Math.round(s.value)} bpm`);
    console.log('│ 📊 Historique HRV (7j) :');
    printHistory('HRV', hrvSamples, s => `${s.value?.toFixed(0)} ms`);
    console.log('│ 📊 Historique VO2 Max (30j) :');
    printHistory('VO2', vo2Samples, s => `${s.value?.toFixed(1)} mL/kg/min`);
    console.log('│ 📊 Historique SpO2 (7j) :');
    printHistory('SpO2', spo2Samples, s => `${(s.value * 100).toFixed(0)} %`);
    console.log('│ 📊 Historique Tension (30j) :');
    printHistory('BP', bpSamples, s => `${s.bloodPressureSystolicValue}/${s.bloodPressureDiastolicValue} mmHg`);
    console.log('│ 📊 Historique Fréq. Resp. (7j) :');
    printHistory('Resp', respHistory, s => `${s.value?.toFixed(1)} mov/min`);
    console.log('│ 📊 Historique Sommeil (7j) :');
    if (sleepHistory.length) {
      // Group sleep by date
      const byDate: Record<string, number> = {};
      sleepHistory.forEach((s: any) => {
        const date = s.startDate.split('T')[0];
        const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        byDate[date] = (byDate[date] || 0) + ms;
      });
      Object.entries(byDate).slice(0, 5).forEach(([date, ms]) => {
        console.log(`│   ${date} → ${(ms / 3600000).toFixed(1)} h`);
      });
    } else {
      console.log('│   (aucune donnée)');
    }
    console.log('└──────────────────────────────────────┘');

    console.log('\n🚀🚀🚀 [HealthKit] FIN DU DUMP COMPLET 🚀🚀🚀\n');
  } catch (error) {
    console.log('[HealthKit] Dump Error:', error);
  }
};
