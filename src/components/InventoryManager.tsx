import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  ExternalLink, 
  Minus, 
  ShoppingBag,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Layers,
  ChevronDown,
  X,
  Check,
  Tag
} from 'lucide-react';
import { InventoryItem, Vendor } from '../types';
import { adjustInventoryStock, deleteInventoryItem, toggleArchiveInventoryItem } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  vendors: Vendor[];
  onOpenNewItem: (initialData?: Partial<InventoryItem>) => void;
  onOpenNewBundle: (initialData?: Partial<InventoryItem>) => void;
  onOpenQuickSale: (item: InventoryItem) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventory,
  vendors,
  onOpenNewItem,
  onOpenNewBundle,
  onOpenQuickSale,
}) => {
  const { canEditInventory, canDeleteRecords, canViewFinancials } = useAuth();
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter dropdown state
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Floating add button menu state
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Per-item actions dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsFabOpen(false);
      }
      if (activeMenuId && !(e.target as HTMLElement).closest('[data-item-menu]')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [inventory]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.bundleItems && item.bundleItems.some((bi) => bi.itemTitle.toLowerCase().includes(q)));

      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = item.status === 'active' && item.stock > 0;
      } else if (statusFilter === 'low_stock') {
        matchesStatus = item.stock <= (item.lowStockThreshold ?? 2) && item.stock > 0 && item.status !== 'archived';
      } else if (statusFilter === 'out_of_stock') {
        matchesStatus = (item.stock === 0 || item.status === 'out_of_stock') && item.status !== 'archived';
      } else if (statusFilter === 'bundles') {
        matchesStatus = Boolean(item.isBundle) && item.status !== 'archived';
      } else if (statusFilter === 'archived') {
        matchesStatus = item.status === 'archived';
      } else if (statusFilter === 'all') {
        // By default 'all' shows active/out-of-stock/draft but hides archived unless explicitly requested
        matchesStatus = item.status !== 'archived';
      }

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [inventory, searchQuery, statusFilter, categoryFilter]);

  const handleStockDelta = async (item: InventoryItem, delta: number) => {
    if (!canEditInventory) return;
    try {
      await adjustInventoryStock(item.id, item.stock, delta);
    } catch (err) {
      console.error('Error adjusting stock', err);
    }
  };

  const handleToggleArchive = async (item: InventoryItem) => {
    if (!canEditInventory) return;
    try {
      await toggleArchiveInventoryItem(item);
      setActiveMenuId(null);
    } catch (err) {
      console.error('Error toggling archive', err);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!canDeleteRecords) return;
    setActiveMenuId(null);
    if (window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
      try {
        await deleteInventoryItem(item.id);
      } catch (err) {
        console.error('Error deleting item', err);
      }
    }
  };

  // Label for the active filter
  const getFilterButtonLabel = () => {
    if (statusFilter === 'low_stock') return 'Low Stock';
    if (statusFilter === 'out_of_stock') return 'Out of Stock';
    if (statusFilter === 'active') return 'Active In-Stock';
    if (statusFilter === 'bundles') return 'Bundles Only';
    if (statusFilter === 'archived') return 'Archived';
    if (categoryFilter !== 'all') return categoryFilter;
    return 'All Filters';
  };

  const isFilterActive = statusFilter !== 'all' || categoryFilter !== 'all';

  return (
    <div className="space-y-3 pb-28">
      
      {/* Top Header: Title "Inventory" + Count + [Search Icon] + [Filters Dropdown] in one line */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <span>Inventory</span>
            <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full shrink-0">
              {filteredItems.length}
            </span>
          </h1>
        </div>

        {/* Action Controls in One Line */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search: Icon-only toggling inline input */}
          {isSearchOpen ? (
            <div className="flex items-center gap-1.5 bg-white border border-blue-500 rounded-xl px-2.5 py-1.5 shadow-sm text-xs animate-in fade-in duration-150">
              <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory..."
                className="w-28 sm:w-44 bg-transparent text-slate-800 text-xs focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer ml-0.5 border-l border-slate-200 pl-1"
                title="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className={`p-2 rounded-xl border transition-colors cursor-pointer shadow-xs flex items-center justify-center ${
                searchQuery
                  ? 'bg-blue-50 border-blue-400 text-blue-600'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title={searchQuery ? `Searching: "${searchQuery}"` : "Search inventory"}
              aria-label="Search inventory"
            >
              <Search className="w-4 h-4" />
              {searchQuery && (
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-1" />
              )}
            </button>
          )}

          {/* Filters Dropdown in One Line */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                isFilterActive
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="Filter inventory"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="max-w-[110px] truncate">{getFilterButtonLabel()}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Status & Availability
                </div>

                {[
                  { id: 'all', label: `All Active (${inventory.filter(i => i.status !== 'archived').length})` },
                  { id: 'active', label: 'Active In-Stock' },
                  { id: 'low_stock', label: `⚠️ Low Stock (${inventory.filter(i => i.stock <= (i.lowStockThreshold ?? 2) && i.stock > 0 && i.status !== 'archived').length})` },
                  { id: 'out_of_stock', label: `Out of Stock (${inventory.filter(i => (i.stock === 0 || i.status === 'out_of_stock') && i.status !== 'archived').length})` },
                  { id: 'bundles', label: `🎁 Bundles Only (${inventory.filter(i => i.isBundle && i.status !== 'archived').length})` },
                  { id: 'archived', label: `📦 Archived (${inventory.filter(i => i.status === 'archived').length})` },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStatusFilter(s.id);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                      statusFilter === s.id ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <span>{s.label}</span>
                    {statusFilter === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}

                {categories.length > 0 && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Categories
                    </div>
                    <button
                      onClick={() => {
                        setCategoryFilter('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                        categoryFilter === 'all' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>All Categories</span>
                      {categoryFilter === 'all' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCategoryFilter(c);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                          categoryFilter === c ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{c}</span>
                        {categoryFilter === c && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    ))}
                  </>
                )}

                {isFilterActive && (
                  <div className="mt-1 pt-1 border-t border-slate-100 px-3">
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setCategoryFilter('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full py-1 text-center text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Pill Bar (if any non-default filter is applied) */}
      {isFilterActive && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-semibold text-slate-400">Filtering:</span>
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[11px]">
              {getFilterButtonLabel()}
              <button onClick={() => setStatusFilter('all')} className="hover:text-blue-900 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {categoryFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
              {categoryFilter}
              <button onClick={() => setCategoryFilter('all')} className="hover:text-slate-900 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Compact Products & Bundles List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center text-slate-500 shadow-xs">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No items found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchQuery || isFilterActive
              ? 'Try clearing your search or adjusting the filters in the dropdown.'
              : 'Add your first product or bundle using the + button at the bottom.'}
          </p>
          {isFilterActive && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const isLow = item.stock <= (item.lowStockThreshold ?? 2) && item.stock > 0 && item.status !== 'archived';
            const isOut = (item.stock === 0 || item.status === 'out_of_stock') && item.status !== 'archived';
            const isArchived = item.status === 'archived';
            const isMenuOpen = activeMenuId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border transition-all p-3 shadow-xs hover:border-slate-300 ${
                  isArchived ? 'opacity-70 bg-slate-50/70 border-slate-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  
                  {/* Left: Product / Bundle Name + badges */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.isBundle ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-200">
                          <Layers className="w-2.5 h-2.5" />
                          BUNDLE
                        </span>
                      ) : null}

                      {isArchived ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                          ARCHIVED
                        </span>
                      ) : null}

                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {item.title}
                      </h3>
                    </div>

                    {/* Quick subtitle / bundle items summary if bundle */}
                    {item.isBundle && item.bundleItems && item.bundleItems.length > 0 ? (
                      <p className="text-[11px] text-indigo-900/70 truncate mt-0.5">
                        Contains: {item.bundleItems.map((b) => `${b.quantity}x ${b.itemTitle}`).join(', ')}
                      </p>
                    ) : item.sku ? (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        SKU: {item.sku} {item.category ? `• ${item.category}` : ''}
                      </p>
                    ) : null}
                  </div>

                  {/* Middle: 3 Key Metrics at a glance: Cost, Selling Price, Stock */}
                  <div className="flex items-center gap-3 sm:gap-6 shrink-0 text-right sm:text-center">
                    {/* Cost Price */}
                    {canViewFinancials && (
                      <div className="hidden xs:block text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                          Cost
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          ${item.costPrice.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Selling Price */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                        Price
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        ${item.sellingPrice.toFixed(2)}
                      </span>
                    </div>

                    {/* Stock Count */}
                    <div className="flex items-center gap-1.5">
                      <div className="text-center min-w-[50px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                          Stock
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-black px-1.5 py-0.5 rounded-md inline-block leading-none ${
                            isOut
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {item.stock}
                        </span>
                      </div>

                      {/* Stock Quick +/- adjustments */}
                      {canEditInventory && !isArchived && (
                        <div className="hidden sm:flex flex-col gap-0.5">
                          <button
                            onClick={() => handleStockDelta(item, 1)}
                            className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Increase stock"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => handleStockDelta(item, -1)}
                            disabled={item.stock === 0}
                            className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 cursor-pointer"
                            title="Decrease stock"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions Dropdown Menu */}
                  <div className="relative shrink-0" data-item-menu>
                    <button
                      onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Item actions"
                      aria-label="Item actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                        {/* Quick Sold button */}
                        {canEditInventory && !isArchived && item.stock > 0 && (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onOpenQuickSale(item);
                            }}
                            className="w-full text-left px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-2 cursor-pointer"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Record Sale</span>
                          </button>
                        )}

                        {/* Edit Item / Bundle */}
                        {canEditInventory && (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              if (item.isBundle) {
                                onOpenNewBundle(item);
                              } else {
                                onOpenNewItem(item);
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.isBundle ? 'Edit Bundle' : 'Edit Product'}</span>
                          </button>
                        )}

                        {/* Archive / Unarchive */}
                        {canEditInventory && (
                          <button
                            onClick={() => handleToggleArchive(item)}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            {isArchived ? (
                              <>
                                <ArchiveRestore className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-blue-700 font-semibold">Unarchive</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5 text-slate-400" />
                                <span>Archive</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* External link if present */}
                        {item.listingUrl && (
                          <a
                            href={item.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setActiveMenuId(null)}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>View on Facebook</span>
                          </a>
                        )}

                        {/* Delete */}
                        {canDeleteRecords && (
                          <>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              onClick={() => handleDelete(item)}
                              className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Extra info row if screen is tiny */}
                <div className="xs:hidden flex items-center justify-between text-[11px] text-slate-500 pt-1.5 mt-1.5 border-t border-slate-100">
                  {canViewFinancials && (
                    <span>Cost: <strong>${item.costPrice.toFixed(2)}</strong></span>
                  )}
                  {canEditInventory && !isArchived && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Adjust stock:</span>
                      <button
                        onClick={() => handleStockDelta(item, -1)}
                        disabled={item.stock === 0}
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 disabled:opacity-30"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleStockDelta(item, 1)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Add Action Button with Dual Option Popover (Add Product vs Add Bundle) */}
      {canEditInventory && (
        <div className="fixed bottom-20 md:bottom-8 right-5 md:right-8 z-40" ref={fabRef}>
          {/* Options Popover Menu */}
          {isFabOpen && (
            <div className="absolute bottom-16 right-0 mb-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-150">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Create Inventory Item
              </div>

              {/* Add Product */}
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  onOpenNewItem();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 text-left transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    Add Product
                  </div>
                  <div className="text-[10px] text-slate-400">Single marketplace item</div>
                </div>
              </button>

              {/* Add Bundle */}
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  onOpenNewBundle();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 text-left transition-colors cursor-pointer group mt-0.5"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                    Add Bundle
                  </div>
                  <div className="text-[10px] text-slate-400">Combo pack of items</div>
                </div>
              </button>
            </div>
          )}

          {/* Floating trigger button */}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-90 group focus:outline-hidden ${
              isFabOpen
                ? 'bg-slate-900 text-white rotate-45 shadow-slate-900/40'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/40 focus:ring-4 focus:ring-blue-500/30'
            }`}
            title="Add Item or Bundle"
            aria-label="Add Item or Bundle"
          >
            <Plus className={`w-7 h-7 stroke-[2.5] transition-transform duration-200 ${isFabOpen ? 'rotate-45' : 'group-hover:rotate-90'}`} />
            <span className="sr-only">Add Item or Bundle</span>
          </button>
        </div>
      )}
    </div>
  );
};
