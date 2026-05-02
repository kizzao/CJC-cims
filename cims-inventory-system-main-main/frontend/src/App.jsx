import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import ItemDetail from './pages/ItemDetail';
import Transactions from './pages/Transactions';
import Dispense from './pages/Dispense';
import Users from "./components/admin/Users";

function PrivateRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/:id" element={<ItemDetail />} />
        <Route path="dispense" element={<Dispense />} />
        <Route path="transactions" element={<Transactions />} />
        <Route 
          path="admin/users" 
          element={
            <PrivateRoute allowedRoles={['admin', 'head_nurse']}>
              <Users />
            </PrivateRoute>
          } 
        />
      </Route>
    </Routes>
  );
}

export default App;