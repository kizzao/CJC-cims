import { useState, useEffect } from 'react';
import { X, Loader2, Package } from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function EditItemModal({ item, onClose, categories }) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    // Basic Information
    name: '',
    generic_name: '',
    brand_name: '',
    category_id: '',
    unit_of_measure: 'Pieces',
    description: '',
    
    // Stock Information
    current_quantity: 0,
    minimum_threshold: 10,
    reorder_point: 20,
    
    // Expiration & Storage
    expiration_date: '',
    batch_number: '',
    storage_conditions: 'Room Temperature',
    location: '',
    
    // Clinical Information
    dosage_info: ''
  });

  // Populate form with item data when modal opens
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        generic_name: item.generic_name || '',
        brand_name: item.brand_name || '',
        category_id: item.category_id || '',
        unit_of_measure: item.unit_of_measure || 'Pieces',
        description: item.description || '',
        current_quantity: item.current_quantity || 0,
        minimum_threshold: item.minimum_threshold || 10,
        reorder_point: item.reorder_point || 20,
        expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
        batch_number: item.batch_number || '',
        storage_conditions: item.storage_conditions || 'Room Temperature',
        location: item.location || '',
        dosage_info: item.dosage_info || ''
      });
    }
  }, [item]);

  const updateMutation = useMutation(
    (data) => api.put(`/inventory/${item.id}`, data),
    {
      onSuccess: () => {
        toast.success('Item updated successfully');
        queryClient.invalidateQueries(['inventory']);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update item');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const unitOptions = ['Pieces', 'Tablets', 'Capsules', 'Bottles', 'Boxes', 'Vials', 'Ampules', 'Sachets', 'Tubes', 'Packs'];
  const storageOptions = ['Room Temperature', 'Refrigerated (2-8°C)', 'Frozen (-20°C)', 'Cool Dry Place', 'Protected from Light'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="text-blue-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Edit Item</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="input-field"
                  placeholder="e.g. Paracetamol 500mg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    name="generic_name"
                    value={formData.generic_name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g. Acetaminophen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    name="brand_name"
                    value={formData.brand_name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g. Biogesic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    required
                    className="input-field"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit of Measure *
                  </label>
                  <select
                    name="unit_of_measure"
                    value={formData.unit_of_measure}
                    onChange={handleChange}
                    required
                    className="input-field"
                  >
                    {unitOptions.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="input-field"
                  placeholder="Brief description of the item..."
                />
              </div>
            </div>
          </div>

          {/* Stock Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Stock Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Quantity
                </label>
                <input
                  type="number"
                  name="current_quantity"
                  value={formData.current_quantity}
                  onChange={handleChange}
                  min="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Threshold *
                </label>
                <input
                  type="number"
                  name="minimum_threshold"
                  value={formData.minimum_threshold}
                  onChange={handleChange}
                  required
                  min="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reorder Point
                </label>
                <input
                  type="number"
                  name="reorder_point"
                  value={formData.reorder_point}
                  onChange={handleChange}
                  min="0"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Expiration & Storage */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Expiration & Storage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date
                </label>
                <input
                  type="date"
                  name="expiration_date"
                  value={formData.expiration_date}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Number
                </label>
                <input
                  type="text"
                  name="batch_number"
                  value={formData.batch_number}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g. BT-2024-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Storage Conditions
                </label>
                <select
                  name="storage_conditions"
                  value={formData.storage_conditions}
                  onChange={handleChange}
                  className="input-field"
                >
                  {storageOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g. Cabinet A, Shelf 2"
                />
              </div>
            </div>
          </div>

          {/* Clinical Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Clinical Information (Optional)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dosage Info
              </label>
              <input
                type="text"
                name="dosage_info"
                value={formData.dosage_info}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g. 500mg every 6 hours"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isLoading}
              className="btn-primary flex items-center gap-2"
            >
              {updateMutation.isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Package size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}