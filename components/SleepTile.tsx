import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

// Couleurs directement définies pour éviter les imports circulaires
const C = {
  bg: '#0A0A0A',
  surface: '#111111',
  text: '#FFF',
  textSub: '#999',
  accent: '#E8F97D',
};

const s = StyleSheet.create({
  tile: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default function SleepTile() {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Sleep');
  };

  return (
    <TouchableOpacity
      style={s.tile}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={s.header}>
        <View style={s.icon}>
          <Ionicons name="moon" size={18} color="#9333EA" />
        </View>
        <View>
          <Text style={s.title}>Analyse de Sommeil</Text>
          <Text style={s.subtitle}>Score détaillé et conseils personnalisés</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
