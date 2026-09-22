import { AppHeader } from '../components/AppHeader/AppHeader';
import { AppMain } from '../components/AppMain/AppMain';
import { useFitWorkbench } from '../hooks/useFitWorkbench';

export function App() {
  const workbench = useFitWorkbench();

  return (
    <div className="appShell">
      <AppHeader />
      <AppMain workbench={workbench} />
    </div>
  );
}
