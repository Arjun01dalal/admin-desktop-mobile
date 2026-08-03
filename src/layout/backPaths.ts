/**
 * Parent paths for nested panel routes reached via navigate() (not sidebar).
 * Used by AppShell to show a Back button automatically.
 */
export function getBackPath(pathname: string): string | null {
  if (pathname.startsWith('/users/report/')) return '/users';
  if (pathname.startsWith('/player-activity/details')) return '/player-activity';
  if (pathname.startsWith('/game-activity/details')) return '/game-activity';
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
  if (pathname === '/funds/mid') {
    return '/funds';
  }
  if (pathname === '/kycList') {
    return '/users-kyc';
  }
  return null;
}
