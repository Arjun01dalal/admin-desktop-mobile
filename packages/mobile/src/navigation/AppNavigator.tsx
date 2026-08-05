import React, { useMemo } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { StyleSheet, Text, View } from 'react-native';
import { NAV_ITEMS, type NavItem } from './navItems';
import { canAccessNavItem } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { OpsDashboardScreen } from '../screens/dashboards/OpsDashboardScreen';
import { RiskAnalysisScreen } from '../screens/dashboards/RiskAnalysisScreen';
import { colors } from '../theme';

const Drawer = createDrawerNavigator();

type AnyScreen = React.ComponentType<Record<string, unknown>>;

/** Map desktop route paths to implemented mobile screens. Unlisted paths get a placeholder. */
const IMPLEMENTED: Record<string, AnyScreen> = {
  '/welcome': WelcomeScreen as AnyScreen,
  '/dashboard': (() => <OpsDashboardScreen mode="main" />) as AnyScreen,
  '/vip-dashboard': (() => <OpsDashboardScreen mode="vip" />) as AnyScreen,
  '/combined-dashboard': (() => <OpsDashboardScreen mode="combined" />) as AnyScreen,
  '/risk-dashboard': RiskAnalysisScreen as AnyScreen,
};

function screenNameFor(item: NavItem): string {
  return item.id;
}

function CustomDrawer(props: DrawerContentComponentProps & { items: NavItem[] }) {
  const { items, ...rest } = props;
  const { logout, user } = useAuth();
  const current = rest.state.routes[rest.state.index]?.name;
  return (
    <DrawerContentScrollView {...rest} style={{ backgroundColor: colors.surface }}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Astro Admin</Text>
        {user?.name ? <Text style={styles.drawerSub}>{user.name}</Text> : null}
      </View>
      {items.map((item) => (
        <DrawerItem
          key={item.id}
          label={item.label}
          focused={current === screenNameFor(item)}
          activeTintColor={colors.primary}
          inactiveTintColor={colors.muted}
          onPress={() => rest.navigation.navigate(screenNameFor(item))}
        />
      ))}
      <DrawerItem label="Logout" inactiveTintColor={colors.destructive} onPress={logout} />
    </DrawerContentScrollView>
  );
}

export function AppNavigator() {
  const { user } = useAuth();

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item)),
    [user],
  );

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.foreground,
          primary: colors.primary,
          border: colors.border,
        },
      }}
    >
      <Drawer.Navigator
        initialRouteName="welcome"
        drawerContent={(props) => <CustomDrawer {...props} items={items} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: '600' },
          drawerStyle: { backgroundColor: colors.surface },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {items.map((item) => {
          const Impl = IMPLEMENTED[item.path];
          return (
            <Drawer.Screen
              key={item.id}
              name={screenNameFor(item)}
              options={{ title: item.label }}
            >
              {() => (Impl ? <Impl /> : <PlaceholderScreen title={item.label} />)}
            </Drawer.Screen>
          );
        })}
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  drawerTitle: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  drawerSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
});
