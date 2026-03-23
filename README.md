# 💪 Mon Suivi — App de perte de poids

Une app Expo minimaliste pour tracker tes habitudes quotidiennes pendant ta perte de poids.

## Ce que l'app fait

- **Onglet Aujourd'hui** : Cocher marche/sport, noter alimentation (😄/😐/😞), hydratation (verres d'eau), sommeil, et ajouter une note libre
- **Score du jour** sur 100 pts pour voir d'un coup d'œil comment s'est passée ta journée
- **Streaks** 🔥 : compteur de jours consécutifs pour rester motivé
- **Onglet Photo** : Photo quotidienne optionnelle pour voir ta progression (grille de tes dernières photos)
- **Onglet Historique** : Heatmap des 28 derniers jours + stats (jours trackés, marches, photos, score moyen)

## Installation

### Prérequis
- Node.js 18+
- Expo Go sur ton téléphone (App Store / Play Store)

### Démarrer

```bash
# Dans le dossier du projet
npm install

# Lancer l'app
npx expo start
```

Puis scanne le QR code avec **Expo Go** sur ton téléphone.

## Structure des fichiers

```
WeightTracker/
├── App.tsx                    # Navigation principale
├── screens/
│   ├── HomeScreen.tsx         # Écran tracker quotidien
│   ├── PhotoScreen.tsx        # Écran photo
│   └── HistoryScreen.tsx      # Historique + stats
├── utils/
│   └── storage.ts             # Stockage local (AsyncStorage)
├── app.json
└── package.json
```

## Calcul du score

| Habitude | Points |
|----------|--------|
| Marche faite | 25 pts |
| Alimentation super | 25 pts / bof = 15 pts |
| 6+ verres d'eau | 25 pts / 3+ = 15 pts |
| Sommeil super | 25 pts / bof = 15 pts |
| Photo prise | +5 pts bonus |

**Score ≥ 75** 🟢 Top journée  
**Score 40-74** 🟡 Bonne progression  
**Score < 40** 🔴 Continue, chaque pas compte !

---

Bonne chance dans ton parcours ! 🌱
