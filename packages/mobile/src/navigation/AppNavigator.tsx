import React, { useMemo, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { RevealCodesOtpModal } from '../components/RevealCodesOtpModal';
import { CreateUserScreen } from '../screens/CreateUserScreen';
import { useRevealCodes } from '../context/useRevealCodes';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NAV_ITEMS, type NavItem } from './navItems';
import { PANEL_DETAIL_ROUTES } from './panelDetail';
import { canAccessNavItem } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { toDisplayText } from '../dashboards/jyotish/jyotishMapping';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { OpsDashboardScreen } from '../screens/dashboards/OpsDashboardScreen';
import { RiskAnalysisScreen } from '../screens/dashboards/RiskAnalysisScreen';
import { AnalysisScreen } from '../screens/dashboards/AnalysisScreen';
import { MasterFlowScreen } from '../screens/dashboards/details/MasterFlowScreen';
import { HouseGamesScreen } from '../screens/dashboards/details/HouseGamesScreen';
import { LeaderboardScreen } from '../screens/dashboards/details/LeaderboardScreen';
import { ProfitLossScreen } from '../screens/dashboards/details/ProfitLossScreen';
import { CallerResponsibilityScreen } from '../screens/dashboards/details/CallerResponsibilityScreen';
import { PlayerActivityScreen } from '../screens/dashboards/details/PlayerActivityScreen';
import { GameActivityScreen } from '../screens/dashboards/details/GameActivityScreen';
import { CallLogsScreen } from '../screens/dashboards/details/CallLogsScreen';
import { NewRegistersScreen } from '../screens/dashboards/details/NewRegistersScreen';
import { StateWiseRegistrationScreen } from '../screens/dashboards/details/StateWiseRegistrationScreen';
import { LoginReportScreen } from '../screens/dashboards/details/LoginReportScreen';
import { AllUserLoginReportScreen } from '../screens/dashboards/details/AllUserLoginReportScreen';
import { SosBlockedUsersScreen } from '../screens/dashboards/details/SosBlockedUsersScreen';
import { CheckersReportScreen } from '../screens/dashboards/details/CheckersReportScreen';
import { SheetDownloadReportScreen } from '../screens/dashboards/details/SheetDownloadReportScreen';
import { PointsReportScreen } from '../screens/dashboards/details/PointsReportScreen';
import { CoinRemovalListScreen } from '../screens/dashboards/details/CoinRemovalListScreen';
import { CustomerAllotmentScreen } from '../screens/dashboards/details/CustomerAllotmentScreen';
import { NonPerformingUserScreen } from '../screens/dashboards/details/NonPerformingUserScreen';
import { TodaysActiveScreen } from '../screens/dashboards/details/TodaysActiveScreen';
import { FeedbackScreen } from '../screens/dashboards/details/FeedbackScreen';
import { BetConstructGamesScreen } from '../screens/dashboards/details/BetConstructGamesScreen';
import { CasinoGamesScreen } from '../screens/dashboards/details/CasinoGamesScreen';
import { CasinoSwitchScreen } from '../screens/dashboards/details/CasinoSwitchScreen';
import { TopGamesScreen } from '../screens/dashboards/details/TopGamesScreen';
import { CasinoTopupBalanceScreen } from '../screens/dashboards/details/CasinoTopupBalanceScreen';
import { BannersScreen } from '../screens/dashboards/details/BannersScreen';
import { UpiPaymentsScreen } from '../screens/dashboards/details/UpiPaymentsScreen';
import { UpiListsScreen } from '../screens/dashboards/details/UpiListsScreen';
import { UtrProviderScreen } from '../screens/dashboards/details/UtrProviderScreen';
import { InstantDepositProvidersScreen } from '../screens/dashboards/details/InstantDepositProvidersScreen';
import { DepositProvidersScreen } from '../screens/dashboards/details/DepositProvidersScreen';
import { DepositConfigScreen } from '../screens/dashboards/details/DepositConfigScreen';
import { DepositScreen } from '../screens/dashboards/details/DepositScreen';
import { UsersKycScreen } from '../screens/dashboards/details/UsersKycScreen';
import { FundRequestScreen } from '../screens/dashboards/details/FundRequestScreen';
import { FundsScreen } from '../screens/dashboards/details/FundsScreen';
import { WithdrawalProvidersScreen } from '../screens/dashboards/details/WithdrawalProvidersScreen';
import { BotDataScreen } from '../screens/dashboards/details/BotDataScreen';
import { PlayerRtpScreen } from '../screens/dashboards/details/PlayerRtpScreen';
import { DumpUsersScreen } from '../screens/dashboards/details/DumpUsersScreen';
import { PercentageScreen } from '../screens/dashboards/details/PercentageScreen';
import { NewDepositsScreen } from '../screens/dashboards/details/NewDepositsScreen';
import { BotPerformanceScreen } from '../screens/dashboards/details/BotPerformanceScreen';
import { DepositListScreen } from '../screens/dashboards/details/DepositListScreen';
import { WithdrawalFundScreen } from '../screens/dashboards/details/WithdrawalFundScreen';
import { SocialMediaScreen } from '../screens/dashboards/details/SocialMediaScreen';
import { MobileAppScreen } from '../screens/dashboards/details/MobileAppScreen';
import { IncomingBotCallScreen } from '../screens/dashboards/details/IncomingBotCallScreen';
import { RolesResponsibilitiesScreen } from '../screens/dashboards/details/RolesResponsibilitiesScreen';
import { BonusWalletFundRequestScreen } from '../screens/dashboards/details/BonusWalletFundRequestScreen';
import { BonusWalletRequestsScreen } from '../screens/dashboards/details/BonusWalletRequestsScreen';
import { DepositApprovedReportScreen } from '../screens/dashboards/details/DepositApprovedReportScreen';
import { UniqueDepositPendingScreen } from '../screens/dashboards/details/UniqueDepositPendingScreen';
import { colors, radius, spacing } from '../theme';

