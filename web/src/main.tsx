import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installPreloadRecovery } from '@/app/preload-recovery';
import { AppProviders } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/routes';
import './styles/main.css';

installPreloadRecovery();

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing #root');

createRoot(root).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
