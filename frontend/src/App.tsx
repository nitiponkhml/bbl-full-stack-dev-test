import { CssBaseline } from '@mui/material';
import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { Bookmarks } from './pages/Bookmarks';
import { Callback } from './pages/Callback';
import { Collections } from './pages/Collections';
import { Landing } from './pages/Landing';

function App(): ReactElement {
  return (
    <>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/callback" element={<Callback />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/collections" element={<Collections />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