const Drawer = createDrawerNavigator();
const RootStack = createNativeStackNavigator();

type AnyScreen = React.ComponentType<Record<string, unknown>>;

/** Map desktop route paths to implemented mobile screens. Unlisted paths get a placeholder. */
const IMPLEMENTED: Record<string, AnyScreen> = {
  '/welcome': WelcomeScreen as AnyScreen,
  '/dashboard': (() => <OpsDashboardScreen mode="main" />) as AnyScreen,
  '/vip-dashboard': (() => <OpsDashboardScreen mode="vip" />) as AnyScreen,
  '/combined-dashboard': (() => <OpsDashboardScreen mode="combined" />) as AnyScreen,
  '/risk-dashboard': RiskAnalysisScreen as AnyScreen,
  '/analytics': AnalysisScreen as AnyScreen,
  '/master-flow': MasterFlowScreen as AnyScreen,
  '/house-games': HouseGamesScreen as AnyScreen,
  '/leaderboard': LeaderboardScreen as AnyScreen,
  '/profit-loss': ProfitLossScreen as AnyScreen,
  '/caller-responsibility': CallerResponsibilityScreen as AnyScreen,
  '/player-activity': PlayerActivityScreen as AnyScreen,
  '/game-activity': GameActivityScreen as AnyScreen,
  '/call-logs': CallLogsScreen as AnyScreen,
  '/new-registers': NewRegistersScreen as AnyScreen,
  '/register-user-report': StateWiseRegistrationScreen as AnyScreen,
  '/login-report': LoginReportScreen as AnyScreen,
  '/all-user-login-report': AllUserLoginReportScreen as AnyScreen,
  '/sos-blocked-users': SosBlockedUsersScreen as AnyScreen,
  '/checkers-report': CheckersReportScreen as AnyScreen,
  '/downlaodReport': SheetDownloadReportScreen as AnyScreen,
  '/coins-report': PointsReportScreen as AnyScreen,
  '/coins-removal': CoinRemovalListScreen as AnyScreen,
  '/customer-allotment': CustomerAllotmentScreen as AnyScreen,
  '/non_performing_user': NonPerformingUserScreen as AnyScreen,
  '/todays-active': TodaysActiveScreen as AnyScreen,
  '/feedback': FeedbackScreen as AnyScreen,
  '/betConstruct-lists': BetConstructGamesScreen as AnyScreen,
  '/casino-lists': CasinoGamesScreen as AnyScreen,
  '/dynamic-casino-switching': CasinoSwitchScreen as AnyScreen,
  '/top-games': TopGamesScreen as AnyScreen,
  '/casino-topup-balance': CasinoTopupBalanceScreen as AnyScreen,
  '/banners': BannersScreen as AnyScreen,
  '/all-upi-payments': UpiPaymentsScreen as AnyScreen,
  '/upi-lists': UpiListsScreen as AnyScreen,
  '/utr-provider': UtrProviderScreen as AnyScreen,
  '/instant-provider': InstantDepositProvidersScreen as AnyScreen,
  '/pay-g-mid': DepositProvidersScreen as AnyScreen,
  '/deposit-config': DepositConfigScreen as AnyScreen,
  '/deposit': DepositScreen as AnyScreen,
  '/users-kyc': UsersKycScreen as AnyScreen,
  '/fund-request': FundRequestScreen as AnyScreen,
  '/funds': FundsScreen as AnyScreen,
  '/payout-accounts': WithdrawalProvidersScreen as AnyScreen,
  '/botData': BotDataScreen as AnyScreen,
  '/playerRtp': PlayerRtpScreen as AnyScreen,
  '/dumpUsers': DumpUsersScreen as AnyScreen,
  '/percentage': PercentageScreen as AnyScreen,
  '/newdeposits': NewDepositsScreen as AnyScreen,
  '/botPerformance': BotPerformanceScreen as AnyScreen,
  '/depositList': DepositListScreen as AnyScreen,
  '/withdrawal-fund': WithdrawalFundScreen as AnyScreen,
  '/social-media': SocialMediaScreen as AnyScreen,
  '/mobile-app': MobileAppScreen as AnyScreen,
  '/incoming-bot-call': IncomingBotCallScreen as AnyScreen,
  '/roles-responsibilities': RolesResponsibilitiesScreen as AnyScreen,
  '/fund-request-bonus-wallet': BonusWalletFundRequestScreen as AnyScreen,
  '/bonus-wallet': BonusWalletRequestsScreen as AnyScreen,
  '/DepositApprovedReport': DepositApprovedReportScreen as AnyScreen,
  '/unique_deposit_pending': UniqueDepositPendingScreen as AnyScreen,
  '/create-user': CreateUserScreen as AnyScreen,
};

