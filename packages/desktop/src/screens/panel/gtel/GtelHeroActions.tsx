/** Dashboard / Call / Call Start — shared orange pill hero actions. */

import type { ReactNode } from 'react';

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import { Button, Stack } from '@mui/material';
import { gtelHeroBtnSx } from './styles';

export type GtelHeroActionId = 'dashboard' | 'call' | 'callStart';

type ActionDef = {
  id: GtelHeroActionId;
  label: string;
  icon: ReactNode;
  show: boolean;
  onClick: () => void;
};

const ICONS: Record<GtelHeroActionId, ReactNode> = {
  dashboard: <DashboardOutlinedIcon sx={{ fontSize: 18 }} />,
  call: <PhoneInTalkOutlinedIcon sx={{ fontSize: 18 }} />,
  callStart: <PlayArrowOutlinedIcon sx={{ fontSize: 18 }} />,
};

type Props = {
  showDashboard?: boolean;
  showCall?: boolean;
  onDashboard?: () => void;
  onCall?: () => void;
  onCallStart?: () => void;
};

export function GtelHeroActions({
  showDashboard = false,
  showCall = false,
  onDashboard,
  onCall,
  onCallStart,
}: Props) {
  const actions: ActionDef[] = (
    [
      {
        id: 'dashboard' as const,
        label: 'Dashboard',
        icon: ICONS.dashboard,
        show: showDashboard && Boolean(onDashboard),
        onClick: () => onDashboard?.(),
      },
      {
        id: 'call' as const,
        label: 'Call',
        icon: ICONS.call,
        show: showCall && Boolean(onCall),
        onClick: () => onCall?.(),
      },
      {
        id: 'callStart' as const,
        label: 'Call Start',
        icon: ICONS.callStart,
        show: showCall && Boolean(onCallStart),
        onClick: () => onCallStart?.(),
      },
    ] satisfies ActionDef[]
  ).filter((a) => a.show);

  if (!actions.length) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="contained"
          disableElevation
          startIcon={action.icon}
          onClick={action.onClick}
          sx={gtelHeroBtnSx}
        >
          {action.label}
        </Button>
      ))}
    </Stack>
  );
}
