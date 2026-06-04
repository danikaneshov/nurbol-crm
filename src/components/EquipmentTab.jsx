import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, RotateCcw, MapPin, Edit3 } from 'lucide-react';

const CATEGORIES = [
  { id: 'hookah', label: 'Кальян', icon: '💨', color: 'blue' },
  { id: 'accessory', label: 'Аксессуары', icon: '🔧', color: 'orange' },
  { id: 'heating', label: 'Плитка/Нагрев', icon: '🔥', color: 'red' },
  { id: 'other', label: 'Прочее', icon: '📦', color: 'slate' },
];

const STATUS_LABELS = {
  active: { label: 'Активно', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' },
  broken: { label: 'Сломано', cls: 'bg-red-500/15 text-red-400 border border-red-500/20' },
  lost: { label: 'Утеряно', cls: 'bg-slate-500/15 text-slate-400 border border-slate-500/20' },
};

const EquipmentTab = ({ locations, selectedLocationId, setSelectedLocationId }) => {
  const [equipment, setEquipment] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: '', category: 'hookah', quantity: 1, locationId: selectedLocationId || '', serialNumber: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [filterLocId, setFilterLocId] = useState(selectedLocationId || 'all');

  useEffect(() => {
    setFilterLocId(selectedLocationId || 'all');
    setForm(f => ({ ...f, locationId: selectedLocationId || '' }));
  }, [selectedLocationId]);

  useEffect(() => {
    const q = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEquipment(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const targetLocId = selectedLocationId || form.locationId;
    if (!form.name || !targetLocId) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'equipment'), {
        name: form.name.trim(),
        category: form.category,
        quantity: Number(form.quantity),
        locationId: targetLocId,
        locationName: locations.find(l => l.id === targetLocId)?.name || '',
        serialNumber: form.serialNumber.trim(),
        status: 'active',
        createdAt: serverTimestamp()
      });
      setForm({ name: '', category: 'hookah', quantity: 1, locationId: targetLocId, serialNumber: '' });
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsAdding(false); }
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'equipment', id), { status, statusUpdatedAt: serverTimestamp() });
  };

  const activeLocs = locations.filter(l => l.isActive);

  const filteredEquipment = filterLocId === 'all'
    ? equipment
    : equipment.filter(e => e.locationId === filterLocId);

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: filteredEquipment.filter(e => e.category === cat.id)
  })).filter(g => g.items.length > 0);

  // Counts
  const totalActive = filteredEquipment.filter(e => e.status === 'active').length;
  const totalBroken = filteredEquipment.filter(e => e.status === 'broken').length;
  const totalLost = filteredEquipment.filter(e => e.status === 'lost').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Оборудование</h1>
          <p className="text-xs text-slate-500 mt-0.5">Кальяны, щипцы, плитки и другой инвентарь</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/15 text-[10px] font-bold text-emerald-400">{totalActive} активно</div>
          {totalBroken > 0 && <div className="flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/15 text-[10px] font-bold text-red-400">{totalBroken} сломано</div>}
          {totalLost > 0 && <div className="flex items-center gap-1 bg-slate-500/10 px-2 py-1 rounded-lg border border-slate-500/15 text-[10px] font-bold text-slate-400">{totalLost} утеряно</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Форма добавления */}
        <div className="stat-card p-5 h-fit">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/15">
              <Plus className="text-primary" size={18} />
            </div>
            <h2 className="text-sm font-black text-slate-900">Добавить</h2>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Заведение</label>
              {selectedLocationId ? (
                <div className="input-flat !bg-white/30 cursor-default">
                  {locations.find(l => l.id === selectedLocationId)?.name || 'Неизвестная точка'}
                </div>
              ) : (
                <select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} className="input-flat" required>
                  <option value="">— Выберите точку —</option>
                  {activeLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Название</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Кальян Alpha, Щипцы..." className="input-flat" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Серийный номер / Заметка</label>
              <input type="text" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} placeholder="Напр. SN-123, Чёрный" className="input-flat" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Категория</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-flat">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Кол-во</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="input-flat" />
              </div>
            </div>
            <button type="submit" disabled={isAdding || !form.name} className="w-full p-3 mt-1 bg-primary text-white rounded-xl font-bold shadow-sm disabled:opacity-40 transition flex items-center justify-center gap-2 text-sm">
              <Plus size={16} />
              {isAdding ? 'Добавление...' : 'Добавить'}
            </button>
          </form>
        </div>

        {/* Список */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-14 text-slate-500">
              <div className="w-7 h-7 border-[3px] border-white border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && filteredEquipment.length === 0 && (
            <div className="text-center py-14 stat-card">
              <p className="text-3xl mb-2">🔧</p>
              <p className="text-slate-400 font-bold text-sm">Оборудование ещё не добавлено</p>
              <p className="text-xs text-slate-500 mt-0.5">Добавьте через форму</p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.id}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>{group.icon}</span> {group.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map(item => {
                  const st = STATUS_LABELS[item.status] || STATUS_LABELS.active;
                  return (
                    <div key={item.id} className={`stat-card p-4 transition-all ${item.status !== 'active' ? 'opacity-50' : 'hover:border-primary/20'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${st.cls}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium flex-wrap">
                            <span className="flex items-center gap-1"><MapPin size={10}/>{item.locationName || '—'}</span>
                            <span>× {item.quantity} шт</span>
                            {item.serialNumber && <span className="text-slate-400/60">#{item.serialNumber}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {item.status === 'active' && (
                            <>
                              <button onClick={() => updateStatus(item.id, 'broken')} title="Сломано" className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition text-[10px]">💔</button>
                              <button onClick={() => updateStatus(item.id, 'lost')} title="Утеряно" className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-white/30 transition text-[10px]">❓</button>
                            </>
                          )}
                          {item.status !== 'active' && (
                            <button onClick={() => updateStatus(item.id, 'active')} title="Восстановить" className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition"><RotateCcw size={12} /></button>
                          )}
                          <button onClick={() => { if (window.confirm(`Удалить "${item.name}"?`)) deleteDoc(doc(db, 'equipment', item.id)); }} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EquipmentTab;
