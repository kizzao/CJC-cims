import { useQuery } from 'react-query';
import { 
  Package, 
  AlertTriangle, 
  AlertCircle, 
  XCircle,
  Activity,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, color, subtitle, to }) => {
  const content = (
    <div className={`card hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

const StatusBadge = ({ status }) => {
  const styles = {
    EXPIRED: 'bg-red-100 text-red-800 border-red-200',
    OUT_OF_STOCK: 'bg-red-100 text-red-800',
    LOW_STOCK: 'bg-orange-100 text-orange-800',
    EXPIRING_SOON: 'bg-yellow-100 text-yellow-800'
  };

  const labels = {
    EXPIRED: 'Expired',
    OUT_OF_STOCK: 'Out of Stock',
    LOW_STOCK: 'Low Stock',
    EXPIRING_SOON: 'Expiring Soon'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
};

export default function Dashboard() {
  const { data, isLoading } = useQuery('dashboard', () => 
    api.get('/dashboard/overview').then(res => res.data)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const alerts = data?.alerts || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your clinic inventory</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Items"
          value={stats.totalItems || 0}
          icon={Package}
          color="bg-blue-500"
          subtitle="In inventory"
          to="/inventory"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStock || 0}
          icon={AlertTriangle}
          color="bg-orange-500"
          subtitle="Below minimum threshold"
          to="/inventory?status=LOW_STOCK"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoon || 0}
          icon={Clock}
          color="bg-yellow-500"
          subtitle="Within 30 days"
          to="/inventory?status=EXPIRING_SOON"
        />
        <StatCard
          title="Expired"
          value={stats.expired || 0}
          icon={XCircle}
          color="bg-red-500"
          subtitle="Needs disposal"
          to="/inventory?status=EXPIRED"
        />
      </div>

      {/* Today's Activity */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-lg">
            <Activity size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Today's Activity</h3>
            <p className="text-gray-600">
              {stats.todayTransactions?.count || 0} dispenses ({stats.todayTransactions?.quantity || 0} items)
            </p>
          </div>
          <Link 
            to="/dispense" 
            className="ml-auto btn-primary"
          >
            <TrendingUp size={18} />
            Dispense Medicine
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Critical Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Critical Alerts</h2>
            <AlertCircle size={20} className="text-red-500" />
          </div>
          
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No critical alerts</p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <Link
                  key={alert.id}
                  to={`/inventory/${alert.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: alert.color_code }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{alert.name}</p>
                      <p className="text-sm text-gray-500">{alert.category_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={alert.alert_type} />
                    {alert.current_quantity !== undefined && (
                      <p className="text-sm text-gray-500 mt-1">
                        {alert.current_quantity} left
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {alerts.length > 5 && (
            <Link 
              to="/inventory" 
              className="block text-center text-blue-600 hover:text-blue-700 mt-4 text-sm font-medium"
            >
              View all {alerts.length} alerts →
            </Link>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Clock size={20} className="text-gray-400" />
          </div>
          
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        activity.transaction_type === 'OUT' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {activity.transaction_type === 'OUT' ? 'Dispensed' : 'Received'}
                      </span>
                      <span className="font-medium text-gray-900">
                        {activity.quantity} {activity.unit_of_measure}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{activity.item_name}</p>
                    {activity.student_name && (
                      <p className="text-xs text-gray-500">
                        To: {activity.student_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                    <p className="text-xs">{activity.administered_by_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Link 
            to="/transactions" 
            className="block text-center text-blue-600 hover:text-blue-700 mt-4 text-sm font-medium"
          >
            View all transactions →
          </Link>
        </div>
      </div>
    </div>
  );
}