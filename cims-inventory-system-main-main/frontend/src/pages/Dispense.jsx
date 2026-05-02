import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  User, 
  Package, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Calendar,
  ArrowRight
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Dispense() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const preselectedItem = searchParams.get('item');

  const [step, setStep] = useState(preselectedItem ? 2 : 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [dispenseData, setDispenseData] = useState({
    itemId: '',
    quantity: 1,
    studentId: '',
    studentName: '',
    studentGrade: '',
    reason: '',
    notes: ''
  });

  // Search items
  const { data: searchResults, isLoading: searching } = useQuery(
    ['itemSearch', searchQuery],
    () => api.get(`/inventory/search/quick?q=${searchQuery}`).then(res => res.data),
    { enabled: searchQuery.length >= 2 }
  );

  // Get item details if preselected
  useEffect(() => {
    if (preselectedItem) {
      api.get(`/inventory/${preselectedItem}`).then(res => {
        setSelectedItem(res.data.item);
        setDispenseData(prev => ({ ...prev, itemId: preselectedItem }));
      });
    }
  }, [preselectedItem]);

  // Dispense mutation
  const dispenseMutation = useMutation(
    (data) => api.post('/transactions/dispense', data),
    {
      onSuccess: (response) => {
        toast.success(response.data.message);
        queryClient.invalidateQueries('dashboard');
        queryClient.invalidateQueries('inventory');
        
        // Reset form
        setDispenseData({
          itemId: '',
          quantity: 1,
          studentId: '',
          studentName: '',
          studentGrade: '',
          reason: '',
          notes: ''
        });
        setSelectedItem(null);
        setStep(1);
        setSearchQuery('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to dispense');
      }
    }
  );

  const handleSelectItem = (item) => {
    // Check if expired
    if (item.status === 'EXPIRED') {
      toast.error('Cannot dispense expired medicine');
      return;
    }
    
    // Check if out of stock
    if (item.current_quantity === 0) {
      toast.error('Item is out of stock');
      return;
    }
    
    setSelectedItem(item);
    setDispenseData(prev => ({ ...prev, itemId: item.id }));
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!dispenseData.itemId || !dispenseData.studentId || !dispenseData.studentName || !dispenseData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    dispenseMutation.mutate(dispenseData);
  };

  const reasons = [
    'Headache',
    'Fever',
    'Stomachache',
    'Wound/Cut',
    'Allergy',
    'Cold/Flu',
    'Toothache',
    'Dizziness',
    'Other'
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dispense Medicine</h1>
        <p className="text-gray-600 mt-1">Record medicine given to students</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
            step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}>
            1
          </div>
          <span className="font-medium">Select Item</span>
        </div>
        <ArrowRight size={20} className="text-gray-300" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
            step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}>
            2
          </div>
          <span className="font-medium">Student Details</span>
        </div>
      </div>

      {step === 1 ? (
        /* Step 1: Select Item */
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Search Medicine or Supply</h2>
          
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type at least 2 characters to search..."
              className="input-field pl-12 py-4 text-lg"
              autoFocus
            />
          </div>

          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}

          {searchResults?.items?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">
                Found {searchResults.items.length} items
              </p>
              {searchResults.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: item.color_code + '20' }}
                    >
                      <Package size={24} style={{ color: item.color_code }} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.category_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      item.current_quantity <= 10 ? 'text-orange-600' : 'text-gray-900'
                    }`}>
                      {item.current_quantity} {item.unit_of_measure}
                    </p>
                    {item.expiration_date && (
                      <p className={`text-sm ${
                        new Date(item.expiration_date) <= new Date() ? 'text-red-600' :
                        new Date(item.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        Exp: {format(new Date(item.expiration_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults?.items?.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No items found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      ) : (
        /* Step 2: Student Details */
        <div className="card">
          {/* Selected Item Summary */}
          {selectedItem && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: selectedItem.color_code + '40' }}
                  >
                    <Package size={20} style={{ color: selectedItem.color_code }} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedItem.name}</p>
                    <p className="text-sm text-gray-600">
                      Available: {selectedItem.current_quantity} {selectedItem.unit_of_measure}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Change
                </button>
              </div>
              
              {selectedItem.expiration_date && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-600">
                    Expires: {format(new Date(selectedItem.expiration_date), 'MMMM d, yyyy')}
                  </span>
                  {new Date(selectedItem.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                    <span className="text-yellow-600 font-medium flex items-center gap-1">
                      <AlertCircle size={14} />
                      Expiring soon!
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem?.current_quantity || 1}
                  value={dispenseData.quantity}
                  onChange={(e) => setDispenseData({ ...dispenseData, quantity: parseInt(e.target.value) })}
                  className="input-field"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max available: {selectedItem?.current_quantity}
                </p>
              </div>

              {/* Student ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student ID *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={dispenseData.studentId}
                    onChange={(e) => setDispenseData({ ...dispenseData, studentId: e.target.value })}
                    placeholder="e.g., 2023-12345"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>

              {/* Student Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  value={dispenseData.studentName}
                  onChange={(e) => setDispenseData({ ...dispenseData, studentName: e.target.value })}
                  placeholder="Full name"
                  className="input-field"
                  required
                />
              </div>

              {/* Grade/Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade/Year
                </label>
                <select
                  value={dispenseData.studentGrade}
                  onChange={(e) => setDispenseData({ ...dispenseData, studentGrade: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Grade</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Dispense *
              </label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {reasons.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setDispenseData({ ...dispenseData, reason })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      dispenseData.reason === reason
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={dispenseData.notes}
                onChange={(e) => setDispenseData({ ...dispenseData, notes: e.target.value })}
                placeholder="Any additional information..."
                rows={3}
                className="input-field"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={dispenseMutation.isLoading}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {dispenseMutation.isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Confirm Dispense
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}