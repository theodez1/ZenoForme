import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // pas de son pour les rappels routiniers
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus = existing !== 'granted'
    ? (await Notifications.requestPermissionsAsync()).status
    : existing;

  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
    });
  }
  return true;
}

// ─── Contenu varié pour éviter l'effet "même notif chaque jour" ───────────────
const EVENING_NOTIFS = [
  { title: 'Bilan du soir', body: 'Tu as bu assez d\'eau aujourd\'hui ?' },
  { title: 'Fin de journée', body: 'Prends 30 secondes pour logger ta journée.' },
  { title: 'Récap du jour', body: 'Quelques secondes pour fermer la boucle.' },
  { title: 'Bilan du soir', body: 'Note ta journée pendant que c\'est frais.' },
];

const WATER_NOTIFS = [
  { title: 'Hydratation', body: 'Un verre d\'eau, c\'est maintenant !' },
  { title: 'Rappel eau', body: 'Tu penses à t\'hydrater ?' },
];

const WEIGHT_NOTIFS = [
  { title: 'Pesée du matin', body: 'Avant le petit-déj, c\'est le meilleur moment.' },
  { title: 'Pesée hebdo', body: 'Lundi = check du poids. 10 secondes chrono.' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function scheduleAll(hasWeightToday: boolean): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1. Rappel du soir à 20h30 — tous les jours
  const evening = pick(EVENING_NOTIFS);
  await Notifications.scheduleNotificationAsync({
    content: { ...evening, data: { screen: 'Home' } },
    trigger: { hour: 20, minute: 30, repeats: true },
  });

  // 2. Rappel eau à 14h — tous les jours (creux de l'après-midi)
  const water = pick(WATER_NOTIFS);
  await Notifications.scheduleNotificationAsync({
    content: { ...water, data: { screen: 'Home' } },
    trigger: { hour: 14, minute: 0, repeats: true },
  });

  // 3. Pesée lundi matin à 7h30 — trigger hebdo natif
  if (!hasWeightToday) {
    const weight = pick(WEIGHT_NOTIFS);
    await Notifications.scheduleNotificationAsync({
      content: { ...weight, data: { screen: 'Home' } },
      trigger: {
        weekday: 2, // 1 = dimanche, 2 = lundi dans expo
        hour: 7,
        minute: 30,
        repeats: true,
      },
    });

    // 4. Pesée vendredi matin à 7h30
    await Notifications.scheduleNotificationAsync({
      content: { ...weight, data: { screen: 'Home' } },
      trigger: {
        weekday: 6, // vendredi
        hour: 7,
        minute: 30,
        repeats: true,
      },
    });
  }
}