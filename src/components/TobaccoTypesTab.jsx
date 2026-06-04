import { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, Edit3, Leaf, Plus, Calculator } from 'lucide-react';

const formatMoney = (amount) => {
  if (amount === undefined || amount === null) return 0;
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const calcPricePerGram = (totalGrams, totalCost) => {
  const g = Number(totalGrams);
  const c = Number(totalCost);
  if (!g || !c || g <= 0) return 0;
  return c / g;
};

const TobaccoTypesTab = ({ tobaccoTypes }) => {
  const [form, setForm] = useState({ name: '', totalGrams: '', totalCost: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', totalGrams: '', totalCost: '' });

  const formPricePerGram = calcPricePerGram(form.totalGrams, form.totalCost);
  const editPricePerGram = calcPricePerGram(editForm.totalGrams, editForm.totalCost);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.totalGrams || !form.totalCost) return;
    setIsAdding(true);
    try {
      const ppg = calcPricePerGram(form.totalGrams, form.totalCost);
      await addDoc(collection(db, 'tobacco_types'), {
        name: form.name.trim(),
        totalGrams: Number(form.totalGrams),
        totalCost: Number(form.totalCost),
        pricePerGram: ppg,
        createdAt: serverTimestamp()
      });
      setForm({ name: '', totalGrams: '', totalCost: '' });
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsAdding(false); }
  };

  const handleSaveEdit = async (id) => {
    try {
      const ppg = calcPricePerGram(editForm.totalGrams, editForm.totalCost);
      await updateDoc(doc(db, 'tobacco_types', id), {
        name: editForm.name.trim(),
        totalGrams: Number(editForm.totalGrams),
        totalCost: Number(editForm.totalCost),
        pricePerGram: ppg
      });
      setEditingId(null);
    } catch (err) { alert('Ошибка: ' + err.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Форма добавления */}
      <div className="stat-card p-5 h-fit">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/15">
            <Leaf className="text-emerald-400" size={18} />
          </div>
          <h2 className="text-sm font-black text-slate-900">Добавить сорт</h2>
        </div>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Название сорта</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Daily, Darkside, Element" className="input-flat" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Граммаж (г)</label>
              <input type="number" min="1" value={form.totalGrams} onChange={e => setForm({ ...form, totalGrams: e.target.value })} placeholder="200" className="input-flat" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Стоимость (₸)</label>
              <input type="number" min="0" value={form.totalCost} onChange={e => setForm({ ...form, totalCost: e.target.value })} placeholder="3000" className="input-flat" required />
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${formPricePerGram > 0 ? 'bg-blue-600/10 border border-blue-600/15' : 'bg-slate-100 border border-slate-200'}`}>
            <Calculator size={14} className={formPricePerGram > 0 ? 'text-blue-600' : 'text-slate-600'} />
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase">Цена за 1 грамм</p>
              <p className={`font-black text-sm ${formPricePerGram > 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                {formPricePerGram > 0 ? `${formPricePerGram.toFixed(2)} ₸` : '—'}
              </p>
            </div>
          </div>

          <button type="submit" disabled={isAdding || !form.name || !form.totalGrams || !form.totalCost} className="w-full p-3 mt-1 bg-emerald-600 text-white rounded-xl font-bold shadow-sm-500/15 disabled:opacity-40 transition flex items-center justify-center gap-2 text-sm">
            <Plus size={16} />
            {isAdding ? 'Добавление...' : 'Добавить сорт'}
          </button>
        </form>
      </div>

      {/* Список сортов */}
      <div className="col-span-1 lg:col-span-2">
        {tobaccoTypes.length === 0 ? (
          <div className="text-center py-14 stat-card">
            <p className="text-3xl mb-2">🍃</p>
            <p className="text-slate-400 font-bold text-sm">Сорта табака ещё не добавлены</p>
            <p className="text-xs text-slate-500 mt-0.5">Добавьте через форму</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tobaccoTypes.map(tt => (
              <div key={tt.id} className="stat-card p-4 transition-all hover:border-emerald-500/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🍃</span>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm">{tt.name}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">{tt.totalGrams}г • {formatMoney(tt.totalCost)} ₸</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {editingId !== tt.id && (
                      <button
                        onClick={() => { setEditingId(tt.id); setEditForm({ name: tt.name, totalGrams: tt.totalGrams || '', totalCost: tt.totalCost || '' }); }}
                        className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm(`Удалить сорт "${tt.name}"?`)) deleteDoc(doc(db, 'tobacco_types', tt.id)); }}
                      className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {editingId !== tt.id ? (
                  <div className="mt-2 bg-slate-100 p-2.5 rounded-xl grid grid-cols-3 gap-2 border border-slate-200">
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-slate-500 uppercase">1г</p>
                      <p className="font-black text-slate-800 text-xs">{(tt.pricePerGram || 0).toFixed(2)} ₸</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-slate-500 uppercase">100г</p>
                      <p className="font-black text-slate-800 text-xs">{formatMoney(Math.round((tt.pricePerGram || 0) * 100))} ₸</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-slate-500 uppercase">{tt.totalGrams || 0}г</p>
                      <p className="font-black text-blue-600 text-xs">{formatMoney(tt.totalCost || 0)} ₸</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 bg-slate-100 p-3 rounded-xl border border-slate-200 mt-2 animate-scale-in">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Название</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="input-flat text-sm p-2.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Граммаж (г)</label>
                        <input type="number" min="1" value={editForm.totalGrams} onChange={e => setEditForm({ ...editForm, totalGrams: e.target.value })} className="input-flat text-sm p-2.5" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Стоимость (₸)</label>
                        <input type="number" min="0" value={editForm.totalCost} onChange={e => setEditForm({ ...editForm, totalCost: e.target.value })} className="input-flat text-sm p-2.5" />
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${editPricePerGram > 0 ? 'bg-blue-600/10' : 'bg-slate-100'}`}>
                      <Calculator size={12} className={editPricePerGram > 0 ? 'text-blue-600' : 'text-slate-600'} />
                      <span className="text-[9px] text-slate-500 font-bold">₸/г:</span>
                      <span className={`font-black text-xs ${editPricePerGram > 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                        {editPricePerGram > 0 ? `${editPricePerGram.toFixed(2)} ₸` : '—'}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingId(null)} className="flex-1 py-2 bg-white/30 text-slate-400 rounded-lg text-xs font-bold hover:bg-white/50 transition-colors">Отмена</button>
                      <button onClick={() => handleSaveEdit(tt.id)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-500/15 hover:bg-emerald-700 transition-colors">Сохранить</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TobaccoTypesTab;
