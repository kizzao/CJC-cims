import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { X, Package, Loader2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function AddItemModal({ onClose, categories }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    genericName: '',
    brandName: '',
    categoryId: '',
    description: '',
    unitOfMeasure: 'pieces',
    currentQuantity: 0,
    minimumThreshold: 10,
    reorderPoint: 20,
    expirationDate: '',
    batchNumber: '',
    dosageInfo: '',
    storageConditions: 'Room temperature',
    location: '',
  });

  const mutation = useMutation(
    (data) => api.post('/inventory', data).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('inventory');
        toast.success('Item added successfully!');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add item');
      }
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.categoryId) {
      toast.error('Name and category are required');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Add New Item</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Paracetamol 500mg"
                  className="input-field"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    name="genericName"
                    value={form.genericName}
                    onChange={handleChange}
                    placeholder="e.g. Acetaminophen"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                  <input
                    type="text"
                    name="brandName"
                    value={form.brandName}
                    onChange={handleChange}
                    placeholder="e.g. Biogesic"
                    className="input-field"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    className="input-field"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                  <select
                    name="unitOfMeasure"
                    value={form.unitOfMeasure}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="pieces">Pieces</option>
                    <option value="tablets">Tablets</option>
                    <option value="capsules">Capsules</option>
                    <option value="bottles">Bottles</option>
                    <option value="boxes">Boxes</option>
                    <option value="sachets">Sachets</option>
                    <option value="ml">mL</option>
                    <option value="liters">Liters</option>
                    <option value="grams">Grams</option>
                    <option value="packs">Packs</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Brief description of the item..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
            </div>
          </div>

          {/* Stock Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Stock Information</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Quantity</label>
                <input
                  type="number"
                  name="currentQuantity"
                  value={form.currentQuantity}
                  onChange={handleChange}
                  min="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Threshold</label>
                <input
                  type="number"
                  name="minimumThreshold"
                  value={form.minimumThreshold}
                  onChange={handleChange}
                  min="0"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                <input
                  type="number"
                  name="reorderPoint"
                  value={form.reorderPoint}
                  onChange={handleChange}
                  min="0"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Expiration & Storage */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Expiration & Storage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  name="expirationDate"
                  value={form.expirationDate}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                <input
                  type="text"
                  name="batchNumber"
                  value={form.batchNumber}
                  onChange={handleChange}
                  placeholder="e.g. BT-2024-001"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Conditions</label>
                <select
                  name="storageConditions"
                  value={form.storageConditions}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="Room temperature">Room Temperature</option>
                  <option value="Refrigerated">Refrigerated (2-8°C)</option>
                  <option value="Frozen">Frozen</option>
                  <option value="Cool and dry">Cool and Dry</option>
                  <option value="Away from light">Away from Light</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Cabinet A, Shelf 2"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Clinical Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Clinical Information (Optional)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Info</label>
              <input
                type="text"
                name="dosageInfo"
                value={form.dosageInfo}
                onChange={handleChange}
                placeholder="e.g. 500mg every 6 hours"
                className="input-field"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="btn-primary disabled:opacity-50"
            >
              {mutation.isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Package size={18} />
                  Add Item
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}