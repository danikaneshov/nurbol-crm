import { useMemo, useState, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';

export const useDashboardStats = () => {
 const { allShifts, ownerProfits, employees, revisions, invMovements, selectedLocationId, positions } = useAdmin();

 const availableMonths = useMemo(() => {
 const months = new Set();
 allShifts.forEach(s => {
 if (s.dateStr) {
 const parts = s.dateStr.split('.');
 if (parts.length === 3) months.add(`${parts[1]}.${parts[2]}`);
 }
 });
 const now = new Date();
 const curMonth = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
 months.add(curMonth);
 
 return Array.from(months).sort((a, b) => {
 const [m1, y1] = a.split('.');
 const [m2, y2] = b.split('.');
 if (y1 !== y2) return y2 - y1;
 return m2 - m1;
 });
 }, [allShifts]);

 const defaultMonth = availableMonths[0] || (() => {
 const now = new Date();
 return `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
 })();

 const [dashboardMonth, setDashboardMonth] = useState(defaultMonth);
 const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

 const calculateEmployeeStats = useCallback((empId, month = selectedMonth) => {
 let empShifts = allShifts.filter(s => s.employeeId === empId);
 if (month && month !== 'all') {
 empShifts = empShifts.filter(s => s.dateStr && s.dateStr.endsWith(`.${month}`));
 }
 if (selectedLocationId && selectedLocationId !== 'all') {
 empShifts = empShifts.filter(s => s.locationId === selectedLocationId);
 }
 const closedShifts = empShifts.filter(s => s.status === 'closed');
 const hasOpenShift = empShifts.some(s => s.status === 'open');
 
 let totalItemsCount = 0;
 let ownerNetProfit = 0;

 closedShifts.forEach(s => {
   if (s.items) {
     Object.keys(s.items).forEach(posId => {
       const qty = Number(s.items[posId]) || 0;
       totalItemsCount += qty;
       
       const pos = positions.find(p => p.id === posId);
       if (pos) {
         if (pos.marginType === 'fixed') {
           ownerNetProfit += qty * (Number(pos.marginValue) || 0);
         } else if (pos.marginType === 'percent') {
           ownerNetProfit += qty * (Number(pos.price) || 0) * ((Number(pos.marginValue) || 0) / 100);
         }
       } else if (posId === 'cocktail1') {
         // Legacy fallback
         ownerNetProfit += qty * (ownerProfits.hookah || 0);
       } else if (posId === 'cocktail2') {
         // Legacy fallback
         ownerNetProfit += qty * (ownerProfits.replacement || 0);
       }
     });
   }
 });

 const baseEarned = closedShifts.reduce((sum, s) => sum + (s.earned || 0), 0);
 const baseSalaryTotal = closedShifts.reduce((sum, s) => sum + (s.baseSalary || 0), 0);
 const hookahPercentageTotal = closedShifts.reduce((sum, s) => sum + (s.hookahPercentage || 0), 0); // legacy
 const shiftsCount = closedShifts.reduce((sum, s) => sum + (s.shiftFraction || 1), 0);

 const totalRevisionDeductions = Math.round(revisions
 .filter(r => (month === 'all' || r.month === month) && (selectedLocationId === 'all' || r.locationId === selectedLocationId))
 .reduce((sum, r) => sum + (r.deductions?.[empId] || 0), 0));

 const totalEarned = Math.round(baseEarned - totalRevisionDeductions);

 return {
 totalEarned,
 baseEarned,
 totalRevisionDeductions,
 baseSalaryTotal,
 hookahPercentageTotal,
 hookahs: totalItemsCount, // mapping all items to hookahs for UI backward comp
 replacements: 0,
 totalItems: totalItemsCount,
 shiftsCount,
 hasOpenShift,
 ownerNetProfit
 };
 }, [allShifts, ownerProfits, selectedMonth, selectedLocationId, revisions, positions]);

  const closedSystemShifts = useMemo(() => {
    return allShifts.filter(s => s.status === 'closed' 
      && (dashboardMonth === 'all' || (s.dateStr && s.dateStr.endsWith(`.${dashboardMonth}`)))
      && (selectedLocationId === 'all' || s.locationId === selectedLocationId)
    );
  }, [allShifts, dashboardMonth, selectedLocationId]);

  const uniqueShiftsGroups = useMemo(() => {
    const groups = {};
    closedSystemShifts.forEach(shift => {
      const date = shift.dateStr || 'unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(shift);
    });
    return Object.values(groups);
  }, [closedSystemShifts]);

  const globalRevisionDeductions = useMemo(() => {
    return Math.round(revisions
      .filter(r => (dashboardMonth === 'all' || r.month === dashboardMonth) && (selectedLocationId === 'all' || r.locationId === selectedLocationId))
      .reduce((sum, r) => sum + (r.debt?.total || 0), 0));
  }, [revisions, dashboardMonth, selectedLocationId]);

  const totalSystemEarned = useMemo(() => {
    const earned = closedSystemShifts.reduce((a,b) => a + (b.earned || 0), 0);
    return earned - globalRevisionDeductions;
  }, [closedSystemShifts, globalRevisionDeductions]);

  // Compute total sold items and profit
    const { globalHookahs, globalReplacements, globalOwnerProfit, globalStaffHookahs, globalPositionsSold } = useMemo(() => {
      let hookahs = 0;
      let replacements = 0;
      let profit = 0;
      let staffH = 0;
      const positionsSold = {};
  
      uniqueShiftsGroups.forEach(group => {
        const s = group[0];
        staffH += (s.staffHookahs || 0);
        
        if (s.items) {
          Object.keys(s.items).forEach(posId => {
            const qty = Number(s.items[posId]) || 0;
            if (qty <= 0) return;
  
            const pos = positions.find(p => p.id === posId);
            const posName = pos ? pos.name : (posId === 'cocktail1' ? 'Кальяны' : (posId === 'cocktail2' ? 'Замены' : posId));
            
            if (!positionsSold[posId]) {
              positionsSold[posId] = { id: posId, name: posName, count: 0, profit: 0 };
            }
            
            positionsSold[posId].count += qty;
            
            let posProfit = 0;
            if (pos) {
              if (pos.marginType === 'fixed') {
                posProfit = qty * (Number(pos.marginValue) || 0);
              } else if (pos.marginType === 'percent') {
                posProfit = qty * (Number(pos.price) || 0) * ((Number(pos.marginValue) || 0) / 100);
              }
            } else if (posId === 'cocktail1') {
              posProfit = qty * (ownerProfits.hookah || 0);
            } else if (posId === 'cocktail2') {
              posProfit = qty * (ownerProfits.replacement || 0);
            }
  
            positionsSold[posId].profit += posProfit;
            profit += posProfit;
  
            if (posId === 'cocktail1') hookahs += qty;
            else if (posId === 'cocktail2') replacements += qty;
            else hookahs += qty; // fallback mapping
          });
        }
      });
  
      return { globalHookahs: hookahs, globalReplacements: replacements, globalOwnerProfit: profit, globalStaffHookahs: staffH, globalPositionsSold: Object.values(positionsSold) };
    }, [uniqueShiftsGroups, ownerProfits, positions]);
  
  const replacementRate = globalHookahs > 0 ? ((globalReplacements / globalHookahs) * 100).toFixed(1) : 0;

  const dashboardNetProfit = globalOwnerProfit - totalSystemEarned;
  
  const dashboardPurchases = useMemo(() => {
    return invMovements
      .filter(m => m.type === 'in' && m.cost > 0 && (dashboardMonth === 'all' || (m.dateStr && m.dateStr.endsWith(`.${dashboardMonth}`))) && (selectedLocationId === 'all' || m.locationId === selectedLocationId))
      .reduce((sum, m) => sum + m.cost, 0);
  }, [invMovements, dashboardMonth, selectedLocationId]);

  const dashboardProfitWithoutTamerlan = useMemo(() => {
    return 0; // Disabled as per user request
  }, []);

 const dashboardProfitByMaster = useMemo(() => {
 return employees.map(emp => {
 const stats = calculateEmployeeStats(emp.id, dashboardMonth);
 return {
 id: emp.id,
 name: emp.name,
 hookahs: stats.hookahs,
 replacements: stats.replacements,
 ownerNetProfit: stats.ownerNetProfit
 };
 }).sort((a, b) => b.ownerNetProfit - a.ownerNetProfit);
 }, [employees, calculateEmployeeStats, dashboardMonth]);

  const chartData = useMemo(() => {
    const map = {};
    uniqueShiftsGroups.forEach(group => {
      const s = group[0];
      if (s && s.dateStr) {
        const shortDate = s.dateStr.split('.').slice(0, 2).join('.');
        if (!map[shortDate]) map[shortDate] = { name: shortDate, revenue: 0, hookahs: 0, replacements: 0, totalSales: 0 };
        const totalEarned = group.reduce((sum, rec) => sum + (rec.earned || 0), 0);
        map[shortDate].revenue += totalEarned;
        
        let dailyH = 0;
        let dailyR = 0;
        if (s.items) {
          Object.keys(s.items).forEach(posId => {
            const qty = Number(s.items[posId]) || 0;
            if (posId === 'cocktail2') dailyR += qty;
            else dailyH += qty;
          });
        }
        
        map[shortDate].hookahs += dailyH;
        map[shortDate].replacements += dailyR;
        map[shortDate].totalSales += dailyH + dailyR;
      }
    });
    return Object.values(map).reverse();
  }, [uniqueShiftsGroups]);

 return {
 availableMonths,
 dashboardMonth,
 setDashboardMonth,
 selectedMonth,
 setSelectedMonth,
 totalSystemEarned,
 globalHookahs,
 globalReplacements,
 replacementRate,
 globalOwnerProfit,
 dashboardNetProfit,
 dashboardPurchases,
 globalStaffHookahs,
 globalPositionsSold,
 dashboardProfitByMaster,
 chartData,
 calculateEmployeeStats,
 globalRevisionDeductions
 };
};
