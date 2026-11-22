import { useEffect } from 'react';
import { StoreProvider } from './store';
import { ConfirmProvider } from './components/ui';
import Layout from './components/Layout';
import { useRoute } from './lib/router';
import Dashboard from './pages/Dashboard';
import Daily from './pages/Daily';
import Weight from './pages/Weight';
import Nutrition from './pages/Nutrition';
import Gym from './pages/Gym';
import HistoryPage from './pages/History';
import Backup from './pages/Backup';
import SettingsPage from './pages/Settings';

function Routes({ route }: { route: string }) {
  switch (route) {
    case '/daily':
      return <Daily />;
    case '/weight':
      return <Weight />;
    case '/nutrition':
      return <Nutrition />;
    case '/gym':
      return <Gym />;
    case '/history':
      return <HistoryPage />;
    case '/backup':
      return <Backup />;
    case '/settings':
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  const route = useRoute();
  useEffect(() => window.scrollTo(0, 0), [route]);
  return (
    <StoreProvider>
      <ConfirmProvider>
        <Layout route={route}>
          <Routes route={route} />
        </Layout>
      </ConfirmProvider>
    </StoreProvider>
  );
}
