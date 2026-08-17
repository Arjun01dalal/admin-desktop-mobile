import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Pagination, Stack, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import {
  getRoleId,
  getRoleName,
  hasPermission,
} from '@/auth/permissions';
import { CommonTable } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { getStoredUser } from '@/utils/dates';
import { AddUserDataDialog } from './users/AddUserDataDialog';
import {
  CreateUserDialog,
  type CreateUserMode,
} from './users/CreateUserDialog';
import { UsersDialogs } from './users/UsersDialogs';
import { UsersToolbar } from './users/UsersToolbar';
import { useUsersActions } from './users/useUsersActions';
import { useUsersColumns } from './users/useUsersColumns';
import { useUsersDialer } from './users/useUsersDialer';
import {
  useUsersQuery,
  type UsersAdmin,
} from './users/useUsersQuery';
import { isCallerRole, stableKey } from './users/usersHelpers';

/** Users page — converted from laxminarayan Users (caller + core admin). */
export function UsersPage() {
  const navigate = useNavigate();
  const canOpenUserReport = hasPermission('wallet_history');
  const admin = getStoredUser<UsersAdmin>();
  const isCaller = isCallerRole(getRoleId(admin) || admin?.Role_ID, getRoleName(admin));

  const renderUserName = useCallback(
    (r: { _id?: string; name?: string }) => {
      const label = String(r.name || '-');
      if (!canOpenUserReport || !r._id || !r.name) return label;
      return (
        <Typography
          component="button"
          type="button"
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/users/report/${encodeURIComponent(String(r._id))}/${encodeURIComponent(String(r.name))}`,
            );
          }}
          sx={{
            all: 'unset',
            cursor: 'pointer',
            color: '#4fc3f7',
            fontSize: 12,
            fontWeight: 600,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {label}
        </Typography>
      );
    },
    [canOpenUserReport, navigate],
  );

  const appsKey = stableKey(admin?.clientName ?? admin?.allotedApps);
  const statesKey = stableKey(admin?.accessibleStates);
  const allottedApps = useMemo(() => {
    const raw = admin?.clientName || admin?.allotedApps;
    return raw || undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appsKey]);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const accessibleStates = useMemo(() => {
    const raw = admin?.accessibleStates;
    if (!Array.isArray(raw)) return [] as string[];
    return raw.map((s) => String(s).toLowerCase()).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statesKey]);

  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');
  // Match laxminarayan: CallingBtn column when contact_visibility_none is off
  const showMobileColumn = !hideContact;
  const showDates =
    hasPermission('user_table') ||
    hasPermission('View_Users') ||
    hasPermission('All_user_table');
  const canRegister = !isCaller && hasPermission('Register_New_User');
  // Match laxminarayan + keep visible for Users operators
  const canCreateUser =
    !isCaller &&
    (hasPermission('create_new_user') ||
      hasPermission('Register_New_User') ||
      hasPermission('View_Users'));
  const canCreateAdmin =
    !isCaller &&
    (hasPermission('create_new_user') || hasPermission('View_Users'));
  const canAddToBot = hasPermission('add_to_bot');
  const canAddToDialer = hasPermission('add_to_dilaler');
  const canAddUserData = hasPermission('show_user_upload_data');

  const canViewSubAdmin = hasPermission('View_Subadmin_User');
  const canViewUserType =
    hasPermission('All_user_table') ||
    hasPermission('user_tab_with_search_only') ||
    hasPermission('View_Users') ||
    hasPermission('user_table');

  const query = useUsersQuery({
    allottedApps,
    accessibleStates,
    loginEmpCode,
    appsKey,
    adminAppWithState: admin?.appWithState,
    isCaller,
    canViewSubAdmin,
    canViewUserType,
  });

  const dialer = useUsersDialer({
    admin,
    rows: query.rows,
    dialerData: query.dialerData,
    setDialerData: query.setDialerData,
    total: query.total,
    applied: query.applied,
    clientName: query.clientName,
    playedIn: query.playedIn,
    uniqueUser: query.uniqueUser,
    userType: query.userType,
    startDate: query.startDate,
    endDate: query.endDate,
    itemsPerPage: query.itemsPerPage,
    isClientPagedType: query.isClientPagedType,
    allottedApps,
    accessibleStates,
    loginEmpCode,
    loadGlobals: query.loadGlobals,
  });

  const actions = useUsersActions({
    load: query.load,
    admin,
    isCaller,
    page: query.page,
    appliedBlockStatus: query.applied.blockStatus,
    setRows: query.setRows,
  });

  const [createMode, setCreateMode] = useState<CreateUserMode | null>(null);
  const [addUserDataOpen, setAddUserDataOpen] = useState(false);

  const columns = useUsersColumns({
    userType: query.userType,
    page: query.page,
    itemsPerPage: query.itemsPerPage,
    draft: query.draft,
    setDraft: query.setDraft,
    setDraftField: query.setDraftField,
    search: query.search,
    clientName: query.clientName,
    setClientName: query.setClientName,
    setPage: query.setPage,
    botId: dialer.botId,
    canShowMobile,
    showMobileColumn,
    hideContact,
    isCaller,
    loginEmpCode,
    actionBusyId: actions.actionBusyId,
    otpSending: actions.otpSending,
    blockCallerBusy: actions.blockCallerBusy,
    canEditSubAdminRole: actions.canEditSubAdminRole,
    locationDraft: actions.locationDraft,
    setLocationDraft: actions.setLocationDraft,
    locationBusyId: actions.locationBusyId,
    renderUserName,
    renderEmpCodeCell: actions.renderEmpCodeCell,
    openSubEdit: actions.openSubEdit,
    openRoleEdit: actions.openRoleEdit,
    updateSubAdminLocation: actions.updateSubAdminLocation,
    startBlockCaller: actions.startBlockCaller,
    openRealName: actions.openRealName,
    startBlockWithOtp: actions.startBlockWithOtp,
    openDump: actions.openDump,
  });

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1.5}
        sx={{ mb: 1, flexShrink: 0 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <UsersToolbar
            title="Users"
            startDate={query.startDate}
            endDate={query.endDate}
            userType={query.userType}
            typeOptions={query.typeOptions}
            itemsPerPage={query.itemsPerPage}
            uniqueUser={query.uniqueUser}
            clientName={query.clientName}
            playedIn={query.playedIn}
            botId={dialer.botId}
            campaignId={dialer.campaignId}
            globalCount={dialer.globalCount}
            total={query.total}
            loading={query.loading}
            dialerLoading={dialer.dialerLoading}
            dialerCount={
              query.total ||
              (query.dialerData.length
                ? query.dialerData.length
                : query.rows.length)
            }
            showDates={showDates}
            canRegister={canRegister}
            canAddToBot={canAddToBot}
            canAddUserData={canAddUserData}
            canAddToDialer={canAddToDialer}
            canCreateUser={canCreateUser}
            canCreateAdmin={canCreateAdmin}
            isCaller={isCaller}
            onStartDate={query.setStartDate}
            onEndDate={query.setEndDate}
            onClearDates={() => {
              query.setStartDate('');
              query.setEndDate('');
            }}
            onApply={() => {
              query.handleApply();
              void dialer.loadGlobals();
            }}
            onRefresh={() => void query.load(query.page)}
            onUserType={(v) => {
              query.setUserType(v);
              query.setPage(1);
            }}
            onItemsPerPage={(v) => {
              query.setItemsPerPage(v);
              query.setPage(1);
            }}
            onUniqueUser={(v) => {
              query.setUniqueUser(v);
              query.setPage(1);
            }}
            onClientName={(v) => {
              query.setClientName(v);
              query.setPage(1);
            }}
            onPlayedIn={(v) => {
              query.setPlayedIn(v);
              query.setPage(1);
            }}
            onBotId={dialer.setBotId}
            onCampaignId={dialer.setCampaignId}
            onRegister={() => setCreateMode('user')}
            onGlobalUser={() => {
              void dialer.loadGlobals().then((count) => {
                toast.info(`Global users: ${count}`);
              });
            }}
            onAddToBot={() => void dialer.handleAddToBot()}
            onAddUserData={() => setAddUserDataOpen(true)}
            onAddToDialer={() => void dialer.handleAddToDialer()}
            onCreateUser={() => setCreateMode('user')}
            onCreateAdmin={() => setCreateMode('admin')}
          />
        </Box>
      </Stack>

      <TablePanel
        footerJustify="center"
        footer={
          <Pagination
            count={query.totalPages}
            page={query.page}
            onChange={(_e, p) => query.setPage(p)}
            color="primary"
            size="medium"
          />
        }
      >
        <CommonTable
          columns={columns}
          rows={query.tableRows}
          getRowKey={(row, i) => String(row._id || i)}
          loading={query.loading}
          emptyMessage="No users found"
          stickyHeader
          minWidth={
            query.userType === 'Sub_Admin'
              ? 1600
              : query.userType === 'Non_Performing_Active_User'
                ? 1000
                : query.userType === 'LAXMI_999_Users'
                  ? 1800
                  : query.userType === 'In_Active_Deposit'
                    ? 2000
                    : isCaller
                      ? 1500
                      : 2000
          }
          dense
          maxHeight="100%"
          virtualize
        />
      </TablePanel>

      <CreateUserDialog
        open={createMode !== null}
        mode={createMode || 'user'}
        onClose={() => setCreateMode(null)}
        onCreated={() => void query.load(query.page)}
      />

      <AddUserDataDialog
        open={addUserDataOpen}
        uploader={admin}
        onClose={() => setAddUserDataOpen(false)}
      />

      <UsersDialogs
        block={actions.block}
        dump={actions.dump}
        subEdit={actions.subEdit}
        role={actions.role}
        realName={actions.realName}
        blockCaller={actions.blockCaller}
      />
    </Box>
  );
}