function screenNameFor(item: NavItem): string {
  return item.id;
}

function CustomDrawer(props: DrawerContentComponentProps & { items: NavItem[] }) {
  const { items, ...rest } = props;
  const { logout, user } = useAuth();
  const current = rest.state.routes[rest.state.index]?.name;
  const [menuQuery, setMenuQuery] = useState('');
  const visibleItems = menuQuery.trim()
    ? items.filter((item) =>
        toDisplayText(item.label).toLowerCase().includes(menuQuery.trim().toLowerCase()),
      )
    : items;
  return (
    <DrawerContentScrollView {...rest} style={{ backgroundColor: colors.surface }}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Astro</Text>
        {user?.name ? <Text style={styles.drawerSub}>{user.name}</Text> : null}
      </View>
      <TextInput
        style={styles.drawerSearch}
        value={menuQuery}
        onChangeText={setMenuQuery}
        placeholder="🔍 Search menu…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {visibleItems.length === 0 ? (
        <Text style={styles.drawerNoMatch}>No menu found</Text>
      ) : null}
      {visibleItems.map((item) => (
        <DrawerItem
          key={item.id}
          label={toDisplayText(item.label)}
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

/**
 * Per-screen wrapper: opaque cosmic background behind every screen so
 * navigation transitions never show screens overlapping through
 * transparent roots.
 */
function Screened({ children }: { children: React.ReactNode }) {
  // Top inset is handled by the navigation header; bottom edge keeps content
  // clear of the home-indicator / gesture bar (and notch edges in landscape).
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBackground />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** Header icon-only toggle for reveal codes (👁 = locked, 🙈 = revealed). */
function RevealHeaderButton() {
  const reveal = useRevealCodes();
  const [otpOpen, setOtpOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => {
          // Before the hour expires: tap again reverses to secret/Jyotish names.
          if (reveal.active) {
            reveal.clear();
            return;
          }
          setOtpOpen(true);
        }}
        accessibilityLabel={reveal.active ? 'Hide original names' : 'Reveal original names'}
      >
        <Text style={styles.headerIconText}>{reveal.active ? '🙈' : '👁'}</Text>
      </TouchableOpacity>
      <RevealCodesOtpModal visible={otpOpen} onClose={() => setOtpOpen(false)} />
    </>
  );
}

function PanelDrawer({ items }: { items: NavItem[] }) {
  return (
    <Drawer.Navigator
        initialRouteName="welcome"
        drawerContent={(props) => <CustomDrawer {...props} items={items} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: '600' },
          headerRight: () => <RevealHeaderButton />,
          drawerType: 'front',
          overlayColor: 'rgba(0,0,0,0.55)',
          drawerStyle: { backgroundColor: colors.surface },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {items.map((item) => {
          const Impl = IMPLEMENTED[item.path];
          const title = toDisplayText(item.label);
          return (
            <Drawer.Screen
              key={item.id}
              name={screenNameFor(item)}
              options={{ title }}
            >
              {() => <Screened>{Impl ? <Impl /> : <PlaceholderScreen title={title} />}</Screened>}
            </Drawer.Screen>
          );
        })}
      </Drawer.Navigator>
  );
}

export function AppNavigator() {
  const { user } = useAuth();

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item)),
    [user],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <RootStack.Screen name="panel" options={{ headerShown: false }}>
          {() => <PanelDrawer items={items} />}
        </RootStack.Screen>
        {PANEL_DETAIL_ROUTES.map((route) => (
          <RootStack.Screen
            key={route.path}
            name={route.path}
            options={{ title: toDisplayText(route.title) }}
          >
            {() => (
              <Screened>
                <route.Component />
              </Screened>
            )}
          </RootStack.Screen>
        ))}
      </RootStack.Navigator>
      </NavigationContainer>
    </View>
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
  drawerSearch: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 13,
    marginHorizontal: spacing(3),
    marginBottom: spacing(2),
  },
  headerIconBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  headerIconText: { fontSize: 18 },
  drawerNoMatch: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: spacing(3),
  },
});
