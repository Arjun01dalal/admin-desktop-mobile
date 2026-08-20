import { ColorModeProvider } from '@/context/ColorModeContext';
import { AppInner } from '@/app/AppInner';

export default function App() {
  return (
    <ColorModeProvider>
      <AppInner />
    </ColorModeProvider>
  );
}
