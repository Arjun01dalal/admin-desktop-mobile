/**
 * Menu hub → stack route names (must match AppNavigator screen `name` = nav item id).
 */
export const MENU_ROUTES = {
  uniqueDepositPending: 'uniqueDepositPending',
} as const;

export type MenuRouteName = (typeof MENU_ROUTES)[keyof typeof MENU_ROUTES];
