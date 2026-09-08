import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import ChatPage from './pages/ChatPage/ChatPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ChatPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
