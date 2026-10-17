import React, { useMemo, useState } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  useNavigation,
} from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  Text,
  TextInput,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppBackground } from '../components/AppBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NAV_ITEMS, type NavItem } from './navItems';
import { canAccessPanelDetail, PANEL_DETAIL_ROUTES } from './panelDetail';
import { resolveLazyScreen } from './lazyScreens';
import { canAccessNavItem } from '../auth/permissions';
import { SosProvider } from '../auth/useSosGuard';
import { SosAlertOverlay } from '../components/SosAlertOverlay';
import { AdminLlmChatHeaderButton } from '../components/AdminLlmChatWidget';
import { useAuth } from '../auth/AuthContext';
import { toDisplayText } from '../dashboards/jyotish/jyotishMapping';
import { useRevealCodes } from '../context/useRevealCodes';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { colors, isDarkTheme } from '../theme';
import { getAppVersion } from '../utils/appVersion';
import { styles } from './AppNavigator.styles';

const Drawer = createDrawerNavigator();

/** Stack routes that keep WebViews / live polling — unmount when left. */
const HEAVY_STACK_UNMOUNT = new Set([
  '/liveMatchTotal',
  '/masterLiveMatchTotal',
  '/bothLiveMatchTotal',
  '/incoming-bot-call',
  '/sky-talk',
]);

