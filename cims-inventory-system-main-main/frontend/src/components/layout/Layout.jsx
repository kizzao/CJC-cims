import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  History,
  LogOut,
  User,
  Users,
  Shield
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/dispense', icon: PlusCircle, label: 'Dispense' },
    { path: '/transactions', icon: History, label: 'History' },
  ];

  const adminNavItems = [
    { path: '/admin/users', icon: Users, label: 'Manage Users' },
  ];

  const navItems = [
    ...baseNavItems,
    ...(user?.role === 'admin' || user?.role === 'head_nurse' ? adminNavItems : [])
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-red-900 flex flex-col">
        <div className="p-6 border-b border-yellow-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white">
              <img
                src="/CJC LOGO.png"
                alt="CJC Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-white">School Clinic</h1>
              <p className="text-xs text-yellow-200/70">Inventory System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-yellow-600 text-white font-medium'
                    : 'text-white/80 hover:bg-red-800'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-yellow-600/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center">
              {user?.role === 'admin' || user?.role === 'head_nurse' ? (
                <Shield size={20} className="text-yellow-400" />
              ) : (
                <User size={20} className="text-yellow-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{user?.fullName || user?.full_name}</p>
              <p className="text-xs text-yellow-200/70 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-red-200 hover:bg-red-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}