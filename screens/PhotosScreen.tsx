import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  updateDay, todayString, getAllDays,
  DayEntry, formatDate
} from '../utils/storage';

const SCREEN_W = Dimensions.get('window').width;

const C = {
  bg: '#0A0A0A',
  card: '#161616',
  border: '#1E1E1E',
  accent: '#E8F97D',
  text: '#F2F2F2',
  textSub: '#888',
  textMuted: '#444',
};

export default function PhotosScreen() {
  const insets = useSafeAreaInsets();
  const today = todayString();
  const [recentPhotos, setRecentPhotos] = useState<DayEntry[]>([]);

  const loadData = async () => {
    const all = await getAllDays();
    setRecentPhotos(all.filter(e => e.photoUri).sort((a, b) => b.date.localeCompare(a.date)));
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const persistImage = async (uri: string) => {
    const filename = `photo_${today}_${Date.now()}.jpg`;
    const newPath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: newPath });
    return newPath;
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission requise', 'Active la caméra dans les réglages.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [3, 4] });
    if (!result.canceled && result.assets[0]) {
      const uri = await persistImage(result.assets[0].uri);
      await updateDay(today, { photoUri: uri });
      loadData();
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission requise', 'Active l\'accès aux photos dans les réglages.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [3, 4] });
    if (!result.canceled && result.assets[0]) {
      const uri = await persistImage(result.assets[0].uri);
      await updateDay(today, { photoUri: uri });
      loadData();
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.heading}>Photos</Text>
          <Text style={s.subheading}>Ton évolution visuelle</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={takePhoto}>
          <Ionicons name="camera" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {recentPhotos.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="images-outline" size={48} color={C.textMuted} />
            </View>
            <Text style={s.emptyText}>Aucune photo pour l'instant</Text>
            <Text style={s.emptySub}>Capture tes progrès pour rester motivé !</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={pickPhoto}>
              <Text style={s.emptyBtnText}>Importer depuis la galerie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.grid}>
            {recentPhotos.map((p, i) => (
              <View key={p.date + i} style={s.photoCard}>
                <Image source={{ uri: p.photoUri }} style={s.photo} resizeMode="cover" />
                <View style={s.photoInfo}>
                  <Text style={s.photoDate}>{formatDate(p.date)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, marginBottom: 20 },
  heading: { color: C.text, fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subheading: { color: C.textSub, fontSize: 13, fontWeight: '500', marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: (SCREEN_W - 44) / 2, borderRadius: 24, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  photo: { width: '100%', aspectRatio: 3 / 4 },
  photoInfo: { padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', position: 'absolute', bottom: 0, left: 0, right: 0 },
  photoDate: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  empty: { flex: 1, height: 400, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: 'rgba(232,249,125,0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,249,125,0.2)' },
  emptyBtnText: { color: C.accent, fontSize: 14, fontWeight: '700' },
});