import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeft, Package, AlertCircle, Edit2, Plus, History } from 'lucide-react';
import api from '../utils/api';
import { format } from 'date-fns';

const StatusBadge = ({ status }) => {
  const styles = {
    IN_STOCK: 'bg-green-100 text-green-800',
    LOW_STOCK: 'bg-orange-100 text-orange-800',
    OUT_OF_STOCK: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-red-100 text-red-800 border border-red-200',
    EXPIRING_SOON: 'bg-yellow-100 text-yellow-800'
  };
  const labels = {
    IN_STOCK: 'In Stock', LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock', EXPIRED: 'Expired', EXPIRING_SOON: 'Expiring Soon'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-red-50'}`}>
      {labels[status] || status}
    </span>
  );
};

export default function ItemDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('details');

  const { data, isLoading } = useQuery(['item', id], () =>
    api.get(`/inventory/${id}`).then(res => res.data)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  const item = data?.item;
  const transactions = data?.recentTransactions || [];

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Item not found</p>
        <Link to="/inventory" className="text-yellow-600 hover:underline mt-2 inline-block">Back to inventory</Link>
      </div>
    );
  }

  const tabClass = (tab) =>
    `pb-4 px-2 font-medium transition-colors relative ${
      activeTab === tab ? 'text-yellow-600' : 'text-red-400 hover:text-red-700'
    }`;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/inventory" className="p-2 hover:bg-red-100 rounded-lg transition-colors">
          <ArrowLeft size={24} className="text-red-800" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-red-950">{item.name}</h1>
          <p className="text-red-600">{item.category_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/dispense?item=${item.id}`} className="btn-primary">
            <Plus size={20} />Dispense
          </Link>
          <button className="btn-secondary">
            <Edit2 size={20} />Edit
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg flex items-center gap-3 ${
        item.status === 'EXPIRED' ? 'bg-red-50 border border-red-200' :
        item.status === 'LOW_STOCK' ? 'bg-orange-50 border border-orange-200' :
        item.status === 'EXPIRING_SOON' ? 'bg-yellow-50 border border-yellow-200' :
        'bg-green-50 border border-green-200'
      }`}>
        <AlertCircle className={`${
          item.status === 'EXPIRED' ? 'text-red-600' :
          item.status === 'LOW_STOCK' ? 'text-orange-600' :
          item.status === 'EXPIRING_SOON' ? 'text-yellow-600' : 'text-green-600'
        }`} />
        <div className="flex-1">
          <p className={`font-medium ${
            item.status === 'EXPIRED' ? 'text-red-800' :
            item.status === 'LOW_STOCK' ? 'text-orange-800' :
            item.status === 'EXPIRING_SOON' ? 'text-yellow-800' : 'text-green-800'
          }`}>
            {item.status === 'EXPIRED' ? 'This item has expired and should not be dispensed.' :
             item.status === 'LOW_STOCK' ? `Low stock alert: Only ${item.current_quantity} ${item.unit_of_measure} remaining.` :
             item.status === 'EXPIRING_SOON' ? 'This item is expiring soon. Use before expiration date.' :
             'Stock level is healthy.'}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Tabs */}
      <div className="border-b border-red-200">
        <div className="flex gap-6">
          {['details', 'clinical', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}{tab === 'clinical' ? ' Info' : ''}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-red-950 mb-4">Basic Information</h3>
              <dl className="space-y-4">
                {[['SKU', item.sku], ['Generic Name', item.generic_name], ['Brand Name', item.brand_name], ['Storage', item.storage_conditions]].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-sm text-red-400">{label}</dt>
                    <dd className="font-medium text-red-950">{val || 'N/A'}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-sm text-red-400">Category</dt>
                  <dd>
                    <span className="px-2 py-1 rounded text-sm font-medium" style={{ backgroundColor: item.color_code + '20', color: item.color_code }}>
                      {item.category_name}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-semibold text-red-950 mb-4">Stock Information</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-red-400">Current Stock</dt>
                  <dd className={`text-2xl font-bold ${
                    item.current_quantity === 0 ? 'text-red-600' :
                    item.current_quantity <= item.minimum_threshold ? 'text-orange-600' : 'text-red-950'
                  }`}>
                    {item.current_quantity} {item.unit_of_measure}
                  </dd>
                </div>
                {[['Minimum Threshold', `${item.minimum_threshold} ${item.unit_of_measure}`], ['Reorder Point', `${item.reorder_point} ${item.unit_of_measure}`], ['Batch Number', item.batch_number]].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-sm text-red-400">{label}</dt>
                    <dd className="font-medium text-red-950">{val || 'N/A'}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-sm text-red-400">Expiration Date</dt>
                  <dd className={`font-medium ${
                    item.expiration_date && new Date(item.expiration_date) <= new Date() ? 'text-red-600' :
                    item.expiration_date && new Date(item.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-yellow-600' : 'text-red-950'
                  }`}>
                    {item.expiration_date ? format(new Date(item.expiration_date), 'MMMM d, yyyy') : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>
            {item.description && (
              <div className="col-span-2">
                <h3 className="font-semibold text-red-950 mb-2">Description</h3>
                <p className="text-red-700">{item.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clinical' && (
          <div className="space-y-6">
            {item.dosage_info && (
              <div>
                <h3 className="font-semibold text-red-950 mb-2">Dosage Information</h3>
                <div className="bg-yellow-50 rounded-lg p-4"><p className="text-red-800">{item.dosage_info}</p></div>
              </div>
            )}
            {item.usage_instructions && (
              <div>
                <h3 className="font-semibold text-red-950 mb-2">Usage Instructions</h3>
                <div className="bg-red-50 rounded-lg p-4"><p className="text-red-800 whitespace-pre-wrap">{item.usage_instructions}</p></div>
              </div>
            )}
            {item.indications && (
              <div>
                <h3 className="font-semibold text-red-950 mb-2">Indications / Purpose</h3>
                <div className="bg-green-50 rounded-lg p-4"><p className="text-red-800">{item.indications}</p></div>
              </div>
            )}
            {item.contraindications && (
              <div>
                <h3 className="font-semibold text-red-950 mb-2">Contraindications</h3>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200"><p className="text-red-800">{item.contraindications}</p></div>
              </div>
            )}
            {item.side_effects && (
              <div>
                <h3 className="font-semibold text-red-950 mb-2">Side Effects</h3>
                <div className="bg-yellow-50 rounded-lg p-4"><p className="text-red-800">{item.side_effects}</p></div>
              </div>
            )}
            {!item.dosage_info && !item.usage_instructions && !item.indications && !item.contraindications && !item.side_effects && (
              <p className="text-red-400 text-center py-8">No clinical information available for this item.</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="font-semibold text-red-950 mb-4">Recent Transactions</h3>
            {transactions.length === 0 ? (
              <p className="text-red-400 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        t.transaction_type === 'OUT' ? 'bg-red-100' :
                        t.transaction_type === 'IN' ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        <History size={18} className={
                          t.transaction_type === 'OUT' ? 'text-red-600' :
                          t.transaction_type === 'IN' ? 'text-green-600' : 'text-yellow-600'
                        } />
                      </div>
                      <div>
                        <p className="font-medium text-red-950">
                          {t.transaction_type === 'OUT' ? 'Dispensed' : t.transaction_type === 'IN' ? 'Received' : 'Adjusted'} {t.quantity} {item.unit_of_measure}
                        </p>
                        <p className="text-sm text-red-500">{t.reason} • {format(new Date(t.created_at), 'MMM d, yyyy h:mm a')}</p>
                        {t.student_name && <p className="text-xs text-red-400">To: {t.student_name} ({t.student_id})</p>}
                      </div>
                    </div>
                    <div className="text-right text-sm text-red-500">
                      <p>Stock: {t.previous_quantity} → {t.new_quantity}</p>
                      <p className="text-xs">{t.administered_by_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/transactions" className="block text-center text-yellow-600 hover:text-yellow-700 mt-4 text-sm font-medium">
              View all transactions →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}