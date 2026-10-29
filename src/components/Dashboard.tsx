import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  Truck, 
  Percent, 
  ArrowUpRight, 
  Calendar,
  ChevronRight,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { InventoryItem, Order, MonthlyRevenueData } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  inventory: InventoryItem[];
  orders: Order[];
  onNavigateTab: (tab: string) => void;
  onOpenNewSale: () => void;
  onOpenNewItem: () => void;
  onSelectInventoryItem?: (item: InventoryItem) => void;
}

export type GrowthPeriodFilter = 'all' | 'today' | 'this_month' | 'last_month' | 'custom';

export const Dashboard: React.FC<DashboardProps> = ({
  inventory,
  orders,
  onNavigateTab,
  onOpenNewSale,
  onOpenNewItem,
}) => {
  const { canViewFinancials, canEditInventory } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<GrowthPeriodFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Period filtering logic
  const filteredOrders = useMemo(() => {
    if (periodFilter === 'all') return orders;

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const thisMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const prevMonthDate = new Date();
    prevMonthDate.setDate(1);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const lastMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    return orders.filter((o) => {
      const oDate = o.date || (o.createdAt ? o.createdAt.substring(0, 10) : '');
      if (!oDate) return false;
      if (periodFilter === 'today') return oDate === todayStr;
      if (periodFilter === 'this_month') return oDate.startsWith(thisMonthStr);
      if (periodFilter === 'last_month') return oDate.startsWith(lastMonthStr);
      if (periodFilter === 'custom') {
        if (customStart && oDate < customStart) return false;
        if (customEnd && oDate > customEnd) return false;
        return true;
      }
      return true;
    });
  }, [orders, periodFilter, customStart, customEnd]);

  // 1. High-level KPIs based on filtered period
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalRevenue || 0), 0);
  }, [filteredOrders]);

  const totalCost = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
  }, [filteredOrders]);

  const totalProfit = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0);
  }, [filteredOrders]);

  const overallMargin = useMemo(() => {
    return totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(1)) : 0;
  }, [totalRevenue, totalProfit]);

  const totalShippingCharged = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.shippingCharged || 0), 0);
  }, [filteredOrders]);

  const totalShippingCost = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
  }, [filteredOrders]);

  const netShippingMargin = useMemo(() => {
    return Number((totalShippingCharged - totalShippingCost).toFixed(2));
  }, [totalShippingCharged, totalShippingCost]);

  const inventoryStockTotal = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.stock || 0), 0);
  }, [inventory]);

  const inventoryValueAtCost = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.costPrice * item.stock), 0);
  }, [inventory]);

  const potentialRetailValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.sellingPrice * item.stock), 0);
  }, [inventory]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    return inventory.filter(
      (item) => item.status !== 'draft' && item.stock <= (item.lowStockThreshold ?? 2)
    );
  }, [inventory]);

  // 2. Monthly Revenue Growth Aggregation
  const monthlyData: MonthlyRevenueData[] = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number; profit: number; count: number }>();

    orders.forEach((ord) => {
      if (!ord.date) return;
      const monthKey = ord.date.substring(0, 7); // "YYYY-MM"
      const prev = map.get(monthKey) || { revenue: 0, cost: 0, profit: 0, count: 0 };
      map.set(monthKey, {
        revenue: prev.revenue + (ord.totalRevenue || 0),
        cost: prev.cost + (ord.totalCost || 0),
        profit: prev.profit + (ord.netProfit || 0),
        count: prev.count + 1,
      });
    });

    const sortedMonths = Array.from(map.keys()).sort();
    return sortedMonths.map((m) => {
      const d = map.get(m)!;
      const margin = d.revenue > 0 ? Number(((d.profit / d.revenue) * 100).toFixed(1)) : 0;
      return {
        month: m,
        revenue: Number(d.revenue.toFixed(2)),
        cost: Number(d.cost.toFixed(2)),
        profit: Number(d.profit.toFixed(2)),
        ordersCount: d.count,
        marginPercent: margin,
      };
    });
  }, [orders]);

  // Month-over-Month calculation for latest month
  const momGrowthRate = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const current = monthlyData[monthlyData.length - 1].revenue;
    const prev = monthlyData[monthlyData.length - 2].revenue;
    if (prev === 0) return 100;
    const change = ((current - prev) / prev) * 100;
    return Number(change.toFixed(1));
  }, [monthlyData]);

  const maxMonthlyRevenue = useMemo(() => {
    if (monthlyData.length === 0) return 1000;
    return Math.max(...monthlyData.map((d) => d.revenue), 1000);
  }, [monthlyData]);

  // 3. Top selling categories (based on filtered orders)
  const categorySales = useMemo(() => {
    const catMap = new Map<string, { count: number; revenue: number; profit: number }>();
    filteredOrders.forEach((ord) => {
      // Find item category if linked, else default
      const matched = inventory.find((i) => i.id === ord.itemId);
      const cat = matched?.category || 'General';
      const prev = catMap.get(cat) || { count: 0, revenue: 0, profit: 0 };
      catMap.set(cat, {
        count: prev.count + ord.quantity,
        revenue: prev.revenue + ord.totalRevenue,
        profit: prev.profit + ord.netProfit,
      });
    });
    return Array.from(catMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, inventory]);

  // 4. Local pickup vs shipping distribution (based on filtered orders)
  const fulfillmentDistribution = useMemo(() => {
    let localCount = 0;
    let localRev = 0;
    let shippedCount = 0;
    let shippedRev = 0;

    filteredOrders.forEach((o) => {
      if (o.fulfillmentType === 'shipping') {
        shippedCount += o.quantity;
        shippedRev += o.totalRevenue;
      } else {
        localCount += o.quantity;
        localRev += o.totalRevenue;
      }
    });
    return { localCount, localRev, shippedCount, shippedRev };
  }, [filteredOrders]);

  const formatMonthLabel = (mStr: string) => {
    try {
      const [year, month] = mStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    } catch {
      return mStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg shadow-blue-900/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/20 uppercase tracking-wide">
              Facebook Marketplace Hub
            </span>
            <span className="text-xs text-blue-100">Live Real-Time Sync</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Sales & Growth Analytics
          </h1>
          <p className="text-sm text-blue-100/90 mt-1 max-w-xl">
            Complete performance breakdown, monthly revenue growth, category distribution, and margin insights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canEditInventory && (
            <button
              onClick={onOpenNewSale}
              className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>New Order</span>
            </button>
          )}
          {canEditInventory && (
            <button
              onClick={onOpenNewItem}
              className="px-3.5 py-2.5 bg-blue-600/60 hover:bg-blue-600 border border-white/20 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>+ Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Filtering Bar for Growth Tab */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs sm:text-sm font-bold text-slate-900">Filter Analysis Period:</span>
            {periodFilter !== 'all' && (
              <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} in range
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            {(['all', 'today', 'this_month', 'last_month', 'custom'] as GrowthPeriodFilter[]).map((p) => {
              const labels: Record<GrowthPeriodFilter, string> = {
                all: 'All Time',
                today: 'Today',
                this_month: 'This Month',
                last_month: 'Last Month',
                custom: 'Custom'
              };
              const active = periodFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {periodFilter === 'custom' && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-slate-600">Select Range:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              {(customStart || customEnd) && (
                <button
                  onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className="text-slate-500 hover:text-slate-700 underline text-xs cursor-pointer ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stock Alert Warning Banner (If Any Critical Items) */}
      {lowStockItems.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-900">
                Stock Alert: {lowStockItems.length} popular item{lowStockItems.length > 1 ? 's are' : ' is'} at or below threshold!
              </h2>
              <p className="text-xs text-rose-700 mt-0.5">
                {lowStockItems.slice(0, 3).map((i) => `${i.title} (${i.stock} left)`).join(' • ')}
                {lowStockItems.length > 3 && ` and ${lowStockItems.length - 3} more`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('inventory')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Review & Restock</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Gross Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs">
            {momGrowthRate !== null ? (
              <span className={`flex items-center font-semibold ${momGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {momGrowthRate >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {momGrowthRate >= 0 ? `+${momGrowthRate}%` : `${momGrowthRate}%`}
                <span className="text-slate-400 font-normal ml-1">vs prev month</span>
              </span>
            ) : (
              <span className="text-slate-400 font-normal">{orders.length} total sales recorded</span>
            )}
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {canViewFinancials
                ? `$${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-600">
            {canViewFinancials ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                <Percent className="w-3 h-3" />
                {overallMargin}% avg profit margin
              </span>
            ) : (
              <span className="text-slate-400 italic">Financials hidden for staff role</span>
            )}
          </div>
        </div>

        {/* Active Inventory Value */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Inventory</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {inventoryStockTotal} <span className="text-xs font-normal text-slate-500">units</span>
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{inventory.length} listings</span>
            <span className="font-semibold text-slate-700">${potentialRetailValue.toFixed(0)} retail val</span>
          </div>
        </div>

        {/* Shipping Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shipping Profit</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl sm:text-2xl font-black ${netShippingMargin >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {netShippingMargin >= 0 ? `+$${netShippingMargin.toFixed(2)}` : `-$${Math.abs(netShippingMargin).toFixed(2)}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Collected: ${totalShippingCharged.toFixed(0)}</span>
            <span>Labels: ${totalShippingCost.toFixed(0)}</span>
          </div>
        </div>

      </div>

      {/* Monthly Revenue Growth Chart Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Monthly Revenue Growth & Margin Trend
              </h2>
              <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual breakdown of monthly gross sales, fulfillment costs, and net margin performance.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
              <span className="text-slate-600">Gross Sales</span>
            </div>
            {canViewFinancials && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                <span className="text-slate-600">Net Profit</span>
              </div>
            )}
            {canViewFinancials && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-300 inline-block"></span>
                <span className="text-slate-600">COGS & Fees</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Chart Bars */}
        {monthlyData.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">No sales recorded yet</p>
            <p className="text-xs mt-1">Record a sale or import a sales CSV to see monthly growth trends.</p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="h-64 flex items-end gap-3 sm:gap-6 pt-6 px-2">
              {monthlyData.map((item, idx) => {
                const prev = idx > 0 ? monthlyData[idx - 1] : null;
                const change = prev && prev.revenue > 0 ? ((item.revenue - prev.revenue) / prev.revenue) * 100 : null;
                const revenueHeightPct = Math.max(10, (item.revenue / maxMonthlyRevenue) * 100);
                const profitHeightPct = Math.max(5, (item.profit / maxMonthlyRevenue) * 100);
                const isSelected = selectedMonth === item.month;

                return (
                  <div
                    key={item.month}
                    onClick={() => setSelectedMonth(isSelected ? null : item.month)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    {/* Hover Card / Tooltip above bar */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-24 pointer-events-none bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-xl z-20 whitespace-nowrap">
                      <p className="font-bold border-b border-slate-700 pb-1 mb-1">{formatMonthLabel(item.month)}</p>
                      <p>Revenue: <strong className="text-blue-300">${item.revenue.toFixed(2)}</strong></p>
                      {canViewFinancials && <p>Net Profit: <strong className="text-emerald-300">${item.profit.toFixed(2)}</strong> ({item.marginPercent}%)</p>}
                      <p className="text-slate-400 text-[10px] mt-0.5">{item.ordersCount} orders</p>
                    </div>

                    {/* Change Pill */}
                    {change !== null && (
                      <span className={`text-[10px] font-bold mb-2 hidden sm:inline-block ${change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`}
                      </span>
                    )}

                    {/* Bars Container */}
                    <div className="w-full max-w-[54px] flex items-end justify-center gap-1.5 h-full">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${revenueHeightPct}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          isSelected ? 'bg-blue-700 ring-2 ring-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      />
                      {/* Profit Bar */}
                      {canViewFinancials && (
                        <div
                          style={{ height: `${profitHeightPct}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            isSelected ? 'bg-emerald-600 ring-2 ring-emerald-300' : 'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                        />
                      )}
                    </div>

                    {/* Month Label */}
                    <span className="text-xs font-semibold text-slate-600 mt-2 truncate w-full text-center">
                      {formatMonthLabel(item.month)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Selected Month Details Drawer */}
            {selectedMonth && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{formatMonthLabel(selectedMonth)} Summary:</span>
                  {(() => {
                    const d = monthlyData.find((m) => m.month === selectedMonth);
                    if (!d) return null;
                    return (
                      <span className="ml-2 text-slate-700">
                        Total Sales: <strong>${d.revenue}</strong> • Net Profit: <strong>${d.profit}</strong> • Margin: <strong>{d.marginPercent}%</strong> • Orders: <strong>{d.ordersCount}</strong>
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-blue-700 hover:underline font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Category Breakdown + Fulfillment Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Performance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Top FB Marketplace Categories</h3>
              <p className="text-xs text-slate-500">Revenue & units distributed across merchandise types</p>
            </div>
            <Tag className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3">
            {categorySales.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No categories recorded yet</p>
            ) : (
              categorySales.slice(0, 5).map((cat) => {
                const pct = totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{cat.name}</span>
                      <span className="text-slate-600">
                        ${cat.revenue.toFixed(2)} ({cat.count} sold) • <strong className="text-slate-900">{pct.toFixed(0)}%</strong>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Fulfillment Method Comparison: Local Pickup vs Shipped */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Fulfillment Breakdown</h3>
              <p className="text-xs text-slate-500">Local safe pickup cash sales vs Facebook shipped orders</p>
            </div>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Local Pickup Card */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Local Pickup / Cash</span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 font-bold px-1.5 py-0.5 rounded">0% Fees</span>
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">
                ${fulfillmentDistribution.localRev.toFixed(2)}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {fulfillmentDistribution.localCount} items sold via safe meetups (Cash, Venmo, Zelle).
              </p>
            </div>

            {/* Shipped Card */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800">Shipped (Nationwide)</span>
                <span className="text-[10px] bg-blue-200/60 text-blue-900 font-bold px-1.5 py-0.5 rounded">Tracking</span>
              </div>
              <p className="text-xl font-black text-slate-900 mt-2">
                ${fulfillmentDistribution.shippedRev.toFixed(2)}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {fulfillmentDistribution.shippedCount} items shipped with tracking labels.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Shipping profit margin: <strong>{netShippingMargin >= 0 ? `+$${netShippingMargin}` : `-$${Math.abs(netShippingMargin)}`}</strong></span>
            <button
              onClick={() => onNavigateTab('shipping')}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Shipping</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Recent Orders Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Orders</h3>
            <p className="text-xs text-slate-500">Latest active, confirmed, and delivered orders</p>
          </div>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View All Orders ({orders.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
            <p className="text-xs">No orders recorded yet. Click "Record Sale" to add your first sale!</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3">Buyer & Method</th>
                  <th className="py-2.5 px-3">Revenue</th>
                  {canViewFinancials && <th className="py-2.5 px-3">Net Profit</th>}
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{ord.date}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900 max-w-xs truncate">
                      {ord.itemTitle}
                      <span className="text-[11px] text-slate-400 block font-normal">Qty: {ord.quantity}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800 block truncate">{ord.buyerName || 'Marketplace Buyer'}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{ord.paymentMethod.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                      ${ord.totalRevenue.toFixed(2)}
                    </td>
                    {canViewFinancials && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-emerald-700 block">+${ord.netProfit.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">{ord.profitMargin}% margin</span>
                      </td>
                    )}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ord.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'shipped'
                          ? 'bg-blue-100 text-blue-800'
                          : ord.status === 'pending_pickup'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {ord.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
