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
  if (pathname === '/playerRTPDetails') return '/playerRtp';
  if (pathname.startsWith('/caller-responsibility/deposit-list')) {
    return '/caller-responsibility';
  }
  if (pathname.startsWith('/caller-responsibility/bot-users')) {
    return '/caller-responsibility';
  }
  if (pathname.startsWith('/caller-responsibility/details')) {
    return '/caller-responsibility';
  }
  return null;
}
