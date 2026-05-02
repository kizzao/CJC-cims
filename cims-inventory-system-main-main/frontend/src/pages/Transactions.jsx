import { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  History, 
  Filter, 
  Download,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import api from '../utils/api';
import { format } from 'date-fns';

const TransactionTypeBadge = ({ type }) => {
  const styles = {
    IN: 'bg-green-100 text-green-800',
    OUT: 'bg-red-100 text-red-800',
    ADJUSTMENT: 'bg-blue-100 text-blue-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    DAMAGED: 'bg-orange-100 text-orange-800'
  };

  const labels = {
    IN: 'Received',
    OUT: 'Dispensed',
    ADJUSTMENT: 'Adjusted',
    EXPIRED: 'Expired',
    DAMAGED: 'Damaged'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || 'bg-gray-100'}`}>
      {labels[type] || type}
    </span>
  );
};

export default function Transactions() {
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    page: 1
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery(
    ['transactions', filters],
    () => {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', filters.page);
      params.append('limit', '20');
      
      return api.get(`/transactions?${params}`).then(res => res.data);
    },
    { keepPreviousData: true }
  );

const handleExport = async () => {
  setIsExporting(true);
  try {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`/transactions/export?${params}`, {
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute('download', `transactions_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export transactions. Please try again.');
  } finally {
    setIsExporting(false);
  }
};

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-gray-600 mt-1">View all inventory movements and dispenses</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={isExporting || transactions.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download size={18} />
              Export
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
              className="input-field"
            >
              <option value="">All Types</option>
              <option value="OUT">Dispensed</option>
              <option value="IN">Received</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
              className="input-field"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
              className="input-field"
            />
          </div>

          {(filters.type || filters.startDate || filters.endDate) && (
            <button
              onClick={() => setFilters({ type: '', startDate: '', endDate: '', page: 1 })}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <History size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No transactions found</p>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(t.created_at), 'MMM d, yyyy')}
                      <br />
                      <span className="text-xs text-gray-400">
                        {format(new Date(t.created_at), 'h:mm a')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <TransactionTypeBadge type={t.transaction_type} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{t.item_name}</p>
                      <p className="text-xs text-gray-500">{t.unit_of_measure}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${
                        t.transaction_type === 'OUT' ? 'text-red-600' :
                        t.transaction_type === 'IN' ? 'text-green-600' :
                        'text-blue-600'
                      }`}>
                        {t.transaction_type === 'OUT' ? '-' : '+'}{t.quantity}
                      </span>
                      <br />
                      <span className="text-xs text-gray-400">
                        {t.previous_quantity} → {t.new_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {t.student_name ? (
                        <div>
                          <p className="font-medium text-gray-900">{t.student_name}</p>
                          <p className="text-xs text-gray-500">{t.student_id}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {t.reason}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {t.administered_by_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                disabled={filters.page === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}