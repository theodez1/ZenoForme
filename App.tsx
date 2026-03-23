import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import EvolutionScreen from './screens/EvolutionScreen';
import PhotosScreen from './screens/PhotosScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={100}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 32,
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            }}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom + 12,
          left: 24,
          right: 24,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarActiveTintColor: '#E8F97D',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused, color }) => {
          let iconName: any;
          if (route.name === "Moi") iconName = focused ? 'sunny' : 'sunny-outline';
          else if (route.name === 'Poids') iconName = focused ? 'trending-up' : 'trending-up-outline';
          else if (route.name === 'Photos') iconName = focused ? 'camera' : 'camera-outline';
          else if (route.name === 'Bilan') iconName = focused ? 'calendar' : 'calendar-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Moi" component={HomeScreen} />
      <Tab.Screen name="Poids" component={EvolutionScreen} />
      <Tab.Screen name="Photos" component={PhotosScreen} />
      <Tab.Screen name="Bilan" component={HistoryScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ animation: 'slide_from_right' }} 
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    paddingTop: 12,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
});