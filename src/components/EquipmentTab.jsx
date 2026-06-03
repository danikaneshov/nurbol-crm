import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Wrench, Plus, Trash2, Hammer, Wind, Flame, Zap, Archive, RotateCcw, MapPin } from 'lucide-react';
import { Card } from './ui/Card';

const CATEGORIES = [
  { id: 'hookah', label: 'Кальян', icon: '💨', color: 'blue' },
  { id: 'accessory', label: 'Аксессуары', icon: '🔧', color: 'orange' },
  { id: 'heating', label: 'Плитка/Нагрев', icon: '🔥', color: 'red' },
  { id: 'other', label: 'Прочее', icon: '📦', color: 'slate' },
];

const STATUS_LABELS = {
  active: { label: 'Активно', cls: 'bg-green-100 text-green-600' },
  broken: { label: 'Сломано', cls: 'bg-red-100 text-red-600' },
  lost: { label: 'Утеряно', cls: 'bg-slate-200 text-slate-500' },
};

const EquipmentTab = ({ locations, selectedLocationId, setSelectedLocationId }) => {
  const [equipment, setEquipment] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: '', category: 'hookah', quantity: 1, locationId: selectedLocationId || '' });
  const [isAdding, setIsAdding] = useState(false);
  const [filterLocId, setFilterLocId] = useState(selectedLocationId || 'all');

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
    if (!form.name || !form.locationId) return;
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'equipment'), {
        name: form.name.trim(),
        category: form.category,
        quantity: Number(form.quantity),
        locationId: form.locationId,
        locationName: locations.find(l => l.id === form.locationId)?.name || '',
        status: 'active',
        createdAt: serverTimestamp()
      });
      setForm({ name: '', category: 'hookah', quantity: 1, locationId: form.locationId });
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsAdding(false); }
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'equipment', id), { status });
  };

  const activeLocs = locations.filter(l => l.isActive);

  const filteredEquipment = filterLocId === 'all'
    ? equipment
    : equipment.filter(e => e.locationId === filterLocId);

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: filteredEquipment.filter(e => e.category === cat.id)
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Оборудование</h1>
          <p className="text-sm text-slate-400 mt-1">Кальяны, щипцы, плитки и другой инвентарь</p>
        </div>
        {/* Фильтр по точке */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterLocId('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${filterLocId === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-700'}`}
          >
            Все точки
          </button>
          {activeLocs.map(loc => (
            <button
              key={loc.id}
              onClick={() => setFilterLocId(loc.id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${filterLocId === loc.id ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-700'}`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Форма добавления */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Plus className="text-blue-600" size={20} />
            </div>
            <h2 className="text-xl font-black">Добавить</h2>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Заведение</label>
              <select
                value={form.locationId}
                onChange={e => setForm({ ...form, locationId: e.target.value })}
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none"
                required
              >
                <option value="">— Выберите точку —</option>
                {activeLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Напр. Кальян Alpha, Щипцы, Плитка"
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-blue-400 transition"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Категория</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none"
              >
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Количество</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !form.name || !form.locationId}
              className="w-full p-4 mt-2 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 disabled:opacity-50 hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              {isAdding ? 'Добавление...' : 'Добавить'}
            </button>
          </form>
        </div>

        {/* Список оборудования */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
            </div>
          )}

          {!isLoading && filteredEquipment.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100">
              <p className="text-4xl mb-3">🔧</p>
              <p className="text-slate-500 font-bold">Оборудование ещё не добавлено</p>
              <p className="text-sm text-slate-400 mt-1">Добавьте первую единицу через форму</p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.id}>
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>{group.icon}</span> {group.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map(item => {
                  const st = STATUS_LABELS[item.status] || STATUS_LABELS.active;
                  return (
                    <Card key={item.id} className={`p-5 border-2 transition-all ${item.status !== 'active' ? 'opacity-60 bg-slate-50 border-transparent' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${st.cls}`}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium flex-wrap">
                            <span className="flex items-center gap-1"><MapPin size={11}/>{item.locationName || '—'}</span>
                            <span>× {item.quantity} шт</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 ml-2">
                          {item.status === 'active' && (
                            <>
                              <button onClick={() => updateStatus(item.id, 'broken')} title="Сломано" className="p-1.5 bg-orange-50 text-orange-400 rounded-lg hover:bg-orange-100 transition text-[10px] font-bold">
                                💔
                              </button>
                              <button onClick={() => updateStatus(item.id, 'lost')} title="Утеряно" className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition text-[10px] font-bold">
                                ❓
                              </button>
                            </>
                          )}
                          {item.status !== 'active' && (
                            <button onClick={() => updateStatus(item.id, 'active')} title="Восстановить" className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition">
                              <RotateCcw size={13} />
                            </button>
                          )}
                          <button onClick={() => { if (window.confirm(`Удалить "${item.name}"?`)) deleteDoc(doc(db, 'equipment', item.id)); }} className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </Card>
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
