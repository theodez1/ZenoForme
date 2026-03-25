import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSleepDetails, getSleepDuration } from '../utils/health';
import { formatDate } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');

interface SleepData {
  date: string;
  core: number;
  deep: number;
  rem: number;
  total: number;
  score: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E8F97D',
    letterSpacing: -0.5,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scoreCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#E8F97D',
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8F97D',
    marginBottom: 12,
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#E8F97D',
    textAlign: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  stagesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  stageCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  stageName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  stageValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  stageLabel: {
    fontSize: 12,
    color: '#999',
  },
  analysisCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232, 249, 125, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
  tipsCard: {
    backgroundColor: 'rgba(232, 249, 125, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(232, 249, 125, 0.3)',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8F97D',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8F97D',
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Sleep Score Calculation ───────────────────────────────────────────────────────
function calculateSleepScore(core: number, deep: number, rem: number, total: number): {
  score: number;
  grade: string;
  color: string;
  analysis: string[];
} {
  // Score basé sur la qualité des stades
  const deepRatio = deep / total;
  const coreRatio = core / total;
  const remRatio = rem / total;
  
  let score = 0;
  let grade = '';
  let color = '';
  let analysis: string[] = [];
  
  // Calcul du score (max 100)
  if (total >= 7 && total <= 9) {
    // Durée optimale
    score += 40;
  } else if (total >= 6 && total < 7) {
    // Durée correcte
    score += 30;
  } else if (total >= 5 && total < 6) {
    // Durée insuffisante
    score += 20;
  } else {
    // Durée très insuffisante
    score += 10;
  }
  
  // Qualité des stades
  if (deepRatio >= 0.2) {
    score += 30; // Bon sommeil profond
    analysis.push('✅ Temps de sommeil profond optimal');
  } else if (deepRatio >= 0.15) {
    score += 20; // Sommeil profond correct
    analysis.push('⚠️ Temps de sommeil profond légèrement faible');
  } else {
    analysis.push('❌ Temps de sommeil profond insuffisant');
  }
  
  if (remRatio >= 0.2 && remRatio <= 0.25) {
    score += 20; // Bon équilibre REM
    analysis.push('✅ Bon équilibre de sommeil REM');
  } else if (remRatio < 0.2) {
    analysis.push('⚠️ Sommeil REM réduit');
  } else {
    analysis.push('⚠️ Sommeil REM excessif');
  }
  
  if (coreRatio <= 0.5) {
    score += 10; // Bon équilibre global
    analysis.push('✅ Bon équilibre des stades de sommeil');
  }
  
  // Détermination du grade
  if (score >= 80) {
    grade = 'Excellent';
    color = '#4CAF50';
  } else if (score >= 60) {
    grade = 'Bon';
    color = '#8BC34A';
  } else if (score >= 40) {
    grade = 'Moyen';
    color = '#FF9800';
  } else {
    grade = 'À améliorer';
    color = '#F44336';
  }
  
  return { score, grade, color, analysis };
}

// ─── Sleep Analysis Component ───────────────────────────────────────────────────────
function SleepAnalysis({ core, deep, rem, total }: {
  core: number; deep: number; rem: number; total: number;
}) {
  const { score, grade, color, analysis } = calculateSleepScore(core, deep, rem, total);
  
  return (
    <View>
      {/* Score Card */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreTitle}>Score de Sommeil</Text>
        <Text style={[styles.scoreValue, { color }]}>{score}</Text>
        <Text style={styles.scoreLabel}>Qualité : {grade}</Text>
      </View>
      
      {/* Sleep Stages */}
      <View style={styles.stagesGrid}>
        <View style={styles.stageCard}>
          <Text style={styles.stageName}>CORE</Text>
          <Text style={[styles.stageValue, { color: '#64B5F6' }]}>
            {core.toFixed(1)}h
          </Text>
          <Text style={styles.stageLabel}>Sommeil léger</Text>
        </View>
        
        <View style={styles.stageCard}>
          <Text style={styles.stageName}>DEEP</Text>
          <Text style={[styles.stageValue, { color: '#4A90E2' }]}>
            {deep.toFixed(1)}h
          </Text>
          <Text style={styles.stageLabel}>Sommeil profond</Text>
        </View>
        
        <View style={styles.stageCard}>
          <Text style={styles.stageName}>REM</Text>
          <Text style={[styles.stageValue, { color: '#E91E63' }]}>
            {rem.toFixed(1)}h
          </Text>
          <Text style={styles.stageLabel}>Sommeil paradoxal</Text>
        </View>
      </View>
      
      {/* Analysis */}
      <View style={styles.analysisCard}>
        <Text style={styles.analysisTitle}>🧠 Analyse Intelligente</Text>
        {analysis.map((item, index) => (
          <View key={index} style={styles.insightItem}>
            <View style={styles.insightIcon}>
              <Ionicons 
                name={item.includes('✅') ? 'checkmark-circle' : item.includes('⚠️') ? 'warning' : 'close-circle'} 
                size={16} 
                color={item.includes('✅') ? '#4CAF50' : item.includes('⚠️') ? '#FF9800' : '#F44336'} 
              />
            </View>
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))}
      </View>
      
      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Axes d'Amélioration</Text>
        
        {deep < 1.5 && (
          <View style={styles.tipItem}>
            <View style={styles.tipBullet} />
            <Text style={styles.tipText}>
              Augmentez le sommeil profond en réduisant les écrans avant de dormir et en maintenant une température fraîche dans la chambre
            </Text>
          </View>
        )}
        
        {rem < 1 && (
          <View style={styles.tipItem}>
            <View style={styles.tipBullet} />
            <Text style={styles.tipText}>
              Le sommeil REM est essentiel pour la mémoire. Essayez des techniques de relaxation et évitez la caféine après 14h
            </Text>
          </View>
        )}
        
        {total < 6 && (
          <View style={styles.tipItem}>
            <View style={styles.tipBullet} />
            <Text style={styles.tipText}>
              Visez 7-8h de sommeil. Établissez une routine régulière en vous couchant et levant à la même heure
            </Text>
          </View>
        )}
        
        {total > 9 && (
          <View style={styles.tipItem}>
            <View style={styles.tipBullet} />
            <Text style={styles.tipText}>
              Trop de sommeil peut être signe de fatigue. Consultez un médecin si cela persiste
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────
export default function SleepScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [sleepData, setSleepData] = useState<SleepData | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const loadSleepData = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const details = await getSleepDetails(dateStr);
      
      if (details) {
        const { score, grade, color, analysis } = calculateSleepScore(
          details.core, details.deep, details.rem, details.total
        );
        
        setSleepData({
          date: dateStr,
          ...details,
          score,
        });
      } else {
        Alert.alert('Données indisponibles', 'Aucune donnée de sommeil trouvée pour cette date.');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de récupérer les données de sommeil.');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadSleepData(selectedDate);
  }, [selectedDate, loadSleepData]);
  
  const changeDate = (days: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8F97D" />
        <Text style={{ color: '#999', marginTop: 16 }}>Chargement des données de sommeil...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <BlurView tint="dark" intensity={100} style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#E8F97D" />
          </TouchableOpacity>
          <Text style={styles.title}>Sommeil</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>
      
      {sleepData && (
        <>
          {/* Date Selector */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            backgroundColor: '#1A1A1A',
            borderRadius: 16,
            padding: 16,
          }}>
            <TouchableOpacity 
              onPress={() => changeDate(-1)}
              style={{ padding: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#E8F97D" />
            </TouchableOpacity>
            <Text style={{ 
              color: '#FFF', 
              fontSize: 16, 
              fontWeight: '600',
              marginHorizontal: 20,
              minWidth: 120,
              textAlign: 'center'
            }}>
              {formatDate(sleepData.date)}
            </Text>
            <TouchableOpacity 
              onPress={() => changeDate(1)}
              style={{ padding: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={20} color="#E8F97D" />
            </TouchableOpacity>
          </View>
          
          {/* Sleep Analysis */}
          <SleepAnalysis {...sleepData} />
        </>
      )}
    </ScrollView>
  );
}
