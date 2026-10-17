/**
 * Root navigation — Menu hub + native stack (no drawer).
 */
import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  useNavigation,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { Text, View, TouchableOpacity } from 'react-native';
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
import { styles } from './AppNavigator.styles';

/** Stack routes that keep WebViews / live polling — unmount when left. */
const HEAVY_STACK_UNMOUNT = new Set([
  '/liveMatchTotal',
  '/masterLiveMatchTotal',
  '/bothLiveMatchTotal',
  '/incoming-bot-call',
  '/sky-talk',
]);

/** Nav items hosted only as path-named stack screens (not by id). */
const STACK_ONLY_NAV_IDS = new Set(['activeUserWithdrawal', 'incomingBotCall']);

type RootStackParamList = {
  welcome: undefined;
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
function LazyScreened({ path, title }: { path: string; title: string }) {
  const Impl = resolveLazyScreen(path);
  return <Screened>{Impl ? <Impl /> : <PlaceholderScreen title={title} />}</Screened>;
}

/** Stable route components — avoid remount loops when setOptions runs. */
const routeCache = new Map<string, React.ComponentType>();

function getStackRouteComponent(path: string, title: string): React.ComponentType {
  const key = `${path}\0${title}`;
  let Route = routeCache.get(key);
  if (!Route) {
    function StackRoute() {
      return <LazyScreened path={path} title={title} />;
    }
    StackRoute.displayName = `StackRoute(${path})`;
    Route = StackRoute;
    routeCache.set(key, Route);
  }
  return Route;
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

function MenuHomeHeaderButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => navigation.navigate('welcome')}
      accessibilityLabel="Menu"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="apps" size={24} color={colors.foreground} />
    </TouchableOpacity>
  );
}

function ProfileHeaderButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => navigation.navigate('profile')}
      accessibilityLabel="Profile"
    >
      <MaterialIcons name="account-circle" size={26} color={colors.foreground} />
    </TouchableOpacity>
  );
}

function HeaderRight({ showMenuHome }: { showMenuHome: boolean }) {
  return (
    <View style={styles.headerRightRow}>
      {showMenuHome ? <MenuHomeHeaderButton /> : null}
      <AdminLlmChatHeaderButton />
      <ProfileHeaderButton />
    </View>
  );
}

export function AppNavigator() {
  const { user } = useAuth();
  useRevealCodes();

  const items = useMemo(() => NAV_ITEMS.filter((item) => canAccessNavItem(item, user)), [user]);

  const panelItems = useMemo(
    () => items.filter((item) => !STACK_ONLY_NAV_IDS.has(item.id)),
    [items],
  );

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
            initialRouteName="welcome"
            screenOptions={({ route }) => {
              const isMenu = route.name === 'welcome';
              return {
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.foreground,
                headerTitleStyle: { fontWeight: '600' as const, fontSize: 16 },
                headerRight: () => <HeaderRight showMenuHome={!isMenu} />,
                headerBackVisible: !isMenu,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'slide_from_right' as const,
                freezeOnBlur: true,
              };
            }}
          >
            {panelItems.map((item) => {
              const title = toDisplayText(item.label);
              return (
                <RootStack.Screen
                  key={item.id}
                  name={screenNameFor(item)}
                  options={{ title, freezeOnBlur: true }}
                  getComponent={() => getStackRouteComponent(item.path, title)}
                />
              );
            })}

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
                    <LazyScreened path="/gtel-calls" title={toDisplayText('Gtel Calls')} />
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

export type { AnyScreen };