type RootStackParamList = {
  panel: undefined;
  profile: undefined;
  '/active-user-withdrawal': undefined;
  '/incoming-bot-call': undefined;
  '/gtel-caller-dashboard': undefined;
  '/gtel-caller-calls': undefined;
  '/c2c-campaign-detail': undefined;
  [route: string]: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

type AnyScreen = React.ComponentType<Record<string, unknown>>;

function screenNameFor(item: NavItem): string {
  return item.id;
}

/** Load screen module on first visit; wrap with safe-area chrome (no per-screen background). */
function LazyScreened({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const Impl = resolveLazyScreen(path);
  return <Screened>{Impl ? <Impl /> : <PlaceholderScreen title={title} />}</Screened>;
}

/** Stable route components — avoid remount loops when Drawer re-renders / setOptions runs. */
const drawerRouteCache = new Map<string, React.ComponentType>();

function getDrawerRouteComponent(path: string, title: string): React.ComponentType {
  const key = `${path}\0${title}`;
  let Route = drawerRouteCache.get(key);
  if (!Route) {
    function DrawerRoute() {
      return <LazyScreened path={path} title={title} />;
    }
    DrawerRoute.displayName = `DrawerRoute(${path})`;
    Route = DrawerRoute;
    drawerRouteCache.set(key, Route);
  }
  return Route;
}

function CustomDrawer(props: DrawerContentComponentProps & { items: NavItem[] }) {
  const { items, ...rest } = props;
  const { user } = useAuth();
  useRevealCodes(); // refresh drawer labels immediately after OTP reveal
  const current = rest.state.routes[rest.state.index]?.name;
  const [menuQuery, setMenuQuery] = useState('');
  const visibleItems = menuQuery.trim()
    ? items.filter((item) =>
        toDisplayText(item.label).toLowerCase().includes(menuQuery.trim().toLowerCase()),
      )
    : items;
  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.drawerRoot}>
      <View style={styles.drawerStickyTop}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Astro</Text>
          {user?.name ? <Text style={styles.drawerSub}>{user.name}</Text> : null}
        </View>
        <View style={styles.drawerSearchWrap}>
          <TextInput
            style={styles.drawerSearch}
            value={menuQuery}
            onChangeText={setMenuQuery}
            placeholder="🔍 Search menu…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {menuQuery.trim() ? (
            <TouchableOpacity
              style={styles.drawerSearchClear}
              onPress={() => setMenuQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear menu search"
            >
              <Text style={styles.drawerSearchClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <DrawerContentScrollView
        {...rest}
        style={styles.drawerScroll}
        contentContainerStyle={styles.drawerScrollContent}
      >
        {visibleItems.length === 0 ? <Text style={styles.drawerNoMatch}>No menu found</Text> : null}
        {visibleItems.map((item) => (
          <DrawerItem
            key={item.id}
            label={toDisplayText(item.label)}
            focused={current === screenNameFor(item)}
            activeTintColor={colors.primary}
            inactiveTintColor={colors.muted}
            onPress={() => {
              const nav = rest.navigation;
              if (item.id === 'activeUserWithdrawal' || item.id === 'incomingBotCall') {
                nav.closeDrawer();
                const parent = nav.getParent<NativeStackNavigationProp<RootStackParamList>>();
                if (parent) {
                  parent.navigate(
                    item.id === 'incomingBotCall'
                      ? '/incoming-bot-call'
                      : '/active-user-withdrawal',
                  );
                }
                return;
              }
              nav.navigate(screenNameFor(item));
              nav.closeDrawer();
            }}
            style={styles.drawerItem}
            labelStyle={styles.drawerItemLabel}
          />
        ))}
      </DrawerContentScrollView>
      <View style={styles.drawerFooter}>
        <Text style={styles.drawerVersion}>v{getAppVersion()}</Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Per-screen chrome only — cosmic background lives once under AppNavigator
 * so we do not remount 70 SVG circles on every route / reveal toggle.
 */
function Screened({ children }: { children: React.ReactNode }) {
  const reveal = useRevealCodes();
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      <View
        key={reveal.active ? `revealed-${reveal.expiresAt}` : 'hidden'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

function GuardedPanelDetail({ route }: { route: (typeof PANEL_DETAIL_ROUTES)[number] }) {
  const { user } = useAuth();
  if (!canAccessPanelDetail(route.path, user)) {
    return <PlaceholderScreen title="You do not have permission to view this page." />;
  }
  const Comp = route.getComponent();
  return <Comp />;
}

function PanelHeaderRight() {
  return (
    <View style={styles.headerRightRow}>
      <AdminLlmChatHeaderButton />
      <ProfileHeaderButton />
    </View>
  );
}

function ProfileHeaderButton() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => {
        const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        if (parent) parent.navigate('profile');
        else (navigation as NativeStackNavigationProp<RootStackParamList>).navigate('profile');
      }}
      accessibilityLabel="Profile"
    >
      <MaterialIcons name="account-circle" size={26} color={colors.foreground} />
    </TouchableOpacity>
  );
}

function PanelDrawer({ items }: { items: NavItem[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(230, Math.round(screenWidth * 0.7));

  return (
    <Drawer.Navigator
      initialRouteName="welcome"
      drawerContent={(props) => <CustomDrawer {...props} items={items} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        headerRight: () => <PanelHeaderRight />,
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.55)',
        drawerStyle: {
          backgroundColor: colors.surface,
          width: drawerWidth,
        },
        sceneStyle: { backgroundColor: 'transparent' },
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      {items
        .filter(
          (item) => item.id !== 'activeUserWithdrawal' && item.id !== 'incomingBotCall',
        )
        .map((item) => {
          const title = toDisplayText(item.label);
          return (
            <Drawer.Screen
              key={item.id}
              name={screenNameFor(item)}
              options={{ title, freezeOnBlur: true }}
              getComponent={() => getDrawerRouteComponent(item.path, title)}
            />
          );
        })}
    </Drawer.Navigator>
  );
}

export function AppNavigator() {
  const { user } = useAuth();
  useRevealCodes();

  const items = useMemo(() => NAV_ITEMS.filter((item) => canAccessNavItem(item, user)), [user]);

  return (
    <SosProvider enabled={!!user}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBackground />
        <NavigationContainer
          theme={{
            ...(isDarkTheme() ? DarkTheme : DefaultTheme),
            colors: {
              ...(isDarkTheme() ? DarkTheme.colors : DefaultTheme.colors),
              background: 'transparent',
              card: colors.surface,
              text: colors.foreground,
              primary: colors.primary,
              border: colors.border,
            },
          }}
        >
          <RootStack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.foreground,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'slide_from_right',
              freezeOnBlur: true,
            }}
          >
            <RootStack.Screen name="panel" options={{ headerShown: false }}>
              {() => <PanelDrawer items={items} />}
            </RootStack.Screen>
            <RootStack.Screen
              name="profile"
              options={{ title: 'Profile' }}
              getComponent={() => {
                function ProfileRoute() {
                  const { ProfileScreen } = require('../screens/ProfileScreen');
                  return (
                    <Screened>
                      <ProfileScreen />
                    </Screened>
                  );
                }
                return ProfileRoute;
              }}
            />
            <RootStack.Screen
              name="/active-user-withdrawal"
              options={{ title: toDisplayText('Active User Withdrawal') }}
              getComponent={() => {
                function Route() {
                  return (
                    <LazyScreened
                      path="/active-user-withdrawal"
                      title={toDisplayText('Active User Withdrawal')}
                    />
                  );
                }
                return Route;
              }}
            />
            <RootStack.Screen
              name="/incoming-bot-call"
              options={{
                title: toDisplayText('Incoming Bot Call'),
                freezeOnBlur: true,
                unmountOnBlur: true,
              }}
              getComponent={() => {
                function Route() {
                  return (
                    <LazyScreened
                      path="/incoming-bot-call"
                      title={toDisplayText('Incoming Bot Call')}
                    />
                  );
                }
                return Route;
              }}
            />
            <RootStack.Screen
              name="/gtel-caller-dashboard"
              options={{
                title: toDisplayText('Caller Dashboard'),
                freezeOnBlur: true,
              }}
              getComponent={() => {
                function Route() {
                  return (
                    <LazyScreened
                      path="/gtel-caller-dashboard"
                      title={toDisplayText('Caller Dashboard')}
                    />
                  );
                }
                return Route;
              }}
            />
            {/* Dashboard → Calls: unguarded LazyScreen so hideHeroActions params apply
                even when the user only has show_gtel_dashboard (not show_gtel_calls). */}
            <RootStack.Screen
              name="/gtel-caller-calls"
              options={{
                title: toDisplayText('Gtel Calls'),
                freezeOnBlur: true,
              }}
              getComponent={() => {
                function Route() {
                  return (
                    <LazyScreened
                      path="/gtel-calls"
                      title={toDisplayText('Gtel Calls')}
                    />
                  );
                }
                return Route;
              }}
            />
            <RootStack.Screen
              name="/c2c-campaign-detail"
              options={{
                title: toDisplayText('Campaign'),
                freezeOnBlur: true,
              }}
              getComponent={() => {
                function Route() {
                  return (
                    <LazyScreened
                      path="/c2c-campaign-detail"
                      title={toDisplayText('Campaign')}
                    />
                  );
                }
                return Route;
              }}
            />
            {PANEL_DETAIL_ROUTES.map((route) => (
              <RootStack.Screen
                key={route.path}
                name={route.path}
                options={{
                  title: toDisplayText(route.title),
                  freezeOnBlur: true,
                  ...(HEAVY_STACK_UNMOUNT.has(route.path) ? { unmountOnBlur: true } : null),
                }}
                getComponent={() => {
                  function Route() {
                    return (
                      <Screened>
                        <GuardedPanelDetail route={route} />
                      </Screened>
                    );
                  }
                  return Route;
                }}
              />
            ))}
          </RootStack.Navigator>
        </NavigationContainer>
        {user ? <SosAlertOverlay /> : null}
      </View>
    </SosProvider>
  );
}

// Satisfy unused type lint if any
export type { AnyScreen };
