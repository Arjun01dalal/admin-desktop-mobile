/**
 * Menu hub — icon + wallet stats, categories in a grid; open a category to see its screens.
 * Opens screens on the root stack (no drawer).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { canAccessNavItem } from '../auth/permissions';
import { toDisplayText } from '../dashboards/jyotish/jyotishMapping';
import {
  groupNavItemsByCategory,
  type NavCategoryGroup,
} from '../navigation/navCategories';
import { iconForNavItem } from '../navigation/navItemIcons';
import { canOpenPanelPath, openPanelTarget } from '../navigation/panelDetail';
import { NAV_ITEMS, type NavItem } from '../navigation/navItems';
import { colors } from '../theme';
import { styles } from './WelcomeScreen.styles';
import { useMenuStats } from './useMenuStats';

function screenNameFor(item: NavItem): string {
  return item.id;
}

function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

export function WelcomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeCategory, setActiveCategory] = useState<NavCategoryGroup | null>(null);
  const [menuQuery, setMenuQuery] = useState('');
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessNavItem(item, user)),
    [user],
  );
  /** Balance KPIs match Dashboard access (View_Dashboard). */
  const canSeeDashboard = useMemo(
    () => items.some((item) => item.id === 'dashboard'),
    [items],
  );
  const canOpenWithdrawal = useMemo(
    () => items.some((item) => item.id === 'withdrawal'),
    [items],
  );
  const { stats, loading: statsLoading, refresh } = useMenuStats(canSeeDashboard);
  const categories = useMemo(() => groupNavItemsByCategory(items), [items]);

  const onPullRefresh = async () => {
    setPullRefreshing(true);
    try {
      if (canSeeDashboard) await refresh();
    } finally {
      setPullRefreshing(false);
    }
  };

  const filteredMenus = useMemo(() => {
    if (!activeCategory) return [];
    const q = menuQuery.trim().toLowerCase();
    if (!q) return activeCategory.items;
    return activeCategory.items.filter((item) =>
      toDisplayText(item.label).toLowerCase().includes(q),
    );
  }, [activeCategory, menuQuery]);

  const openCategory = (cat: NavCategoryGroup) => {
    setMenuQuery('');
    setActiveCategory(cat);
  };

  const backToCategories = useCallback(() => {
    setMenuQuery('');
    setActiveCategory(null);
  }, []);

  /** Android back: category → Menu (do not exit app). */
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (activeCategory) {
          backToCategories();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [activeCategory, backToCategories]),
  );

  const openItem = (item: NavItem) => {
    const nav = navigation as {
      navigate: (name: string) => void;
    };
    if (item.id === 'activeUserWithdrawal') {
      nav.navigate('/active-user-withdrawal');
      return;
    }
    if (item.id === 'incomingBotCall') {
      nav.navigate('/incoming-bot-call');
      return;
    }
    nav.navigate(screenNameFor(item));
  };

  const canOpenUsersBalance = canOpenPanelPath('/balance-f');

  /** Users Balance · Total → Dashboard · Pending Refund → Pending · Total Refund → Withdrawal */
  const openStatTile = (key: 'balance' | 'deposit' | 'pending' | 'total') => {
    const nav = navigation as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
    };
    // Total Users Balance → Users Balance list
    if (key === 'balance' && canOpenUsersBalance) {
      openPanelTarget(navigation, { href: '/balance-f' });
      return;
    }
    // Total (Deposits) → Dashboard
    if (key === 'deposit' && canSeeDashboard) {
      nav.navigate('dashboard');
      return;
    }
    if (key === 'pending' && canOpenWithdrawal) {
      nav.navigate('withdrawal', {
        status: 'Pending',
        startDate: stats?.asOfDate,
        endDate: stats?.asOfDate,
      });
      return;
    }
    // Total Refund → Withdrawal
    if (key === 'total' && canOpenWithdrawal) {
      nav.navigate('withdrawal');
    }
  };

  const hero = (
    <View style={styles.hero}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.heroIcon}
        resizeMode="contain"
        accessibilityLabel="Astro"
      />
      <Text style={styles.heroBrand}>ASTRO ADMIN</Text>
      {user?.name ? <Text style={styles.heroSub}>Hi {user.name}</Text> : null}

      {canSeeDashboard ? (
        <>
          {stats?.asOfDate ? (
            <Text style={styles.statsAsOf}>Today · {stats.asOfDate}</Text>
          ) : null}

          <View style={styles.statsRow}>
            {(
              [
                {
                  key: 'balance' as const,
                  label: 'Total Users Balance',
                  value: stats?.balance,
                  tappable: canOpenUsersBalance,
                },
                {
                  key: 'deposit' as const,
                  label: 'Total Deposits',
                  value: stats?.totalDeposit,
                  tappable: canSeeDashboard,
                },
                {
                  key: 'pending' as const,
                  label: 'Pending Withdrawal',
                  value: stats?.pendingWithdrawal,
                  tappable: canOpenWithdrawal,
                },
                {
                  key: 'total' as const,
                  label: 'Total Withdrawal',
                  value: stats?.totalWithdrawal,
                  tappable: canOpenWithdrawal,
                },
              ] as const
            ).map((tile) => {
              const body = (
                <>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    {toDisplayText(tile.label)}
                  </Text>
                  {statsLoading && stats == null ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={styles.statSpinner}
                    />
                  ) : (
                    <Text
                      style={styles.statValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {tile.value == null ? '—' : formatInr(tile.value)}
                    </Text>
                  )}
                </>
              );
              if (!tile.tappable) {
                return (
                  <View key={tile.key} style={styles.statTile}>
                    {body}
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  key={tile.key}
                  style={styles.statTile}
                  onPress={() => openStatTile(tile.key)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={toDisplayText(tile.label)}
                >
                  {body}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );

  if (activeCategory) {
    return (
      <View style={styles.shell}>
        <View style={styles.categoryPinned}>
          <View style={styles.backRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={backToCategories}
              accessibilityLabel="Back to Menu"
            >
              <MaterialIcons name="arrow-back" size={18} color={colors.foreground} />
              <Text style={styles.backBtnText}>Menu</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.header}>
            <View style={styles.categoryTitleRow}>
              <MaterialIcons name={activeCategory.icon} size={22} color={colors.primary} />
              <Text style={styles.title}>{activeCategory.title}</Text>
            </View>
            <Text style={styles.sub}>
              {filteredMenus.length}
              {menuQuery.trim() ? ` of ${activeCategory.items.length}` : ''} menu
              {filteredMenus.length === 1 ? '' : 's'} · tap to open
            </Text>
          </View>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={menuQuery}
              onChangeText={setMenuQuery}
              placeholder="Search menu…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {menuQuery.trim() ? (
              <TouchableOpacity
                onPress={() => setMenuQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.menuPane}>
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredMenus.length === 0 ? (
              <Text style={styles.empty}>No menu found</Text>
            ) : (
              <View style={styles.grid}>
                {filteredMenus.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuCard}
                    onPress={() => openItem(item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.menuCardIconWrap}>
                      <MaterialIcons
                        name={iconForNavItem(item.id, item.category)}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.menuCardLabel} numberOfLines={3}>
                      {toDisplayText(item.label)}
                    </Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      {/* Fixed — must stay outside any ScrollView */}
      <View style={styles.heroPinned} pointerEvents="box-none">
        {hero}
      </View>

      {/* Only this region scrolls */}
      <View style={styles.menuPane}>
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          refreshControl={
            canSeeDashboard ? (
              <RefreshControl
                refreshing={pullRefreshing}
                onRefresh={() => void onPullRefresh()}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Menu</Text>
            <Text style={styles.sub}>Choose a category to browse screens you can access.</Text>
          </View>

          {categories.length === 0 ? (
            <Text style={styles.empty}>No menu items available for your role.</Text>
          ) : (
            <View style={styles.grid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.catCard}
                  onPress={() => openCategory(cat)}
                  activeOpacity={0.8}
                >
                  <View style={styles.catIconWrap}>
                    <MaterialIcons name={cat.icon} size={22} color={colors.primary} />
                  </View>
                  <Text style={styles.catTitle} numberOfLines={2}>
                    {cat.title}
                  </Text>
                  <Text style={styles.catSub} numberOfLines={2}>
                    {cat.subtitle}
                  </Text>
                  <Text style={styles.catCount}>
                    {cat.items.length} item{cat.items.length === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
