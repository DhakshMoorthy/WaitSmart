import { Tabs } from "expo-router";
import { Text, StyleSheet } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ name }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    queue: "📊",
    schedule: "📅",
    "doctor-profile": "👤",
  };
  return <Text style={styles.icon}>{icons[name] || "•"}</Text>;
}

export default function DoctorLayout() {
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
        name="queue"
        options={{
          title: "Queue",
          tabBarIcon: ({ focused }) => <TabIcon name="queue" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ focused }) => <TabIcon name="schedule" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="doctor-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="doctor-profile" focused={focused} />
          ),
        }}
      />
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
