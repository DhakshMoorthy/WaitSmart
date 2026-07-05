import { Tabs } from "expo-router";
import { Text, StyleSheet } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: "🏥",
    bookings: "📋",
    profile: "👤",
  };
  return <Text style={styles.icon}>{icons[name] || "•"}</Text>;
}

export default function PatientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "My Bookings",
          tabBarIcon: ({ focused }) => <TabIcon name="bookings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="clinics" options={{ href: null }} />
      <Tabs.Screen name="doctors" options={{ href: null }} />
      <Tabs.Screen name="slots" options={{ href: null }} />
      <Tabs.Screen name="book-confirm" options={{ href: null }} />
      <Tabs.Screen name="ticket" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 8,
    height: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  icon: {
    fontSize: 22,
  },
});
