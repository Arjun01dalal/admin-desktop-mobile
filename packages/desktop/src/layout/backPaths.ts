/**
 * Parent paths for nested panel routes reached via navigate() (not sidebar).
 * Used by AppShell to show a Back button automatically.
 */
export function getBackPath(pathname: string): string | null {
  // User Report mounts its section dropdown beside this Back via BackRowActions.
  if (pathname.startsWith('/users/report/')) return '/users';
  if (pathname === '/bonus-wallet-referral-earning' || pathname === '/user_exposure') {
    return '/users';
  }
  if (pathname.startsWith('/player-activity/details')) return '/player-activity';
  if (pathname.startsWith('/game-activity/details')) return '/game-activity';
  if (
    pathname === '/falconRateManagement' ||
    pathname === '/exchangeRateManagement' ||
    pathname === '/activeUserData' ||
    pathname === '/betConstructGamesList' ||
    pathname === '/falcon-rate-management' ||
    pathname === '/exchange-rate-management' ||
    pathname === '/liveMatchTotal' ||
    pathname === '/masterLiveMatchTotal' ||
    pathname === '/bothLiveMatchTotal' ||
    pathname === '/bothMasterAddPage' ||
    pathname === '/masterDashboard'
  ) {
    return '/dashboard';
  }
  if (
    pathname === '/balance-f' ||
    pathname === '/total-bonus-users-p' ||
    pathname === '/registered-users'
  ) {
    return '/dashboard';
  }
  if (pathname.startsWith('/coins-removal/details')) return '/coins-removal';
  if (pathname === '/coin-reports/report') return '/coins-report';
  if (pathname === '/customer-allotted') return '/customer-allotment';
  if (pathname === '/customer-count') return '/leaderboard';
  if (pathname.startsWith('/playerRtp/details')) return '/playerRtp';
  if (pathname.startsWith('/caller-responsibility/deposit-list')) {
    return '/caller-responsibility';
  }
  if (pathname.startsWith('/caller-responsibility/bot-users')) {
    return '/caller-responsibility';
  }
  if (pathname.startsWith('/caller-responsibility/details')) {
    return '/caller-responsibility';
  }
  if (pathname === '/fund-request-bonus-wallet-table') {
    return '/fund-request-bonus-wallet';
  }
  if (pathname === '/withdraw-user-data') {
    return '/withdrawal-fund';
  }
  if (pathname.startsWith('/depositList/')) {
    return '/depositList';
  }
  if (pathname === '/funds/mid/payingAccount' || pathname === '/funds/payin') {
    return '/funds/mid';
  }
  if (pathname === '/funds/mid' || pathname === '/funds/mid-groups') {
    return '/funds';
  }
  if (pathname === '/kycList') {
    return '/users-kyc';
  }
  return null;
}
