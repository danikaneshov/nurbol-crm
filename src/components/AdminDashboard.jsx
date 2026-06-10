import { useState, useEffect, useMemo, useCallback } from 'react';
import { LogOut, Users, LayoutDashboard, Key, Trash2, Image, Settings, Menu, X, Percent, Wallet, Database, AlertTriangle, Clock, Banknote, CalendarDays, Calendar as CalendarIcon, Package, ArrowDownToLine, ArrowUpFromLine, Calculator, Ruler, ShoppingCart, CheckCircle2, Plus, Flame, Edit3, Save, RotateCcw, ClipboardCheck, ChevronDown, MapPin, Wrench, Leaf } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc, doc, serverTimestamp, setDoc, getDocs, where, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import * as XLSX from 'xlsx';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import EquipmentTab from './EquipmentTab';
import RevisionTab from './RevisionTab';

const formatMoney = (amount) => {
  if (amount === undefined || amount === null) return 0;
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [subTab, setSubTab] = useState(''); // Суб-табы внутри разделов
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null); // null = все точки
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocProfitHookah, setNewLocProfitHookah] = useState('');
  const [newLocProfitReplacement, setNewLocProfitReplacement] = useState('');
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [editingLocId, setEditingLocId] = useState(null);
  const [editLocForm, setEditLocForm] = useState({ name: '', address: '' });
  const [allShifts, setAllShifts] = useState([]);
  
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPin, setNewEmpPin] = useState('');
  const [newEmpBaseSalary, setNewEmpBaseSalary] = useState(3000);
  const [newEmpHookahBonus, setNewEmpHookahBonus] = useState(1500);
  const [newEmpReplacementBonus, setNewEmpReplacementBonus] = useState(1500);
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingEmpId, setEditingEmpId] = useState(null);
  const [editEmpForm, setEditEmpForm] = useState({ baseSalary: 3000, bonus1: 1500, bonus2: 1500 });

  const [selectedEmpReport, setSelectedEmpReport] = useState(null);

  // Настройки маржинальности владельца (Аутсорс)
  const [ownerProfits, setOwnerProfits] = useState({ hookah: 0, replacement: 0 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [debugShiftPhoto, setDebugShiftPhoto] = useState(null);
  const [isUploadingPastShift, setIsUploadingPastShift] = useState(false);

  // Редактирование смены
  const [editingShift, setEditingShift] = useState(false);
  const [editForm, setEditForm] = useState({ hookahs: 0, replacements: 0, partnerId: '', removePartner: false });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Склад
  const [invMovements, setInvMovements] = useState([]);
  const [invTemplates, setInvTemplates] = useState([]);
  const [invStandards, setInvStandards] = useState({ coalPerBowl: 5, tobaccoPerBowl: 23, mouthpiecePerBowl: 1 });
  const [invForm, setInvForm] = useState({ type: 'in', item: 'coal', amount: '', cost: '', note: '', templateId: '' });
  const [invCart, setInvCart] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ name: '', item: 'tobacco', amount: '', price: '' });
  const [isSavingInv, setIsSavingInv] = useState(false);
  const [cartLocationId, setCartLocationId] = useState('');
  const [writeoffLocationId, setWriteoffLocationId] = useState('');


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

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [dashboardMonth, setDashboardMonth] = useState(defaultMonth);

  const getMonthDateRange = useCallback((monthStr) => {
    if (!monthStr || monthStr === 'all') return null;
    return {
      start: `01.${monthStr}`,
      end: `31.${monthStr}`
    };
  }, []);

  const groupedShifts = useMemo(() => {
    const groups = {};
    const rankShiftStatus = (status) => {
      if (status === 'closed') return 2;
      if (status === 'open') return 1;
      return 0;
    };

    const shiftsToGroup = selectedLocationId
      ? allShifts.filter(s => s.locationId === selectedLocationId)
      : allShifts;

    const dedupedShifts = Object.values(
      shiftsToGroup
        .filter((shift) => shift.status !== 'cancelled')
        .reduce((acc, shift) => {
          const date = shift.dateStr || 'Неизвестная дата';
          const employee = shift.employeeId || shift.employeeName || shift.id;
          const key = `${date}__${employee}`;
          const prev = acc[key];
          if (!prev) {
            acc[key] = shift;
            return acc;
          }

          const prevRank = rankShiftStatus(prev.status);
          const nextRank = rankShiftStatus(shift.status);
          if (nextRank > prevRank) {
            acc[key] = shift;
            return acc;
          }

          if (nextRank === prevRank) {
            const prevTs = prev.endTime?.seconds || prev.startTime?.seconds || 0;
            const nextTs = shift.endTime?.seconds || shift.startTime?.seconds || 0;
            if (nextTs > prevTs) acc[key] = shift;
          }
          return acc;
        }, {})
    );

    dedupedShifts.forEach(shift => {
      const date = shift.dateStr || 'Неизвестная дата';
      if (!groups[date]) {
        groups[date] = {
          dateStr: date,
          records: [],
          totalItems: 0,
          totalEarned: 0,
          totalStaffHookahs: 0,
          status: 'closed'
        };
      }
      groups[date].records.push(shift);
      groups[date].totalItems += (shift.totalItems || 0);
      groups[date].totalEarned += (shift.earned || 0);
      groups[date].totalStaffHookahs += (shift.staffHookahs || 0);
      if (shift.status === 'open') {
        groups[date].status = 'open';
      }
    });
    return Object.values(groups).map(group => {
      group.records.sort((a, b) => {
        if (a.startTime && !b.startTime) return -1;
        if (!a.startTime && b.startTime) return 1;
        return 0;
      });
      return group;
    }).sort((a, b) => {
      if (!a.dateStr.includes('.') || !b.dateStr.includes('.')) return 0;
      const [d1, m1, y1] = a.dateStr.split('.');
      const [d2, m2, y2] = b.dateStr.split('.');
      const date1 = new Date(`${y1}-${m1}-${d1}`);
      const date2 = new Date(`${y2}-${m2}-${d2}`);
      return date2 - date1;
    });
  }, [allShifts, selectedLocationId]);

  // Debug Panel State
  const [debugShift, setDebugShift] = useState({
    dateStr: '',
    locationId: '',
    employeeId: '',
    partnerId: '',
    hookahs: 0,
    replacements: 0
  });

  useEffect(() => {
    const unsubEmp = onSnapshot(query(collection(db, 'employees'), orderBy('createdAt', 'desc')), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLoc = onSnapshot(query(collection(db, 'locations'), orderBy('createdAt', 'desc')), (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const salesQuery = query(collection(db, 'sales'), orderBy('dateStr', 'desc'), limit(1000));

    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const shifts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      shifts.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return (b.endTime?.seconds || 0) - (a.endTime?.seconds || 0);
      });
      setAllShifts(shifts);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'profits'), (docSnap) => {
      if (docSnap.exists()) setOwnerProfits(docSnap.data());
    });


    return () => {
      unsubSales(); unsubEmp(); unsubSettings(); unsubLoc();
    };
  }, []);

  useEffect(() => {
    const shouldSubscribeInventory =
      activeTab === 'inventory' ||
      activeTab === 'revision' ||
      (activeTab === 'finances' && (subTab === 'purchases' || subTab === 'profit'));

    if (!shouldSubscribeInventory) return undefined;

    const unsubInvStd = onSnapshot(doc(db, 'settings', 'inventory_standards'), (docSnap) => {
      if (docSnap.exists()) setInvStandards(docSnap.data());
    });

    const unsubInvMov = onSnapshot(collection(db, 'inventory_movements'), (snap) => {
      const movs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      movs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        if (timeA !== timeB) return timeB - timeA;
        
        if (!a.dateStr || !b.dateStr) return 0;
        const [d1, m1, y1] = a.dateStr.split('.');
        const [d2, m2, y2] = b.dateStr.split('.');
        const dateA = new Date(`${y1}-${m1}-${d1}`).getTime() || 0;
        const dateB = new Date(`${y2}-${m2}-${d2}`).getTime() || 0;
        return dateB - dateA;
      });
      setInvMovements(movs);
    });

    const unsubInvTemplates = onSnapshot(query(collection(db, 'inventory_templates'), orderBy('name', 'asc')), (snap) => {
      setInvTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubInvStd(); unsubInvMov(); unsubInvTemplates(); };
  }, [activeTab, subTab]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'profits'), ownerProfits);
      alert('Настройки прибыли успешно сохранены!');
    } catch (err) { alert('Ошибка сохранения: ' + err.message); }
    finally { setIsSavingSettings(false); }
  };
  const handleSaveStandards = async () => {
    setIsSavingInv(true);
    try { await setDoc(doc(db, 'settings', 'inventory_standards'), invStandards); alert('Стандарты сохранены!'); }
    catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsSavingInv(false); }
  };

  const handleCreateDebugShift = async (e) => {
    e.preventDefault();
    if (!debugShift.employeeId || !debugShift.dateStr || !debugShift.locationId) return alert('Выберите заведение, мастера и дату');
    
    const dStr = debugShift.dateStr.split('-').reverse().join('.');
    const emp = employees.find(e => e.id === debugShift.employeeId);
    
    setIsUploadingPastShift(true);

    try {
      let uploadedImageUrl = 'no-photo';
      if (debugShiftPhoto) {
        const formData = new FormData();
        formData.append('file', debugShiftPhoto);
        formData.append('upload_preset', 'ml_default');

        const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dl5vgfkvr/image/upload', {
          method: 'POST', body: formData 
        });
        const cloudData = await cloudRes.json();
        if (!cloudRes.ok) throw new Error(cloudData?.error?.message || 'Ошибка Cloudinary');
        uploadedImageUrl = cloudData.secure_url;
      }

      const ownerBase = emp.baseSalary !== undefined ? emp.baseSalary : (emp.name.trim().toLowerCase() === 'tamerlan' ? 1500 : 3000);
      const ownerBonus1 = emp.bonus1 !== undefined ? emp.bonus1 : 1500;
      const ownerBonus2 = emp.bonus2 !== undefined ? emp.bonus2 : 1500;

      let partner = null;
      let c1 = Number(debugShift.hookahs) || 0;
      let c2 = Number(debugShift.replacements) || 0;
      let myTotalItems = c1 + c2;

      if (debugShift.partnerId) {
        partner = employees.find(e => e.id === debugShift.partnerId);
        const partnerBase = partner.baseSalary !== undefined ? partner.baseSalary : 1500;
        const partnerBonus1 = partner.bonus1 !== undefined ? partner.bonus1 : 1500;
        const partnerBonus2 = partner.bonus2 !== undefined ? partner.bonus2 : 1500;
        
        let targetOwnerTotal = Math.ceil((c1 + c2) / 2);
        let ownerC1 = Math.ceil(c1 / 2);
        let ownerC2 = targetOwnerTotal - ownerC1;
        let partnerC1 = c1 - ownerC1;
        let partnerC2 = c2 - ownerC2;

        let partnerTotalItems = partnerC1 + partnerC2;
        let partnerEarned = partnerBase + (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2);

        let ownerTotalItems = ownerC1 + ownerC2;
        let ownerEarned = ownerBase + (ownerC1 * ownerBonus1) + (ownerC2 * ownerBonus2);
        
        await addDoc(collection(db, 'sales'), {
          locationId: debugShift.locationId, locationName: locations.find(l => l.id === debugShift.locationId)?.name || 'Неизвестно',
          employeeId: partner.id, employeeName: partner.name,
          dateStr: dStr, endTime: serverTimestamp(), photoUrl: uploadedImageUrl,
          items: { cocktail1: partnerC1, cocktail2: partnerC2 },
          totalItems: partnerTotalItems, earned: partnerEarned,
          baseSalary: partnerBase, hookahPercentage: (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2),
          shiftFraction: 0.5,
          status: 'closed'
        });

        await addDoc(collection(db, 'sales'), {
          locationId: debugShift.locationId, locationName: locations.find(l => l.id === debugShift.locationId)?.name || 'Неизвестно',
          employeeId: emp.id, employeeName: emp.name,
          dateStr: dStr, startTime: serverTimestamp(), endTime: serverTimestamp(), photoUrl: uploadedImageUrl,
          items: { cocktail1: ownerC1, cocktail2: ownerC2 },
          totalItems: ownerTotalItems, earned: ownerEarned,
          baseSalary: ownerBase, hookahPercentage: (ownerC1 * ownerBonus1) + (ownerC2 * ownerBonus2),
          shiftFraction: 1,
          status: 'closed'
        });

      } else {
        let myEarned = ownerBase + (c1 * ownerBonus1) + (c2 * ownerBonus2);
        await addDoc(collection(db, 'sales'), {
          locationId: debugShift.locationId, locationName: locations.find(l => l.id === debugShift.locationId)?.name || 'Неизвестно',
          employeeId: emp.id, employeeName: emp.name,
          dateStr: dStr, startTime: serverTimestamp(), endTime: serverTimestamp(), photoUrl: uploadedImageUrl,
          items: { cocktail1: c1, cocktail2: c2 },
          totalItems: myTotalItems, earned: myEarned,
          baseSalary: ownerBase, hookahPercentage: (c1 * ownerBonus1) + (c2 * ownerBonus2),
          shiftFraction: 1,
          status: 'closed'
        });
      }
      
      alert('Смена успешно загружена!');
      setDebugShift({ ...debugShift, hookahs: 0, replacements: 0, partnerId: '', locationId: '' });
      setDebugShiftPhoto(null);
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setIsUploadingPastShift(false);
    }
  };

  const generatePin = () => {
    let newPin;
    do {
      newPin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (employees.some(emp => emp.pin === newPin));
    setNewEmpPin(newPin);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmpName || newEmpPin.length !== 4) return;
    
    if (employees.some(emp => emp.pin === newEmpPin)) {
      return alert('Сотрудник с таким PIN уже существует! Введите другой или сгенерируйте новый.');
    }
    
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'employees'), {
        name: newEmpName, pin: newEmpPin.toString(),
        createdAt: serverTimestamp(), 
        baseSalary: Number(newEmpBaseSalary), 
        bonus1: Number(newEmpHookahBonus), 
        bonus2: Number(newEmpReplacementBonus)
      });
      setNewEmpName(''); setNewEmpPin('');
      setNewEmpBaseSalary(3000); setNewEmpHookahBonus(1500); setNewEmpReplacementBonus(1500);
    } catch (error) { console.error(error); } finally { setIsAdding(false); }
  };

  const handleSaveEmpEdit = async (empId) => {
    try {
      await updateDoc(doc(db, 'employees', empId), {
        baseSalary: Number(editEmpForm.baseSalary),
        bonus1: Number(editEmpForm.bonus1),
        bonus2: Number(editEmpForm.bonus2)
      });
      setEditingEmpId(null);
    } catch (error) { alert('Ошибка при сохранении: ' + error.message); }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!newLocName) return;
    setIsAddingLoc(true);
    try {
      await addDoc(collection(db, 'locations'), {
        name: newLocName,
        address: newLocAddress,
        profitHookah: Number(newLocProfitHookah) || ownerProfits.hookah,
        profitReplacement: Number(newLocProfitReplacement) || ownerProfits.replacement,
        isActive: true,
        createdAt: serverTimestamp()
      });
      setNewLocName(''); setNewLocAddress(''); setNewLocProfitHookah(''); setNewLocProfitReplacement('');
    } catch (error) { alert('Ошибка: ' + error.message); } finally { setIsAddingLoc(false); }
  };

  const handleSaveLocEdit = async (locId) => {
    try {
      await updateDoc(doc(db, 'locations', locId), {
        name: editLocForm.name,
        address: editLocForm.address
      });
      setEditingLocId(null);
    } catch (error) { alert('Ошибка при сохранении: ' + error.message); }
  };

  const calculateEmployeeStats = useCallback((empId, month = selectedMonth) => {
    let empShifts = allShifts.filter(s => s.employeeId === empId);
    if (selectedLocationId) {
      empShifts = empShifts.filter(s => s.locationId === selectedLocationId);
    }
    if (month && month !== 'all') {
      empShifts = empShifts.filter(s => s.dateStr && s.dateStr.endsWith(`.${month}`));
    }
    const closedShifts = empShifts.filter(s => s.status === 'closed');
    const hasOpenShift = empShifts.some(s => s.status === 'open');
    
    const hookahs = closedShifts.reduce((sum, s) => sum + (s.items?.cocktail1 || 0), 0);
    const replacements = closedShifts.reduce((sum, s) => sum + (s.items?.cocktail2 || 0), 0);

    const totalEarned = closedShifts.reduce((sum, s) => sum + (s.earned || 0), 0);
    const baseSalaryTotal = closedShifts.reduce((sum, s) => sum + (s.baseSalary || 0), 0);
    const hookahPercentageTotal = closedShifts.reduce((sum, s) => sum + (s.hookahPercentage || 0), 0);
    const shiftsCount = closedShifts.reduce((sum, s) => sum + (s.shiftFraction || 1), 0);

    return {
      totalEarned,
      baseSalaryTotal,
      hookahPercentageTotal,
      hookahs,
      replacements,
      totalItems: hookahs + replacements,
      shiftsCount,
      hasOpenShift,
      ownerNetProfit: closedShifts.reduce((acc, s) => {
        const loc = locations.find(l => l.id === s.locationId) || {};
        const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
        const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
        return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
      }, 0)
    };
  }, [allShifts, ownerProfits, selectedMonth, selectedLocationId]);

  const monthlyStats = useMemo(() => {
    const isAll = selectedMonth === 'all';
    const filteredShifts = allShifts.filter(s => 
      s.status === 'closed' && 
      (isAll || (s.dateStr && s.dateStr.endsWith(`.${selectedMonth}`))) &&
      (!selectedLocationId || s.locationId === selectedLocationId)
    );
    
    const earned = filteredShifts.reduce((a, b) => a + (b.earned || 0), 0);
    const hookahs = filteredShifts.reduce((a, b) => a + (b.items?.cocktail1 || 0), 0);
    const replacements = filteredShifts.reduce((a, b) => a + (b.items?.cocktail2 || 0), 0);
    const ownerProfit = filteredShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
      const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
      return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
    }, 0);
    
    const tamerlanEarned = filteredShifts
      .filter(s => s.employeeName && s.employeeName.trim().toLowerCase() === 'tamerlan')
      .reduce((a, b) => a + (b.earned || 0), 0);
    
    const purchases = invMovements
      .filter(m => 
        m.type === 'in' && 
        (isAll || (m.dateStr && m.dateStr.endsWith(`.${selectedMonth}`))) &&
        (!selectedLocationId || m.locationId === selectedLocationId)
      )
      .reduce((a, b) => a + (b.cost || 0), 0);

    const hookahProfit = filteredShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
      return acc + ((s.items?.cocktail1 || 0) * ph);
    }, 0);
    const replacementProfit = filteredShifts.reduce((acc, s) => {
      const loc = locations.find(l => l.id === s.locationId) || {};
      const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
      return acc + ((s.items?.cocktail2 || 0) * pr);
    }, 0);

    return {
      earned,
      hookahs,
      replacements,
      ownerProfit,
      hookahProfit,
      replacementProfit,
      tamerlanEarned,
      purchases,
      netProfit: ownerProfit - earned,
      profitWithoutTamerlan: ownerProfit - (earned - tamerlanEarned)
    };
  }, [allShifts, selectedMonth, ownerProfits, invMovements, selectedLocationId]);

  const locationFilteredShifts = selectedLocationId
    ? allShifts.filter(s => s.locationId === selectedLocationId)
    : allShifts;

  const closedSystemShifts = locationFilteredShifts.filter(s => s.status === 'closed' && (dashboardMonth === 'all' || (s.dateStr && s.dateStr.endsWith(`.${dashboardMonth}`))));
  const totalSystemEarned = closedSystemShifts.reduce((a,b) => a + (b.earned || 0), 0);
  const globalHookahs = closedSystemShifts.reduce((a,b) => a + (b.items?.cocktail1 || 0), 0);
  const globalReplacements = closedSystemShifts.reduce((a,b) => a + (b.items?.cocktail2 || 0), 0);
  const globalOwnerProfit = closedSystemShifts.reduce((acc, s) => {
    const loc = locations.find(l => l.id === s.locationId) || {};
    const ph = loc.profitHookah !== undefined ? Number(loc.profitHookah) : ownerProfits.hookah;
    const pr = loc.profitReplacement !== undefined ? Number(loc.profitReplacement) : ownerProfits.replacement;
    return acc + ((s.items?.cocktail1 || 0) * ph) + ((s.items?.cocktail2 || 0) * pr);
  }, 0);
  const globalStaffHookahs = closedSystemShifts.reduce((a,b) => a + (b.staffHookahs || 0), 0);
  
  const replacementRate = globalHookahs > 0 ? ((globalReplacements / globalHookahs) * 100).toFixed(1) : 0;

  const profitByMaster = useMemo(() => {
    return employees.map(emp => {
      const stats = calculateEmployeeStats(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        hookahs: stats.hookahs,
        replacements: stats.replacements,
        ownerNetProfit: stats.ownerNetProfit
      };
    }).sort((a, b) => b.ownerNetProfit - a.ownerNetProfit);
  }, [employees, calculateEmployeeStats]);

  const chartData = useMemo(() => {
    const map = {};
    closedSystemShifts.forEach(s => {
      if (s.dateStr) {
        const shortDate = s.dateStr.split('.').slice(0, 2).join('.');
        if (!map[shortDate]) map[shortDate] = { name: shortDate, revenue: 0, hookahs: 0, replacements: 0, totalSales: 0 };
        map[shortDate].revenue += s.earned;
        map[shortDate].hookahs += (s.items?.cocktail1 || 0);
        map[shortDate].replacements += (s.items?.cocktail2 || 0);
        map[shortDate].totalSales += (s.items?.cocktail1 || 0) + (s.items?.cocktail2 || 0);
      }
    });
    return Object.values(map).reverse();
  }, [closedSystemShifts]);

  const switchTab = (tabName, defaultSubTab = '') => {
    setActiveTab(tabName);
    setSubTab(defaultSubTab);
    setSelectedEmpReport(null);
    setEditingShift(false);
    setIsMobileMenuOpen(false);
  };

  const startEditingShift = (shiftGroup) => {
    const totalHookahs = shiftGroup.records.reduce((sum, r) => sum + (r.items?.cocktail1 || 0), 0);
    const totalReplacements = shiftGroup.records.reduce((sum, r) => sum + (r.items?.cocktail2 || 0), 0);
    const partnerRecord = shiftGroup.records.find(r => !r.startTime);
    setEditForm({
      hookahs: totalHookahs,
      replacements: totalReplacements,
      partnerId: partnerRecord ? partnerRecord.employeeId : '',
      removePartner: false
    });
    setEditingShift(true);
  };

  const handleSaveShiftEdit = async () => {
    if (!selectedEmpReport) return;
    setIsSavingEdit(true);
    try {
      const records = selectedEmpReport.records;
      const ownerRecord = records.find(r => r.startTime) || records[0];
      const partnerRecord = records.find(r => !r.startTime && r.id !== ownerRecord.id);

      const c1 = Number(editForm.hookahs) || 0;
      const c2 = Number(editForm.replacements) || 0;
      const ownerEmp = employees.find(e => e.id === ownerRecord.employeeId);
      const ownerBase = ownerEmp?.baseSalary !== undefined ? ownerEmp.baseSalary : (ownerEmp?.name?.trim().toLowerCase() === 'tamerlan' ? 1500 : 3000);
      const ownerBonus1 = ownerEmp?.bonus1 !== undefined ? ownerEmp.bonus1 : 1500;
      const ownerBonus2 = ownerEmp?.bonus2 !== undefined ? ownerEmp.bonus2 : 1500;

      const newPartnerId = editForm.partnerId;
      const hadPartner = !!partnerRecord;
      const hasNewPartner = !!newPartnerId;

      if (hasNewPartner) {
        const partner = employees.find(e => e.id === newPartnerId);
        if (!partner) throw new Error('Напарник не найден');
        const partnerBase = partner.baseSalary !== undefined ? partner.baseSalary : 1500;
        const partnerBonus1 = partner.bonus1 !== undefined ? partner.bonus1 : 1500;
        const partnerBonus2 = partner.bonus2 !== undefined ? partner.bonus2 : 1500;

        const ownerC1 = Math.ceil(c1 / 2);
        const targetOwnerTotal = Math.ceil((c1 + c2) / 2);
        const ownerC2 = targetOwnerTotal - ownerC1;
        const partnerC1 = c1 - ownerC1;
        const partnerC2 = c2 - ownerC2;

        const ownerTotalItems = ownerC1 + ownerC2;
        const ownerEarned = ownerBase + (ownerC1 * ownerBonus1) + (ownerC2 * ownerBonus2);
        const partnerTotalItems = partnerC1 + partnerC2;
        const partnerEarned = partnerBase + (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2);

        await updateDoc(doc(db, 'sales', ownerRecord.id), {
          items: { cocktail1: ownerC1, cocktail2: ownerC2 },
          totalItems: ownerTotalItems,
          earned: ownerEarned,
          baseSalary: ownerBase,
          hookahPercentage: (ownerC1 * ownerBonus1) + (ownerC2 * ownerBonus2),
          shiftFraction: 1,
          partnerId: newPartnerId
        });

        if (hadPartner && partnerRecord.employeeId === newPartnerId) {
          await updateDoc(doc(db, 'sales', partnerRecord.id), {
            items: { cocktail1: partnerC1, cocktail2: partnerC2 },
            totalItems: partnerTotalItems,
            earned: partnerEarned,
            baseSalary: partnerBase,
            hookahPercentage: (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2),
            shiftFraction: 0.5
          });
        } else {
          if (hadPartner) {
            await deleteDoc(doc(db, 'sales', partnerRecord.id));
          }
          await addDoc(collection(db, 'sales'), {
          locationId: debugShift.locationId, locationName: locations.find(l => l.id === debugShift.locationId)?.name || 'Неизвестно',
            employeeId: partner.id,
            employeeName: partner.name,
            dateStr: ownerRecord.dateStr,
            endTime: serverTimestamp(),
            photoUrl: ownerRecord.photoUrl || 'no-photo',
            items: { cocktail1: partnerC1, cocktail2: partnerC2 },
            totalItems: partnerTotalItems,
            earned: partnerEarned,
            baseSalary: partnerBase,
            hookahPercentage: (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2),
            shiftFraction: 0.5,
            status: 'closed'
          });
        }
      } else {
        const myTotalItems = c1 + c2;
        const myEarned = ownerBase + (c1 * ownerBonus1) + (c2 * ownerBonus2);

        await updateDoc(doc(db, 'sales', ownerRecord.id), {
          items: { cocktail1: c1, cocktail2: c2 },
          totalItems: myTotalItems,
          earned: myEarned,
          baseSalary: ownerBase,
          hookahPercentage: (c1 * ownerBonus1) + (c2 * ownerBonus2),
          shiftFraction: 1,
          partnerId: ''
        });

        if (hadPartner) {
          await deleteDoc(doc(db, 'sales', partnerRecord.id));
        }
      }

      setEditingShift(false);
      setSelectedEmpReport(null);
      alert('Смена успешно обновлена!');
    } catch (err) {
      alert('Ошибка сохранения: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ============================
  //  NAV CONFIG
  // ============================
  const navItems = [
    { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
    { id: 'shifts', label: 'Смены', icon: CalendarIcon, defaultSub: 'calendar' },
    { id: 'finances', label: 'Финансы', icon: Banknote, defaultSub: 'salaries' },
    { id: 'inventory', label: 'Склад', icon: Package, defaultSub: 'stock' },
    { id: 'revision', label: 'Ревизия', icon: ClipboardCheck },
    { id: 'equipment', label: 'Оборудование', icon: Wrench },
    { id: 'settings', label: 'Настройки', icon: Settings, defaultSub: 'employees' },
  ];

  const selectedLocName = selectedLocationId
    ? locations.find(l => l.id === selectedLocationId)?.name || 'Точка'
    : 'Все точки';

  const tabTitles = {
    dashboard: 'Дашборд',
    shifts: subTab === 'calendar' ? 'Календарь смен' : 'Список смен',
    finances: subTab === 'salaries' ? 'Зарплаты' : subTab === 'profit' ? 'Прибыль' : 'Закупы',
    inventory: subTab === 'stock' ? 'Остатки' : subTab === 'incoming' ? 'Приход' : subTab === 'templates' ? 'Шаблоны' : subTab === 'writeoff' ? 'Списание' : 'Склад',
    revision: 'Ревизия',
    equipment: 'Оборудование',
    settings: subTab === 'employees' ? 'Персонал' : subTab === 'locations' ? 'Локации' : subTab === 'margins' ? 'Маржинальность' : 'Debug',
  };

  return (
    <div className="flex h-screen bg-[#FAFBFC] relative no-select">
      {/* ======================== SIDEBAR ======================== */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 w-64 bg-white border-r border-gray-200/60 flex flex-col shadow-lg lg:shadow-none`}>
        
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-200/60">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 bg-accent-600 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-semibold text-sm">H</span>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-900 tracking-tight">Hookah<span className="text-accent-600">CRM</span></span>
              <p className="text-xs text-gray-500 font-medium -mt-0.5">Панель управления</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => switchTab(item.id, item.defaultSub || '')} 
                className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
              >
                <Icon size={18} className={isActive ? 'text-accent-600' : ''} />
                <span>{item.label}</span>
                {item.id === 'revision' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-accent-600 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4 border-t border-gray-200/60 pt-4">
          <button onClick={() => signOut(auth)} className="nav-item text-gray-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={18} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-gray-900/40 z-30 lg:hidden "></div>}

      {/* ======================== MAIN CONTENT ======================== */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 py-3 px-5 lg:px-8 flex items-center justify-between gap-3 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 bg-white text-gray-400 rounded-lg hover:bg-gray-50 border border-gray-200/60 transition"
            >
              {isMobileMenuOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{activeTab !== 'dashboard' ? navItems.find(n => n.id === activeTab)?.label : ''}</p>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{tabTitles[activeTab]}</h2>
            </div>
          </div>

          {/* Location dropdown */}
          {locations.filter(l => l.isActive).length > 0 && (
            <div className="relative">
              <button
                onClick={() => setIsLocDropdownOpen(!isLocDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200/60 rounded-xl hover:border-gray-200/60 transition-all"
              >
                <MapPin size={14} className="text-accent-600" />
                <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{selectedLocName}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${isLocDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isLocDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLocDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200/60 rounded-xl shadow-sm z-50 py-1 animate-scale-in overflow-hidden">
                    <button
                      onClick={() => { setSelectedLocationId(null); setIsLocDropdownOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors flex items-center gap-2 ${selectedLocationId === null ? 'bg-accent-50 text-accent-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-800'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${selectedLocationId === null ? 'bg-accent-600' : 'bg-white'}`} />
                      Все точки
                    </button>
                    {locations.filter(l => l.isActive).map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => { setSelectedLocationId(loc.id); setIsLocDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors flex items-center gap-2 ${selectedLocationId === loc.id ? 'bg-accent-50 text-accent-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-800'}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${selectedLocationId === loc.id ? 'bg-accent-600' : 'bg-white'}`} />
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </header>

        {/* ======================== CONTENT AREA ======================== */}
        <div className="flex-1 overflow-auto p-5 lg:p-8 pb-safe">
          
          {/* ============ DASHBOARD ============ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-semibold text-gray-900">Общая статистика</h1>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60">
                  <CalendarDays className="text-gray-500" size={16}/>
                  <select value={dashboardMonth} onChange={e => setDashboardMonth(e.target.value)} className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer">
                    <option value="all">Все время</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="stat-card">
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">Фонд ЗП</p>
                  <h3 className="text-xl lg:text-2xl font-semibold text-gray-900">{formatMoney(totalSystemEarned)} <span className="text-gray-500 text-sm">₸</span></h3>
                </div>
                <div className="stat-card">
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">Кальяны</p>
                  <h3 className="text-xl lg:text-2xl font-semibold text-accent-600">{globalHookahs} <span className="text-gray-500 text-sm">шт</span></h3>
                </div>
                <div className="stat-card">
                  <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">Замены</p>
                  <h3 className="text-xl lg:text-2xl font-semibold text-accent-600">{globalReplacements} <span className="text-gray-500 text-sm">шт</span></h3>
                </div>
                <div className="stat-card border-accent-600/20 ">
                  <p className="text-accent-600 font-medium text-xs uppercase tracking-wide mb-1">% замен</p>
                  <h3 className="text-xl lg:text-2xl font-semibold text-accent-600">{replacementRate}%</h3>
                </div>
                <div className="stat-card border-amber-200 ">
                  <p className="text-amber-600 font-medium text-xs uppercase tracking-wide mb-1">Стафф</p>
                  <h3 className="text-xl lg:text-2xl font-semibold text-amber-600">{globalStaffHookahs} <span className="text-gray-500 text-sm">шт</span></h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="stat-card p-5">
                  <h2 className="text-sm font-semibold text-gray-800 mb-4">Динамика выплат ЗП</h2>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                        <YAxis hide />
                        <Tooltip contentStyle={{borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#111827'}} />
                        <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#salaryGradient)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="stat-card p-5">
                  <h2 className="text-sm font-semibold text-gray-800 mb-4">Кальяны vs Замены</h2>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: 'rgba(51,65,85,0.3)'}} contentStyle={{borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#111827'}} />
                        <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', paddingTop: '10px'}}/>
                        <Bar dataKey="hookahs" name="Кальяны" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="replacements" name="Замены" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Sales count chart */}
              <div className="stat-card p-5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Количество продаж</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Кальяны + замены по дням</p>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <ShoppingCart size={14} className="text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-600">{globalHookahs + globalReplacements} всего</span>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="salesCountGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dx={-5} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', color: '#111827'}}
                        formatter={(value) => [`${value} шт`, 'Продажи']}
                        labelFormatter={(label) => `Дата: ${label}`}
                      />
                      <Area type="monotone" dataKey="totalSales" name="Продажи" stroke="#10B981" strokeWidth={2} fill="url(#salesCountGradient)" dot={{r: 3, fill: '#10B981', strokeWidth: 2, stroke: '#0F172A'}} activeDot={{r: 5, fill: '#059669', strokeWidth: 2, stroke: '#0F172A'}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ============ SHIFTS ============ */}
          {activeTab === 'shifts' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200/60 w-fit scrollable-tabs">
                <button onClick={() => setSubTab('calendar')} className={`pill-tab ${subTab === 'calendar' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Календарь</button>
                <button onClick={() => setSubTab('list')} className={`pill-tab ${subTab === 'list' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Список смен</button>
              </div>

              {subTab === 'calendar' && (<div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900">Календарь смен</h1>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500"></span><span className="text-gray-500">Пт/Сб</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span><span className="text-gray-500">Вых</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-600"></span><span className="text-gray-500">Смена</span></span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60">
                    <CalendarDays className="text-gray-500" size={16}/>
                    <select 
                      value={selectedMonth === 'all' ? (availableMonths[0] || '05.2026') : selectedMonth} 
                      onChange={e => setSelectedMonth(e.target.value)} 
                      className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer"
                    >
                      {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="stat-card overflow-hidden p-0">
                {(() => {
                  const targetMonthStr = selectedMonth === 'all' ? (availableMonths[0] || '05.2026') : selectedMonth;
                  const [month, year] = targetMonthStr.split('.');
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
                  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                  const kzHolidays = {
                    '01.01': 'Новый год', '01.02': 'Новый год',
                    '01.07': 'Рождество',
                    '03.08': 'Женский день',
                    '03.21': 'Наурыз', '03.22': 'Наурыз', '03.23': 'Наурыз',
                    '05.01': 'День единства',
                    '05.07': 'День защитника',
                    '05.09': 'День Победы',
                    '07.06': 'День столицы',
                    '08.30': 'День Конституции',
                    '10.25': 'День Республики',
                    '12.01': 'День Первого Президента',
                    '12.16': 'День Независимости', '12.17': 'День Независимости'
                  };

                  const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

                  return (
                    <div>
                      <div className="px-5 pt-5 pb-3">
                        <h2 className="text-lg font-semibold text-gray-900">{monthNames[Number(month)]} {year}</h2>
                      </div>

                      <div className="grid grid-cols-7 px-4 pb-2">
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName, idx) => (
                          <div key={dayName} className={`text-center text-xs font-semibold uppercase tracking-wide py-1.5 ${
                            idx >= 4 ? 'text-violet-400' : 'text-gray-500'
                          }`}>{dayName}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-[1px] bg-gray-50 border-t border-gray-200/60">
                        {Array.from({ length: startOffset }).map((_, i) => (
                          <div key={`empty-${i}`} className="bg-white/40 min-h-[70px] lg:min-h-[100px]"></div>
                        ))}
                        {(() => {
                          const today = new Date();
                          const todayDay = today.getDate();
                          const todayMonth = today.getMonth() + 1;
                          const todayYear = today.getFullYear();
                          return daysArray.map(day => {
                          const dateStr = `${String(day).padStart(2, '0')}.${targetMonthStr}`;
                          const shiftGroup = groupedShifts.find(g => g.dateStr === dateStr);
                          const dayOfWeek = (startOffset + day - 1) % 7;
                          const isMonday = dayOfWeek === 0;
                          const isFriday = dayOfWeek === 4;
                          const isSaturday = dayOfWeek === 5;
                          const holidayKey = `${month}.${String(day).padStart(2, '0')}`;
                          const holidayName = kzHolidays[holidayKey] || null;
                          const isSpecialDay = isFriday || isSaturday || !!holidayName;

                          const isToday = day === todayDay && Number(month) === todayMonth && Number(year) === todayYear;
                          
                          return (
                            <div 
                              key={day} 
                              onClick={() => { if (shiftGroup) setSelectedEmpReport(shiftGroup); }}
                              className={`relative min-h-[70px] lg:min-h-[100px] p-1.5 lg:p-2 flex flex-col transition-all duration-200 ${
                                shiftGroup 
                                  ? 'bg-white cursor-pointer hover:bg-white group' 
                                  : isMonday && !shiftGroup
                                    ? 'bg-red-50'
                                    : isSpecialDay
                                      ? 'bg-violet-500/5'
                                      : 'bg-white/40'
                              }`}
                            >
                              {shiftGroup?.status === 'open' && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent-600 to-cyan-400 animate-pulse z-10"></div>}
                              
                              <div className="flex items-center justify-between mb-0.5">
                                <div className={`w-5 h-5 lg:w-7 lg:h-7 flex items-center justify-center rounded-full text-xs lg:text-xs font-semibold transition-all ${
                                  isToday 
                                    ? 'bg-accent-600 text-white shadow-md shadow-accent-600/30' 
                                    : shiftGroup 
                                      ? 'text-gray-800 group-hover:bg-accent-50 group-hover:text-accent-600'
                                      : isMonday
                                        ? 'text-red-600/50'
                                        : isSpecialDay 
                                          ? 'text-violet-400'
                                          : 'text-gray-500'
                                }`}>{day}</div>
                                {holidayName && (
                                  <span className="hidden lg:inline-block text-[7px] font-bold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded-full truncate max-w-[50px]" title={holidayName}>🎉</span>
                                )}
                              </div>

                              {isMonday && !shiftGroup && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="text-red-600/10 font-semibold text-[8px] uppercase tracking-wide">Вых</span>
                                </div>
                              )}

                              {holidayName && !shiftGroup && (
                                <div className="text-[6px] lg:text-[8px] font-bold text-violet-400/70 truncate leading-tight mb-0.5" title={holidayName}>{holidayName}</div>
                              )}

                              {isSpecialDay && !shiftGroup && !holidayName && (
                                <div className="flex-1 flex items-end justify-center pb-1">
                                  <div className="w-1 h-1 rounded-full bg-violet-400/40"></div>
                                </div>
                              )}

                              {shiftGroup && (
                                <div className="flex-1 flex flex-col gap-0.5">
                                  {shiftGroup.records.map((rec, i) => (
                                    <div key={i} className={`text-[7px] lg:text-xs px-1 lg:px-1.5 py-0.5 rounded-md font-bold truncate transition-all ${
                                      i === 0 
                                        ? 'bg-accent-600/20 text-accent-600 border border-accent-600/20' 
                                        : 'bg-gray-50 text-gray-400'
                                    }`}>
                                      {rec.employeeName}
                                    </div>
                                  ))}
                                  <div className={`mt-auto pt-0.5 text-[7px] lg:text-xs font-semibold text-right ${
                                    shiftGroup.status === 'open' ? 'text-accent-600 animate-pulse' : 'text-emerald-600'
                                  }`}>
                                    {shiftGroup.status === 'open' ? '● LIVE' : `${formatMoney(shiftGroup.totalEarned)} ₸`}
                                  </div>
                                  {shiftGroup.totalStaffHookahs > 0 && (
                                    <div className="text-[6px] lg:text-[8px] text-amber-600 font-bold text-right">🔥 {shiftGroup.totalStaffHookahs}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
              </div>)}

              {subTab === 'list' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-900">Отчеты по сменам</h1>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        const filteredShifts = groupedShifts.filter(g => selectedMonth === 'all' || g.dateStr.endsWith(`.${selectedMonth}`));
                        const data = filteredShifts.map(group => ({ 'Дата': group.dateStr, 'Статус': group.status === 'open' ? 'Идет смена' : 'Закрыта', 'Мастера': group.records.map(r => r.employeeName).join(', '), 'Кальяны/Замены (шт)': group.totalItems, 'Общая ЗП за смену (₸)': group.totalEarned }));
                        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Смены"); XLSX.writeFile(wb, `Смены_${selectedMonth}.xlsx`);
                      }} className="px-3 py-2 bg-emerald-500/15 text-emerald-600 font-bold text-xs rounded-lg border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors">Скачать .xlsx</button>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60">
                        <CalendarDays className="text-gray-500" size={16}/>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer">
                          <option value="all">Все время</option>
                          {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedShifts.filter(g => selectedMonth === 'all' || g.dateStr.endsWith(`.${selectedMonth}`)).map(group => (
                      <div key={group.dateStr} className="stat-card p-5 cursor-pointer relative overflow-hidden hover:border-accent-600/30" onClick={() => setSelectedEmpReport(group)}>
                        {group.status === 'open' && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent-600 to-cyan-400 animate-pulse"></div>}
                        <div className="flex justify-between items-start mb-3">
                          <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-0.5">Смена</p><h3 className="text-lg font-semibold text-gray-900">{group.dateStr}</h3></div>
                          {group.status === 'open' ? <Badge variant="primary" className="animate-pulse">Live</Badge> : <Badge variant="success">Закрыта</Badge>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400 font-medium border-b border-gray-200/60 pb-2">Мастера: <span className="font-medium text-gray-700">{group.records.map(r => r.employeeName).join(', ')}</span></p>
                          <div className="flex justify-between items-center text-xs"><span className="text-gray-500">Кальяны/Замены:</span><span className="font-medium text-gray-700">{group.totalItems} шт</span></div>
                          {group.totalStaffHookahs > 0 && <div className="flex justify-between items-center text-xs"><span className="text-gray-500 flex items-center gap-1">Стафф:</span><span className="font-bold text-amber-600">{group.totalStaffHookahs} шт</span></div>}
                          <div className="flex justify-between items-center text-xs"><span className="text-gray-500">ЗП за смену:</span><span className="font-bold text-accent-600">{formatMoney(group.totalEarned)} ₸</span></div>
                        </div>
                      </div>
                    ))}
                    {groupedShifts.filter(g => selectedMonth === 'all' || g.dateStr.endsWith(`.${selectedMonth}`)).length === 0 && (
                      <div className="col-span-full py-16 text-center text-gray-500">Нет отчетов за выбранный месяц</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ FINANCES ============ */}
          {activeTab === 'finances' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200/60 w-fit scrollable-tabs">
                <button onClick={() => setSubTab('salaries')} className={`pill-tab ${subTab === 'salaries' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Зарплаты</button>
                <button onClick={() => setSubTab('profit')} className={`pill-tab ${subTab === 'profit' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Моя прибыль</button>
                <button onClick={() => setSubTab('purchases')} className={`pill-tab ${subTab === 'purchases' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Закупы</button>
              </div>

              {subTab === 'profit' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-900">Финансовый отчет</h1>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60">
                      <CalendarDays className="text-gray-500" size={16}/>
                      <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer">
                        <option value="all">За все время</option>
                        {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 bg-gradient-to-br from-emerald-600/90 to-emerald-800/90 p-6 rounded-2xl border border-emerald-500/20 shadow-sm-500/10 relative overflow-hidden">
                      <Wallet className="absolute right-3 top-3 opacity-10" size={60}/>
                      <div className="flex flex-col sm:flex-row gap-6 justify-between relative z-10">
                        <div>
                          <p className="font-medium text-xs uppercase tracking-wide mb-1 text-emerald-200/70">Чистая прибыль</p>
                          <h3 className="text-3xl font-semibold text-white">{formatMoney(monthlyStats.netProfit)} ₸</h3>
                          <p className="text-xs text-emerald-200/60 mt-1">Вычеты: ЗП ({formatMoney(monthlyStats.earned)} ₸)</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-xs uppercase tracking-wide mb-0.5 text-emerald-200/70">Грязная прибыль</p>
                          <h4 className="text-xl font-semibold text-white">{formatMoney(monthlyStats.ownerProfit)} ₸</h4>
                          <p className="font-medium text-xs uppercase tracking-wide mb-0.5 text-emerald-200/50 mt-3">Без ЗП Tamerlan</p>
                          <h4 className="text-lg font-semibold text-white/80">{formatMoney(monthlyStats.profitWithoutTamerlan)} ₸</h4>
                        </div>
                      </div>
                    </div>
                    
                    <div className="stat-card flex flex-col justify-center">
                      <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">С кальянов</p>
                      <h3 className="text-xl font-semibold text-accent-600">{formatMoney(monthlyStats.hookahProfit)} ₸</h3>
                      <p className="text-gray-500 text-xs mt-1">{monthlyStats.hookahs} шт (Индивидуально)</p>
                    </div>

                    <div className="stat-card flex flex-col justify-center">
                      <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">С замен</p>
                      <h3 className="text-xl font-semibold text-accent-600">{formatMoney(monthlyStats.replacementProfit)} ₸</h3>
                      <p className="text-gray-500 text-xs mt-1">{monthlyStats.replacements} шт (Индивидуально)</p>
                    </div>
                  </div>

                  <div className="stat-card overflow-hidden p-0">
                    <div className="p-5 border-b border-gray-200/60">
                      <h2 className="text-sm font-semibold text-gray-900">Прибыль по мастерам</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Сотрудник</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Кальяны</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Замены</th>
                            <th className="p-4 text-right text-xs font-semibold text-emerald-500 uppercase">Принес прибыли</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profitByMaster.map(emp => (
                            <tr key={emp.id} className="hover:bg-white/10 transition-colors">
                              <td className="p-4 font-medium text-gray-700">{emp.name}</td>
                              <td className="p-4 text-gray-400 font-medium">{emp.hookahs} шт.</td>
                              <td className="p-4 text-gray-400 font-medium">{emp.replacements} шт.</td>
                              <td className="p-4 text-right text-base font-semibold text-emerald-600">{formatMoney(emp.ownerNetProfit)} ₸</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'salaries' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900">Зарплаты сотрудников</h1>
                <div className="flex items-center gap-2">
                  <button onClick={() => { const data = employees.map(emp => { const stats = calculateEmployeeStats(emp.id, selectedMonth); return { 'Сотрудник': emp.name, 'Смен': stats.shiftsCount, 'Кальянов': stats.hookahs, 'Замен': stats.replacements, 'Оклад': stats.baseSalaryTotal, '%': stats.hookahPercentageTotal, 'ЗП': stats.totalEarned }; }); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Зарплаты"); XLSX.writeFile(wb, `Зарплаты_${selectedMonth}.xlsx`); }} className="px-3 py-2 bg-emerald-500/15 text-emerald-600 font-bold text-xs rounded-lg border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors">Скачать .xlsx</button>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60"><CalendarDays className="text-gray-500" size={16}/><select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer"><option value="all">Все время</option>{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map(emp => { const stats = calculateEmployeeStats(emp.id, selectedMonth); return (
                  <div key={emp.id} className="stat-card p-5 relative flex flex-col h-full">
                    {stats.hasOpenShift && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent-600 to-cyan-400 animate-pulse rounded-t-2xl"></div>}
                    <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-gradient-to-br from-accent-600/30 to-cyan-500/30 rounded-xl flex items-center justify-center text-accent-600 font-semibold text-lg border border-accent-600/20">{emp.name.charAt(0).toUpperCase()}</div><div><h3 className="text-base font-semibold text-gray-900">{emp.name}</h3><p className="text-xs text-gray-500 font-medium">{stats.shiftsCount} смен</p></div></div>
                    <div className="bg-gray-50 p-4 rounded-xl mb-4 flex-1 flex flex-col justify-center border border-gray-200/60">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-0.5">Общая ЗП</p>
                      <h4 className="text-2xl font-semibold text-emerald-600">{formatMoney(stats.totalEarned)} ₸</h4>
                      <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-gray-200/60 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">Оклад:</span> <strong className="text-gray-800">{formatMoney(stats.baseSalaryTotal)} ₸</strong></div>
                        <div className="flex justify-between"><span className="text-gray-500">% с кальянов:</span> <strong className="text-gray-800">{formatMoney(stats.hookahPercentageTotal)} ₸</strong></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-gray-50 border border-gray-200/60 p-2 rounded-xl"><p className="text-xs text-gray-500 uppercase font-bold mb-0.5">Кальянов</p><p className="font-semibold text-gray-800 text-lg">{stats.hookahs}</p></div>
                      <div className="bg-gray-50 border border-gray-200/60 p-2 rounded-xl"><p className="text-xs text-gray-500 uppercase font-bold mb-0.5">Замен</p><p className="font-semibold text-gray-800 text-lg">{stats.replacements}</p></div>
                    </div>
                  </div>); })}
              </div>
            </div>
              )}

              {subTab === 'purchases' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-900">Закупы</h1>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200/60">
                      <CalendarDays className="text-gray-500" size={16}/>
                      <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent font-medium text-sm text-gray-700 focus:outline-none cursor-pointer">
                        <option value="all">Все время</option>
                        {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const isAll = selectedMonth === 'all';
                    const filteredPurchases = invMovements.filter(m => m.type === 'in' && (isAll || (m.dateStr && m.dateStr.endsWith(`.${selectedMonth}`))));
                    const totalPurchases = filteredPurchases.reduce((a, b) => a + (b.cost || 0), 0);
                    const itemLabels = { coal: 'Уголь', tobacco: 'Табак', mouthpiece: 'Мундштуки' };

                    const byItem = {};
                    filteredPurchases.forEach(p => {
                      const key = p.item || 'other';
                      if (!byItem[key]) byItem[key] = { total: 0, count: 0 };
                      byItem[key].total += (p.cost || 0);
                      byItem[key].count += 1;
                    });

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-red-600/80 to-red-800/80 p-6 rounded-2xl border border-red-200 shadow-sm-500/10 relative overflow-hidden">
                            <ShoppingCart className="absolute right-3 top-3 opacity-10" size={50}/>
                            <p className="font-medium text-xs uppercase tracking-wide mb-1 text-red-200/70">Общая сумма закупов</p>
                            <h3 className="text-3xl font-semibold text-white">{formatMoney(totalPurchases)} ₸</h3>
                            <p className="text-xs text-red-200/60 mt-1">{filteredPurchases.length} приходов</p>
                          </div>
                          {Object.entries(byItem).map(([item, data]) => (
                            <div key={item} className="stat-card flex flex-col justify-center">
                              <p className="text-gray-500 font-medium text-xs uppercase tracking-wide mb-1">{itemLabels[item] || item}</p>
                              <h3 className="text-xl font-semibold text-gray-900">{formatMoney(data.total)} ₸</h3>
                              <p className="text-gray-500 text-xs mt-1">{data.count} приходов</p>
                            </div>
                          ))}
                        </div>

                        <div className="stat-card overflow-hidden p-0">
                          <div className="p-5 border-b border-gray-200/60">
                            <h2 className="text-sm font-semibold text-gray-900">Все закупы</h2>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px]">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Дата</th>
                                  <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Товар</th>
                                  <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Кол-во</th>
                                  <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase">Заметка</th>
                                  <th className="p-4 text-right text-xs font-semibold text-red-600 uppercase">Сумма</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredPurchases.length === 0 && (
                                  <tr><td colSpan="5" className="p-8 text-center text-gray-500">Нет закупов за выбранный период</td></tr>
                                )}
                                {filteredPurchases.map(p => (
                                  <tr key={p.id} className="hover:bg-white/10 transition-colors">
                                    <td className="p-4 font-medium text-gray-400">{p.dateStr || '—'}</td>
                                    <td className="p-4 font-medium text-gray-700">{itemLabels[p.item] || p.item || '—'}</td>
                                    <td className="p-4 text-gray-400">{p.amount || 0}</td>
                                    <td className="p-4 text-gray-500 text-xs">{p.note || '—'}</td>
                                    <td className="p-4 text-right font-semibold text-red-600">{formatMoney(p.cost || 0)} ₸</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ============ INVENTORY ============ */}
          {activeTab === 'inventory' && (() => {
            const allClosedShifts = selectedLocationId
              ? allShifts.filter(s => s.status === 'closed' && s.locationId === selectedLocationId)
              : allShifts.filter(s => s.status === 'closed');
            const totalBowls = allClosedShifts.reduce((a, s) => a + (s.items?.cocktail1 || 0) + (s.items?.cocktail2 || 0) + (s.staffHookahs || 0), 0);
            const autoCoalUsed = totalBowls * invStandards.coalPerBowl;
            const autoTobaccoUsed = totalBowls * (invStandards.tobaccoPerBowl || 0);
            const autoMouthpieceUsed = totalBowls * (invStandards.mouthpiecePerBowl || 0);

            const locMovements = selectedLocationId
              ? invMovements.filter(m => m.locationId === selectedLocationId)
              : invMovements;

            const coalIn = locMovements.filter(m => m.item === 'coal' && m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0);
            const tobaccoIn = locMovements.filter(m => m.item === 'tobacco' && m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0);
            const mouthpieceIn = locMovements.filter(m => m.item === 'mouthpiece' && m.type === 'in').reduce((a, m) => a + (m.amount || 0), 0);

            const coalWriteoff = locMovements.filter(m => m.item === 'coal' && m.type === 'writeoff').reduce((a, m) => a + (m.amount || 0), 0);
            const tobaccoWriteoff = locMovements.filter(m => m.item === 'tobacco' && m.type === 'writeoff').reduce((a, m) => a + (m.amount || 0), 0);
            const mouthpieceWriteoff = locMovements.filter(m => m.item === 'mouthpiece' && m.type === 'writeoff').reduce((a, m) => a + (m.amount || 0), 0);

            const coalStock = coalIn - autoCoalUsed - coalWriteoff;
            const tobaccoCorrection = locMovements.filter(m => m.item === 'tobacco' && m.type === 'correction').reduce((a, m) => a + (m.amount || 0), 0);
            const tobaccoStock = tobaccoIn + tobaccoCorrection - autoTobaccoUsed - tobaccoWriteoff;
            const mouthpieceStock = mouthpieceIn - autoMouthpieceUsed - mouthpieceWriteoff;

            const handleInvSubmit = async (e) => {
              e.preventDefault();
              if (!invForm.amount || Number(invForm.amount) <= 0) return alert('Укажите количество');
              setIsSavingInv(true);
              try {
                const now = new Date();
                await addDoc(collection(db, 'inventory_movements'), {
                  type: invForm.type, item: invForm.item,
                  amount: Number(invForm.amount), 
                  cost: invForm.type === 'in' ? Number(invForm.cost || 0) : 0,
                  note: invForm.note || '',
                  dateStr: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`,
                  createdAt: serverTimestamp()
                });
                setInvForm({ type: 'in', item: 'coal', amount: '', cost: '', note: '', templateId: '' });
              } catch (err) { alert('Ошибка: ' + err.message); }
              finally { setIsSavingInv(false); }
            };

            const addToCart = (template) => {
              setInvCart(prev => {
                const existing = prev.find(x => x.templateId === template.id);
                if (existing) {
                  return prev.map(x => x.templateId === template.id ? { ...x, quantity: x.quantity + 1 } : x);
                }
                return [...prev, {
                  id: Date.now() + Math.random(),
                  templateId: template.id,
                  name: template.name,
                  item: template.item,
                  amountPerUnit: Number(template.amount),
                  pricePerUnit: Number(template.price || 0),
                  quantity: 1
                }];
              });
            };

            const removeFromCart = (id) => setInvCart(prev => prev.filter(x => x.id !== id));
            const updateCartItem = (id, field, value) => {
              setInvCart(prev => prev.map(x => x.id === id ? { ...x, [field]: value } : x));
            };

            const handleCartSubmit = async () => {
              if (invCart.length === 0) return;
              const targetLoc = selectedLocationId || cartLocationId;
              if (!targetLoc) return alert('Выберите заведение для прихода товара');
              setIsSavingInv(true);
              try {
                const now = new Date();
                const dateStr = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
                await Promise.all(invCart.map(item =>
                  addDoc(collection(db, 'inventory_movements'), {
                    type: 'in',
                    item: item.item,
                    amount: item.amountPerUnit * item.quantity,
                    cost: item.pricePerUnit * item.quantity,
                    templateName: item.name,
                    templateId: item.templateId,
                    note: '',
                    dateStr,
                    createdAt: serverTimestamp(),
                    locationId: targetLoc
                  })
                ));
                setInvCart([]);
                setCartLocationId('');
                alert('Приход сохранён!');
              } catch (err) { alert('Ошибка: ' + err.message); }
              finally { setIsSavingInv(false); }
            };



            const handleTemplateSubmit = async (e) => {
              e.preventDefault();
              if (!newTemplate.name || !newTemplate.amount) return;
              setIsSavingInv(true);
              try {
                await addDoc(collection(db, 'inventory_templates'), {
                  ...newTemplate,
                  amount: Number(newTemplate.amount),
                  price: Number(newTemplate.price || 0),
                  createdAt: serverTimestamp()
                });
                setNewTemplate({ name: '', item: 'tobacco', amount: '', price: '' });
              } catch (err) { alert('Ошибка: ' + err.message); }
              finally { setIsSavingInv(false); }
            };

            return (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200/60 w-fit scrollable-tabs">
                <button onClick={() => setSubTab('stock')} className={`pill-tab ${subTab === 'stock' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Остатки</button>
                <button onClick={() => setSubTab('incoming')} className={`pill-tab ${subTab === 'incoming' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Приход</button>
                <button onClick={() => setSubTab('templates')} className={`pill-tab ${subTab === 'templates' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Шаблоны</button>
                <button onClick={() => setSubTab('writeoff')} className={`pill-tab ${subTab === 'writeoff' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Списание</button>
                                              </div>

              {subTab === 'stock' && (
                <div className="space-y-4">
                  <h1 className="text-xl font-bold text-gray-900">Текущие остатки</h1>
                  <div className="bg-gradient-to-br from-accent-600/80 to-cyan-600/80 p-5 rounded-2xl border border-accent-600/20 shadow-sm">
                    <p className="font-medium text-xs uppercase tracking-wide mb-1 text-blue-200/70">Хватит примерно на</p>
                    <h3 className="text-3xl font-semibold text-white">≈ {Math.max(0, Math.floor(Math.min(coalStock / invStandards.coalPerBowl, tobaccoStock / invStandards.tobaccoPerBowl)))} чаш</h3>
                    <p className="text-xs text-gray-400 mt-1">{invStandards.coalPerBowl} углей + {invStandards.tobaccoPerBowl}г табака на чашу</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Уголь', icon: '🔥', stock: coalStock, unit: 'шт', inVal: coalIn, used: autoCoalUsed, writeoff: coalWriteoff, bowlStd: invStandards.coalPerBowl, color: 'amber' },
                      { label: 'Табак', icon: '🍃', stock: tobaccoStock, unit: 'г', inVal: tobaccoIn, used: autoTobaccoUsed, writeoff: tobaccoWriteoff, bowlStd: invStandards.tobaccoPerBowl, color: 'emerald' },
                      { label: 'Мундштуки', icon: '💠', stock: mouthpieceStock, unit: 'шт', inVal: mouthpieceIn, used: autoMouthpieceUsed, writeoff: mouthpieceWriteoff, bowlStd: invStandards.mouthpiecePerBowl, color: 'cyan' },
                    ].map(item => (
                      <div key={item.label} className="stat-card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">{item.label}</p>
                            <h3 className="text-2xl font-semibold text-gray-900">{formatMoney(Math.round(item.stock))} {item.unit}</h3>
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl space-y-1.5 text-xs border border-gray-200/60">
                          <div className="flex justify-between"><span className="text-gray-500">Приход:</span><strong className="text-emerald-600">+{formatMoney(item.inVal)} {item.unit}</strong></div>
                          <div className="flex justify-between"><span className="text-gray-500">Расход ({totalBowls} чаш × {item.bowlStd}):</span><strong className="text-red-600">-{formatMoney(item.used)} {item.unit}</strong></div>
                          <div className="flex justify-between"><span className="text-gray-500">Списано:</span><strong className="text-amber-600">-{formatMoney(item.writeoff)} {item.unit}</strong></div>
                        </div>
                        <div className="mt-2 px-3 py-1.5 bg-accent-50 rounded-lg border border-accent-600/15 text-center">
                          <span className="text-accent-600 font-semibold text-xs">≈ {Math.max(0, Math.floor(item.stock / item.bowlStd))} чаш</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subTab === 'incoming' && (
                <div className="space-y-6">
                  <h1 className="text-xl font-bold text-gray-900">Приход товара</h1>
                  
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Выбери шаблон для добавления</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {invTemplates.length === 0 && <p className="text-sm text-gray-500 col-span-full">Нет шаблонов. Создай их во вкладке «Шаблоны».</p>}
                      {invTemplates.map(t => {
                        const pricePerGram = (t.item === 'tobacco' && t.amount > 0 && t.price > 0) ? (t.price / t.amount).toFixed(1) : null;
                        return (
                        <button 
                          key={t.id} 
                          onClick={() => addToCart(t)}
                          className="bg-white p-3 rounded-xl border border-gray-200/60 hover:border-accent-600/40 transition-all text-left flex flex-col gap-1.5 group active:scale-95"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xl group-hover:scale-110 transition-transform">{t.item === 'coal' ? '🔥' : t.item === 'tobacco' ? '🍃' : '💠'}</span>
                            <Plus size={14} className="text-gray-500 group-hover:text-accent-600 transition-colors" />
                          </div>
                          <p className="font-semibold text-gray-800 text-xs line-clamp-2">{t.name}</p>
                          <p className="text-xs font-medium text-gray-500 uppercase">{t.amount} {t.item === 'coal' || t.item === 'mouthpiece' ? 'шт' : 'г'}</p>
                          {t.price > 0 && <p className="text-xs font-bold text-accent-600">{formatMoney(t.price)} ₸</p>}
                          {pricePerGram && <p className="text-[8px] font-bold text-accent-600">{pricePerGram} ₸/г</p>}
                        </button>
                      );})}
                    </div>
                  </div>

                  {invCart.length > 0 && (
                    <div className="stat-card border-accent-600/20 overflow-hidden p-0 animate-scale-in">
                      <div className="bg-accent-600/5 p-4 border-b border-accent-600/10 flex justify-between items-center">
                        <div>
                          <h2 className="text-sm font-semibold text-accent-600 flex items-center gap-2"><ShoppingCart size={16}/> Корзина</h2>
                          <p className="text-xs text-gray-500 font-medium">Проверь перед сохранением</p>
                        </div>
                        <button onClick={() => setInvCart([])} className="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">Очистить</button>
                      </div>
                      
                      <div className="divide-y divide-slate-100">
                        {invCart.map((item) => {
                          const pricePerGram = (item.item === 'tobacco' && item.amountPerUnit > 0 && item.pricePerUnit > 0) ? (item.pricePerUnit / item.amountPerUnit).toFixed(1) : null;
                          return (
                          <div key={item.id} className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-base">{item.item === 'coal' ? '🔥' : item.item === 'tobacco' ? '🍃' : '💠'}</span>
                                <h4 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h4>
                              </div>
                              <p className="text-xs text-gray-500 font-medium">{item.amountPerUnit} {item.item === 'coal' || item.item === 'mouthpiece' ? 'шт' : 'г'} / ед. {pricePerGram && <span className="text-accent-600">• {pricePerGram} ₸/г</span>}</p>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 items-center">
                              <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-200/60">
                                <button onClick={() => updateCartItem(item.id, 'quantity', Math.max(1, item.quantity - 1))} className="w-7 h-7 flex items-center justify-center bg-white rounded-md text-gray-400 hover:bg-gray-50 transition-colors font-bold text-sm">−</button>
                                <span className="w-7 text-center font-semibold text-gray-800 text-sm">{item.quantity}</span>
                                <button onClick={() => updateCartItem(item.id, 'quantity', item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-md text-gray-400 hover:bg-gray-50 transition-colors font-bold text-sm">+</button>
                              </div>

                              <div className="text-right min-w-[60px]">
                                <p className="font-semibold text-accent-600 text-sm">{formatMoney(item.pricePerUnit * item.quantity)} ₸</p>
                              </div>

                              <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"><Trash2 size={15}/></button>
                            </div>
                          </div>
                        );})}
                      </div>

                      <div className="bg-white/10 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-gray-200/60">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
                          <div>
                            <p className="text-gray-500 font-medium text-xs">Итого:</p>
                            <h3 className="text-xl font-semibold text-gray-900">{formatMoney(invCart.reduce((a,b) => a + (b.pricePerUnit * b.quantity), 0))} ₸</h3>
                          </div>
                          {selectedLocationId ? (
                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200/60">
                              <span className="text-xs font-medium text-gray-500 uppercase block">Точка</span>
                              <span className="font-medium text-gray-700 text-xs">{locations.find(l => l.id === selectedLocationId)?.name}</span>
                            </div>
                          ) : (
                            <div className="w-full sm:w-auto">
                              <select value={cartLocationId} onChange={e => setCartLocationId(e.target.value)} className="input-flat text-xs p-2.5" required>
                                <option value="">— Точка —</option>
                                {locations.filter(l => l.isActive).map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                              </select>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={handleCartSubmit} 
                          disabled={isSavingInv || (!selectedLocationId && !cartLocationId)}
                          className="w-full sm:w-auto px-6 py-2.5 bg-accent-600 text-white rounded-xl font-bold text-sm shadow-sm hover:scale-105 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {isSavingInv ? 'Сохранение...' : <><CheckCircle2 size={16}/> Сохранить</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* История приходов */}
                  <div className="stat-card overflow-hidden p-0">
                    <div className="p-4 border-b border-gray-200/60"><h2 className="text-sm font-semibold text-gray-900">История приходов</h2></div>
                    <div className="divide-y divide-white/10 max-h-[350px] overflow-y-auto">
                      {invMovements.filter(m => m.type === 'in').length === 0 && <div className="p-5 text-center text-gray-500 text-sm">Нет записей</div>}
                      {invMovements.filter(m => m.type === 'in').map(m => (
                        <div key={m.id} className="p-3 flex justify-between items-center hover:bg-white/10 transition-colors">
                          <div>
                            <p className="font-medium text-gray-700 text-sm">
                              {m.templateName || (m.item === 'coal' ? 'Уголь' : m.item === 'tobacco' ? 'Табак' : 'Мундштуки')} 
                              <span className="text-emerald-600"> +{formatMoney(m.amount)} {m.item === 'coal' || m.item === 'mouthpiece' ? 'шт' : 'г'}</span>
                            </p>
                            <div className="flex gap-2 items-center mt-0.5">
                              {m.cost > 0 && <span className="text-xs font-semibold text-accent-600 bg-accent-50 px-1.5 py-0.5 rounded-md">{formatMoney(m.cost)} ₸</span>}
                              {m.note && <p className="text-xs text-gray-500">{m.note}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{m.dateStr}</span><button onClick={() => deleteDoc(doc(db, 'inventory_movements', m.id))} className="text-gray-600 hover:text-red-600 transition-colors"><Trash2 size={14}/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'templates' && (
                <div className="space-y-4">
                  <h1 className="text-xl font-bold text-gray-900">Шаблоны закупа</h1>
                  <div className="stat-card p-6 max-w-xl">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Создать шаблон</h2>
                    <form onSubmit={handleTemplateSubmit} className="space-y-4">
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Название</label><input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="Например: Hell 200гр" className="input-flat" required /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Тип</label><select value={newTemplate.item} onChange={e => setNewTemplate({...newTemplate, item: e.target.value})} className="input-flat">
                          <option value="tobacco">Табак</option><option value="coal">Уголь</option><option value="mouthpiece">Мундштуки</option></select></div>
                        <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Кол-во (г/шт)</label><input type="number" min="1" value={newTemplate.amount} onChange={e => setNewTemplate({...newTemplate, amount: e.target.value})} placeholder="200" className="input-flat" required /></div>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Цена закупа (₸)</label><input type="number" min="0" value={newTemplate.price} onChange={e => setNewTemplate({...newTemplate, price: e.target.value})} placeholder="5000" className="input-flat" /></div>
                      {newTemplate.item === 'tobacco' && newTemplate.amount > 0 && newTemplate.price > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-accent-50 rounded-lg border border-blue-600/15">
                          <Calculator size={14} className="text-accent-600" />
                          <span className="text-xs text-gray-500 font-bold">₸/г:</span>
                          <span className="font-semibold text-accent-600 text-sm">{(Number(newTemplate.price) / Number(newTemplate.amount)).toFixed(2)} ₸</span>
                        </div>
                      )}
                      <button type="submit" disabled={isSavingInv} className="w-full p-3 bg-accent-600 text-white rounded-xl font-bold shadow-sm disabled:opacity-40 text-sm">Создать шаблон</button>
                    </form>
                  </div>
                  <div className="stat-card overflow-hidden p-0">
                    <div className="p-4 border-b border-gray-200/60"><h2 className="text-sm font-semibold text-gray-900">Мои шаблоны</h2></div>
                    <div className="divide-y divide-white/10">
                      {invTemplates.length === 0 && <div className="p-5 text-center text-gray-500 text-sm">Шаблонов пока нет</div>}
                      {invTemplates.map(t => {
                        const ppg = (t.item === 'tobacco' && t.amount > 0 && t.price > 0) ? (t.price / t.amount).toFixed(2) : null;
                        return (
                        <div key={t.id} className="p-3 flex justify-between items-center hover:bg-white/10 transition-colors">
                          <div>
                            <p className="font-medium text-gray-700 text-sm">{t.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t.item === 'coal' ? 'Уголь' : t.item === 'tobacco' ? 'Табак' : 'Мундштуки'} — {t.amount} {t.item === 'coal' || t.item === 'mouthpiece' ? 'шт' : 'г'}
                              {t.price > 0 ? ` • ${formatMoney(t.price)} ₸` : ''}
                              {ppg && <span className="text-accent-600 ml-1">• {ppg} ₸/г</span>}
                            </p>
                          </div>
                          <button onClick={() => deleteDoc(doc(db, 'inventory_templates', t.id))} className="text-gray-600 hover:text-red-600 transition-colors"><Trash2 size={15}/></button>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'writeoff' && (
                <div className="space-y-4">
                  <h1 className="text-xl font-bold text-gray-900">Списание</h1>
                  <div className="stat-card p-6 max-w-xl">
                    <form onSubmit={async (e) => { 
                      e.preventDefault(); 
                      if (!invForm.amount || Number(invForm.amount) <= 0) return alert('Укажите количество'); 
                      const targetLoc = selectedLocationId || writeoffLocationId;
                      if (!targetLoc) return alert('Выберите заведение для списания');
                      setIsSavingInv(true); 
                      try { 
                        const now = new Date(); 
                        await addDoc(collection(db, 'inventory_movements'), { 
                          type: 'writeoff', item: invForm.item, amount: Number(invForm.amount), cost: 0, note: invForm.note || '', 
                          dateStr: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`, 
                          createdAt: serverTimestamp(), locationId: targetLoc
                        }); 
                        setInvForm({ type: 'in', item: 'coal', amount: '', cost: '', note: '', templateId: '' }); 
                        setWriteoffLocationId('');
                        alert('Списание успешно!');
                      } catch (err) { alert('Ошибка: ' + err.message); } 
                      finally { setIsSavingInv(false); } 
                    }} className="space-y-4">
                      {selectedLocationId ? (
                        <div className="bg-gray-50 p-3 rounded-xl"><span className="text-xs text-gray-500 font-bold uppercase block mb-0.5">Заведение</span><span className="font-medium text-gray-700 text-sm">{locations.find(l => l.id === selectedLocationId)?.name}</span></div>
                      ) : (
                        <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Заведение</label><select value={writeoffLocationId} onChange={e => setWriteoffLocationId(e.target.value)} className="input-flat" required><option value="">— Точка —</option>{locations.filter(l => l.isActive).map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}</select></div>
                      )}
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Товар</label><select value={invForm.item} onChange={e => setInvForm({...invForm, item: e.target.value})} className="input-flat"><option value="coal">Уголь (шт)</option><option value="tobacco">Табак (г)</option><option value="mouthpiece">Мундштуки (шт)</option></select></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Количество</label><input type="number" min="1" value={invForm.amount} onChange={e => setInvForm({...invForm, amount: e.target.value})} placeholder="Сколько списать" className="input-flat" required /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Причина</label><input type="text" value={invForm.note} onChange={e => setInvForm({...invForm, note: e.target.value})} placeholder="Напр: отправил на вторую точку" className="input-flat" /></div>
                      <button type="submit" disabled={isSavingInv} className="w-full p-3 bg-amber-500/80 text-white rounded-xl font-bold shadow-sm-500/10 disabled:opacity-40 text-sm">{isSavingInv ? 'Сохранение...' : 'Списать'}</button>
                    </form>
                  </div>
                  <div className="stat-card overflow-hidden p-0">
                    <div className="p-4 border-b border-gray-200/60"><h2 className="text-sm font-semibold text-gray-900">История списаний</h2></div>
                    <div className="divide-y divide-white/10">
                      {invMovements.filter(m => m.type === 'writeoff' && (!selectedLocationId || m.locationId === selectedLocationId)).length === 0 && <div className="p-5 text-center text-gray-500 text-sm">Нет записей</div>}
                      {invMovements.filter(m => m.type === 'writeoff' && (!selectedLocationId || m.locationId === selectedLocationId)).map(m => (
                        <div key={m.id} className="p-3 flex justify-between items-center hover:bg-white/10 transition-colors">
                          <div><p className="font-medium text-gray-700 text-sm">{m.item === 'coal' ? 'Уголь' : m.item === 'tobacco' ? 'Табак' : 'Мундштуки'} <span className="text-amber-600">-{formatMoney(m.amount)} {m.item === 'coal' || m.item === 'mouthpiece' ? 'шт' : 'г'}</span></p>{m.note && <p className="text-xs text-gray-500 mt-0.5">{m.note}</p>}</div>
                          <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{m.dateStr}</span><button onClick={() => deleteDoc(doc(db, 'inventory_movements', m.id))} className="text-gray-600 hover:text-red-600 transition-colors"><Trash2 size={14}/></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}



            </div>);
          })()}

          {/* ============ REVISION (SEPARATE TAB) ============ */}
          {activeTab === 'revision' && (
            <RevisionTab 
              locations={locations} 
              allShifts={allShifts}
              locationId={selectedLocationId}
              allTobaccoSorts={invTemplates.filter(t => t.item === 'tobacco').map(t => ({ id: t.id, name: t.name, pricePerGram: (t.price && t.amount) ? (Number(t.price)/Number(t.amount)) : 0 }))}
            />
          )}

          {/* ============ EQUIPMENT ============ */}
          {activeTab === 'equipment' && (
            <EquipmentTab
              locations={locations}
              selectedLocationId={selectedLocationId}
              setSelectedLocationId={setSelectedLocationId}
            />
          )}

          {/* ============ SETTINGS ============ */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200/60 w-fit scrollable-tabs">
                <button onClick={() => setSubTab('employees')} className={`pill-tab ${subTab === 'employees' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Персонал</button>
                <button onClick={() => setSubTab('locations')} className={`pill-tab ${subTab === 'locations' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Локации</button>
                <button onClick={() => setSubTab('standards')} className={`pill-tab ${subTab === 'standards' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Стандарты</button>
                <button onClick={() => setSubTab('margins')} className={`pill-tab ${subTab === 'margins' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Маржинальность</button>
                <button onClick={() => setSubTab('debug')} className={`pill-tab ${subTab === 'debug' ? 'pill-tab-active' : 'pill-tab-inactive'}`}>Debug</button>
              </div>

              {subTab === 'employees' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="stat-card p-6 h-fit">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Добавить мастера</h2>
                <form onSubmit={handleAddEmployee} className="space-y-3">
                  <input type="text" value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} placeholder="Имя мастера" className="input-flat" required />
                  <div className="flex gap-2">
                    <input type="text" maxLength="4" value={newEmpPin} onChange={e=>setNewEmpPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN" className="input-flat text-center font-mono" required />
                    <button type="button" onClick={generatePin} className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:bg-gray-50 transition-colors"><Key size={18}/></button>
                  </div>
                  <div className="space-y-2 mt-3 border-t border-gray-200/60 pt-3">
                    <h3 className="text-xs font-medium text-gray-400">Ставки (₸)</h3>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Оклад</label><input type="number" min="0" value={newEmpBaseSalary} onChange={e=>setNewEmpBaseSalary(e.target.value)} className="input-flat" required /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">За кальян</label><input type="number" min="0" value={newEmpHookahBonus} onChange={e=>setNewEmpHookahBonus(e.target.value)} className="input-flat" required /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">За замену</label><input type="number" min="0" value={newEmpReplacementBonus} onChange={e=>setNewEmpReplacementBonus(e.target.value)} className="input-flat" required /></div>
                    </div>
                  </div>
                  <button type="submit" disabled={isAdding || !newEmpName || newEmpPin.length !== 4} className="w-full p-3 mt-1 bg-accent-600 text-white rounded-xl font-bold disabled:opacity-30 text-sm">Создать аккаунт</button>
                </form>
              </div>
              
              <div className="col-span-1 lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.map(emp => (
                    <div key={emp.id} className={`stat-card p-4 transition-all ${emp.isArchived ? 'opacity-50' : 'hover:border-accent-600/20'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-sm text-gray-900">{emp.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 bg-gray-50 rounded-md text-xs font-mono font-bold text-gray-500">PIN: {emp.pin}</span>
                            {emp.isArchived ? 
                              <Badge variant="default">Архив</Badge> : 
                              <Badge variant="success">Активен</Badge>
                            }
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {editingEmpId !== emp.id && !emp.isArchived && (
                            <button onClick={() => { setEditingEmpId(emp.id); setEditEmpForm({ baseSalary: emp.baseSalary || 0, bonus1: emp.bonus1 || 0, bonus2: emp.bonus2 || 0 }); }} className="p-1.5 bg-accent-50 text-accent-600 rounded-lg hover:bg-accent-600/20 transition-colors"><Edit3 size={14}/></button>
                          )}
                          {emp.isArchived ? (
                            <button onClick={() => updateDoc(doc(db, 'employees', emp.id), { isArchived: false })} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><RotateCcw size={14}/></button>
                          ) : (
                            <button onClick={() => { if (window.confirm(`Деактивировать ${emp.name}?`)) updateDoc(doc(db, 'employees', emp.id), { isArchived: true }); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
                          )}
                        </div>
                      </div>
                      
                      {editingEmpId === emp.id ? (
                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200/60 mt-2 animate-scale-in">
                          <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Оклад (₸)</label><input type="number" value={editEmpForm.baseSalary} onChange={e=>setEditEmpForm({...editEmpForm, baseSalary: e.target.value})} className="input-flat text-sm p-2.5" /></div>
                          <div className="flex gap-2">
                            <div className="flex-1"><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">За кальян</label><input type="number" value={editEmpForm.bonus1} onChange={e=>setEditEmpForm({...editEmpForm, bonus1: e.target.value})} className="input-flat text-sm p-2.5" /></div>
                            <div className="flex-1"><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">За замену</label><input type="number" value={editEmpForm.bonus2} onChange={e=>setEditEmpForm({...editEmpForm, bonus2: e.target.value})} className="input-flat text-sm p-2.5" /></div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditingEmpId(null)} className="flex-1 py-2 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">Отмена</button>
                            <button onClick={() => handleSaveEmpEdit(emp.id)} className="flex-1 py-2 bg-accent-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-accent-600-dark transition-colors">Сохранить</button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 mt-3 bg-gray-50 p-2 rounded-xl border border-gray-200/60">
                          <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Оклад</p><p className="font-semibold text-gray-800 text-xs">{formatMoney(emp.baseSalary || 0)}</p></div>
                          <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Кальян</p><p className="font-semibold text-gray-800 text-xs">{formatMoney(emp.bonus1 || 0)}</p></div>
                          <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Замена</p><p className="font-semibold text-gray-800 text-xs">{formatMoney(emp.bonus2 || 0)}</p></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
              )}

              {subTab === 'locations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="stat-card p-6 h-fit">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Добавить локацию</h2>
                <form onSubmit={handleAddLocation} className="space-y-3">
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Название</label><input type="text" value={newLocName} onChange={e=>setNewLocName(e.target.value)} placeholder="Напр. Основная" className="input-flat" required /></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Адрес</label><input type="text" value={newLocAddress} onChange={e=>setNewLocAddress(e.target.value)} placeholder="Напр. ул. Абая, 12" className="input-flat" /></div>
                  <div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Прибыль: Кальян</label><input type="number" min="0" value={newLocProfitHookah} onChange={e=>setNewLocProfitHookah(e.target.value)} placeholder="В тенге" className="input-flat" /></div><div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Прибыль: Замена</label><input type="number" min="0" value={newLocProfitReplacement} onChange={e=>setNewLocProfitReplacement(e.target.value)} placeholder="В тенге" className="input-flat" /></div></div>
                  <button type="submit" disabled={isAddingLoc || !newLocName} className="w-full p-3 mt-1 bg-accent-600 text-white rounded-xl font-bold disabled:opacity-30 text-sm">Добавить</button>
                </form>
              </div>
              
              <div className="col-span-1 lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {locations.map(loc => (
                    <div key={loc.id} className={`stat-card p-4 transition-all ${!loc.isActive ? 'opacity-50' : 'hover:border-accent-600/20'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-sm text-gray-900">{loc.name}</h3>
                          <p className="text-xs font-medium text-gray-500 mt-0.5">{loc.address || 'Адрес не указан'} • К: {loc.profitHookah || ownerProfits.hookah}₸ / З: {loc.profitReplacement || ownerProfits.replacement}₸</p>
                          <div className="mt-1">
                            {!loc.isActive ? <Badge variant="default">В архиве</Badge> : <Badge variant="success">Активна</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {editingLocId !== loc.id && loc.isActive && (
                            <button onClick={() => { setEditingLocId(loc.id); setEditLocForm({ name: loc.name || '', address: loc.address || '', profitHookah: loc.profitHookah || '', profitReplacement: loc.profitReplacement || '' }); }} className="p-1.5 bg-accent-50 text-accent-600 rounded-lg hover:bg-accent-600/20 transition-colors"><Edit3 size={14}/></button>
                          )}
                          {!loc.isActive ? (
                            <button onClick={() => updateDoc(doc(db, 'locations', loc.id), { isActive: true })} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><RotateCcw size={14}/></button>
                          ) : (
                            <button onClick={() => { if (window.confirm(`В архив точку ${loc.name}?`)) updateDoc(doc(db, 'locations', loc.id), { isActive: false }); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14}/></button>
                          )}
                        </div>
                      </div>
                      
                      {editingLocId === loc.id && (
                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200/60 mt-2 animate-scale-in">
                          <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Название</label><input type="text" value={editLocForm.name} onChange={e=>setEditLocForm({...editLocForm, name: e.target.value})} className="input-flat text-sm p-2.5" /></div>
                          <div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Адрес</label><input type="text" value={editLocForm.address} onChange={e=>setEditLocForm({...editLocForm, address: e.target.value})} className="input-flat text-sm p-2.5" /></div>
                          <div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Прибыль: Кальян (₸)</label><input type="number" min="0" value={editLocForm.profitHookah} onChange={e=>setEditLocForm({...editLocForm, profitHookah: Number(e.target.value)})} className="input-flat text-sm p-2.5" /></div><div><label className="block text-xs font-medium text-gray-500 uppercase mb-0.5">Прибыль: Замена (₸)</label><input type="number" min="0" value={editLocForm.profitReplacement} onChange={e=>setEditLocForm({...editLocForm, profitReplacement: Number(e.target.value)})} className="input-flat text-sm p-2.5" /></div></div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditingLocId(null)} className="flex-1 py-2 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">Отмена</button>
                            <button onClick={() => handleSaveLocEdit(loc.id)} className="flex-1 py-2 bg-accent-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-accent-600-dark transition-colors">Сохранить</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
              )}

                            {subTab === 'standards' && (
                <div className="max-w-xl space-y-4">
                  <h1 className="text-xl font-bold text-gray-900">Стандарты расхода</h1>
                  <div className="stat-card p-6">
                    <p className="text-gray-500 mb-4 text-xs">Укажи сколько ресурсов уходит на 1 чашу.</p>
                    <div className="space-y-4">
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Углей на 1 чашу (шт)</label><input type="number" min="1" value={invStandards.coalPerBowl} onChange={e => setInvStandards({...invStandards, coalPerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Табака на 1 чашу (г)</label><input type="number" min="1" value={invStandards.tobaccoPerBowl} onChange={e => setInvStandards({...invStandards, tobaccoPerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Мундштуков на 1 чашу (шт)</label><input type="number" min="0" value={invStandards.mouthpiecePerBowl} onChange={e => setInvStandards({...invStandards, mouthpiecePerBowl: Number(e.target.value)})} className="input-flat" /></div>
                      <button onClick={handleSaveStandards} disabled={isSavingInv} className="w-full p-3 bg-accent-600 text-white rounded-xl font-bold shadow-sm disabled:opacity-40 text-sm">{isSavingInv ? 'Сохранение...' : 'Сохранить стандарты'}</button>
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'margins' && (
                <div className="max-w-lg"><div className="stat-card p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">Маржинальность</h2>
                  <p className="text-gray-500 mb-5 text-xs">Укажи чистую прибыль с каждой позиции.</p>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Прибыль с 1 Кальяна (₸)</label><input type="number" value={ownerProfits.hookah} onChange={e=>setOwnerProfits({...ownerProfits, hookah: Number(e.target.value)})} className="input-flat" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Прибыль с 1 Замены (₸)</label><input type="number" value={ownerProfits.replacement} onChange={e=>setOwnerProfits({...ownerProfits, replacement: Number(e.target.value)})} className="input-flat" /></div>
                    <button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full p-3 mt-2 bg-accent-600 text-white rounded-xl font-bold shadow-sm disabled:opacity-40 text-sm">{isSavingSettings ? 'Сохранение...' : 'Сохранить настройки'}</button>
                  </div>
                </div></div>
              )}

              {subTab === 'debug' && (
            <div className="max-w-lg space-y-6">
              <div className="stat-card p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Загрузить прошлые смены</h2>
                <p className="text-gray-500 mb-4 text-xs">Добавляет прошедшую смену со всеми параметрами.</p>
                <form onSubmit={handleCreateDebugShift} className="space-y-4">
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Дата</label><input type="date" value={debugShift.dateStr} onChange={e=>setDebugShift({...debugShift, dateStr: e.target.value})} className="input-flat" required /></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Заведение</label><select value={debugShift.locationId || ''} onChange={e=>setDebugShift({...debugShift, locationId: e.target.value})} className="input-flat" required><option value="">Выберите точку</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Мастер</label><select value={debugShift.employeeId} onChange={e=>setDebugShift({...debugShift, employeeId: e.target.value})} className="input-flat" required><option value="">Выберите мастера</option>{employees.filter(e => !e.isArchived).map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Напарник</label><select value={debugShift.partnerId} onChange={e=>setDebugShift({...debugShift, partnerId: e.target.value})} className="input-flat"><option value="">Без напарника</option>{employees.filter(e => !e.isArchived && e.id !== debugShift.employeeId).map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Кальяны</label><input type="number" min="0" value={debugShift.hookahs} onChange={e=>setDebugShift({...debugShift, hookahs: Number(e.target.value)})} className="input-flat" /></div><div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Замены</label><input type="number" min="0" value={debugShift.replacements} onChange={e=>setDebugShift({...debugShift, replacements: Number(e.target.value)})} className="input-flat" /></div></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Фото (Опц.)</label><input type="file" accept="image/*" onChange={e => setDebugShiftPhoto(e.target.files[0] || null)} className="input-flat text-xs" /></div>
                  <button type="submit" disabled={isUploadingPastShift} className="w-full p-3 mt-2 bg-gray-50 text-gray-800 rounded-xl font-bold border border-gray-200/60 disabled:opacity-40 text-sm">{isUploadingPastShift ? 'Загрузка...' : 'Добавить смену'}</button>
                </form>
              </div>
              <div className="stat-card p-6 border-red-100">
                <div className="flex items-center gap-3 mb-3 text-red-600"><AlertTriangle size={24}/><h2 className="text-sm font-semibold">Опасная зона</h2></div>
                <p className="text-gray-500 mb-4 text-xs">Действия необратимы.</p>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                  <h3 className="font-bold text-red-600 text-sm mb-1">Удалить все смены</h3>
                  <p className="text-xs text-red-600/70 mb-3">Удалит все записи о сменах из базы данных.</p>
                  <button onClick={async () => { if (window.confirm('Удалить ВСЕ смены?')) { const c = window.prompt('Введите DELETE:'); if (c === 'DELETE') { try { const s = await getDocs(collection(db, 'sales')); await Promise.all(s.docs.map(d => deleteDoc(doc(db, 'sales', d.id)))); alert('Очищено.'); } catch (err) { alert('Ошибка: ' + err.message); } } } }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs border border-red-200 hover:bg-red-100 transition-colors">Дропнуть таблицу sales</button>
                </div>
              </div>
            </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============ SHIFT DETAIL MODAL ============ */}
      {selectedEmpReport && selectedEmpReport.records && (
        <div className="fixed inset-0 bg-gray-900/50  z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedEmpReport(null); setEditingShift(false); } }}>
          <div className="bg-white w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl p-5 lg:p-6 shadow-2xl animate-slide-in-bottom lg:animate-scale-in max-h-[85vh] overflow-y-auto relative pb-safe border border-gray-200/60">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-0.5">Детали смены</p>
                <h2 className="text-xl font-semibold text-gray-900">{selectedEmpReport.dateStr}</h2>
              </div>
              <div className="flex items-center gap-2">
                {selectedEmpReport.status === 'closed' && !editingShift && (
                  <button onClick={() => startEditingShift(selectedEmpReport)} className="p-2 bg-accent-50 text-accent-600 rounded-lg hover:bg-accent-600/20 transition-colors"><Edit3 size={16}/></button>
                )}
                <button onClick={() => { setSelectedEmpReport(null); setEditingShift(false); }} className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-50 transition-colors"><X size={18}/></button>
              </div>
            </div>
            
            {editingShift ? (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center gap-2">
                  <Edit3 size={16} className="text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-600">Режим редактирования</p>
                </div>

                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Кальяны</label><input type="number" min="0" value={editForm.hookahs} onChange={e => setEditForm({...editForm, hookahs: Number(e.target.value)})} className="input-flat" /></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Замены</label><input type="number" min="0" value={editForm.replacements} onChange={e => setEditForm({...editForm, replacements: Number(e.target.value)})} className="input-flat" /></div>
                  <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Напарник</label>
                    <select value={editForm.partnerId} onChange={e => setEditForm({...editForm, partnerId: e.target.value})} className="input-flat">
                      <option value="">Без напарника</option>
                      {employees.filter(e => !e.isArchived && e.id !== (selectedEmpReport.records.find(r => r.startTime) || selectedEmpReport.records[0])?.employeeId).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(() => {
                  const c1 = Number(editForm.hookahs) || 0;
                  const c2 = Number(editForm.replacements) || 0;
                  const ownerRecord = selectedEmpReport.records.find(r => r.startTime) || selectedEmpReport.records[0];
                  const ownerEmp = employees.find(e => e.id === ownerRecord.employeeId);
                  const ownerBase = ownerEmp?.baseSalary !== undefined ? ownerEmp.baseSalary : (ownerEmp?.name?.trim().toLowerCase() === 'tamerlan' ? 1500 : 3000);
                  const ownerBonus1 = ownerEmp?.bonus1 !== undefined ? ownerEmp.bonus1 : 1500;
                  const ownerBonus2 = ownerEmp?.bonus2 !== undefined ? ownerEmp.bonus2 : 1500;

                  if (editForm.partnerId) {
                    const partner = employees.find(e => e.id === editForm.partnerId);
                    const partnerBase = partner.baseSalary !== undefined ? partner.baseSalary : 1500;
                    const partnerBonus1 = partner.bonus1 !== undefined ? partner.bonus1 : 1500;
                    const partnerBonus2 = partner.bonus2 !== undefined ? partner.bonus2 : 1500;
                    const ownerC1 = Math.ceil(c1 / 2);
                    const targetOwnerTotal = Math.ceil((c1 + c2) / 2);
                    const ownerC2 = targetOwnerTotal - ownerC1;
                    const partnerC1 = c1 - ownerC1;
                    const partnerC2 = c2 - ownerC2;
                    const ownerEarned = ownerBase + (ownerC1 * ownerBonus1) + (ownerC2 * ownerBonus2);
                    const partnerEarned = partnerBase + (partnerC1 * partnerBonus1) + (partnerC2 * partnerBonus2);
                    return (
                      <div className="bg-accent-600/5 border border-accent-600/10 p-3 rounded-xl space-y-1.5">
                        <h4 className="text-xs font-bold text-accent-600 uppercase tracking-wide">Превью</h4>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">{ownerEmp?.name} ({ownerC1}к + {ownerC2}з):</span><strong className="text-accent-600">{formatMoney(ownerEarned)} ₸</strong></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">{partner?.name} ({partnerC1}к + {partnerC2}з):</span><strong className="text-accent-600">{formatMoney(partnerEarned)} ₸</strong></div>
                      </div>
                    );
                  } else {
                    const myEarned = ownerBase + (c1 * ownerBonus1) + (c2 * ownerBonus2);
                    return (
                      <div className="bg-accent-600/5 border border-accent-600/10 p-3 rounded-xl space-y-1.5">
                        <h4 className="text-xs font-bold text-accent-600 uppercase tracking-wide">Превью</h4>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">{ownerEmp?.name} ({c1}к + {c2}з):</span><strong className="text-accent-600">{formatMoney(myEarned)} ₸</strong></div>
                      </div>
                    );
                  }
                })()}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingShift(false)} className="flex-1 p-3 bg-gray-50 text-gray-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><RotateCcw size={15}/> Отмена</button>
                  <button onClick={handleSaveShiftEdit} disabled={isSavingEdit} className="flex-1 p-3 bg-accent-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-accent-600-dark transition-colors disabled:opacity-40"><Save size={15}/> {isSavingEdit ? 'Сохранение...' : 'Сохранить'}</button>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="stat-card p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Кальяны</p><p className="text-lg font-semibold text-accent-600">{selectedEmpReport.records.reduce((s,r) => s + (r.items?.cocktail1 || 0), 0)}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">Замены</p><p className="text-lg font-semibold text-accent-600">{selectedEmpReport.records.reduce((s,r) => s + (r.items?.cocktail2 || 0), 0)}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 uppercase mb-0.5">ЗП</p><p className="text-lg font-semibold text-emerald-600">{formatMoney(selectedEmpReport.totalEarned)}</p></div>
                </div>
              </div>

              {selectedEmpReport.records.map((rec, idx) => (
                <div key={idx} className="stat-card p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent-600/20 to-cyan-500/20 rounded-lg flex items-center justify-center text-accent-600 font-semibold text-sm border border-accent-600/15">{rec.employeeName?.charAt(0)?.toUpperCase()}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{rec.employeeName}</h4>
                      <p className="text-xs text-gray-500">{rec.startTime ? 'Открыл смену' : 'Напарник'}</p>
                    </div>
                    {rec.status === 'open' && <Badge variant="primary" className="ml-auto animate-pulse">Live</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg"><span className="text-gray-500">Кальяны:</span><strong className="text-gray-800">{rec.items?.cocktail1 || 0}</strong></div>
                    <div className="flex justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg"><span className="text-gray-500">Замены:</span><strong className="text-gray-800">{rec.items?.cocktail2 || 0}</strong></div>
                    <div className="flex justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg"><span className="text-gray-500">Оклад:</span><strong className="text-gray-800">{formatMoney(rec.baseSalary || 0)} ₸</strong></div>
                    <div className="flex justify-between bg-gray-50 px-2.5 py-1.5 rounded-lg"><span className="text-gray-500">%:</span><strong className="text-gray-800">{formatMoney(rec.hookahPercentage || 0)} ₸</strong></div>
                  </div>
                  <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-500/10 flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-medium">Итого:</span>
                    <span className="font-semibold text-emerald-600">{formatMoney(rec.earned || 0)} ₸</span>
                  </div>
                  {rec.photoUrl && rec.photoUrl !== 'no-photo' && (
                    <div className="mt-3">
                      <img src={rec.photoUrl} alt="Фото смены" className="w-full rounded-xl max-h-48 object-cover border border-gray-200/60" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;