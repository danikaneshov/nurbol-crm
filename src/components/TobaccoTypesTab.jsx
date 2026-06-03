import { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, Edit3, Leaf, Plus, Calculator } from 'lucide-react';
import { Card } from './ui/Card';

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-300">
      {/* Форма добавления */}
      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-fit">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Leaf className="text-green-600" size={20} />
          </div>
          <h2 className="text-xl font-black">Добавить сорт</h2>
        </div>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Название сорта</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Напр. Daily, Darkside, Element"
              className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 transition"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Граммаж (г)</label>
              <input
                type="number"
                min="1"
                value={form.totalGrams}
                onChange={e => setForm({ ...form, totalGrams: e.target.value })}
                placeholder="Напр. 200"
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 transition"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Стоимость (₸)</label>
              <input
                type="number"
                min="0"
                value={form.totalCost}
                onChange={e => setForm({ ...form, totalCost: e.target.value })}
                placeholder="Напр. 3000"
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 transition"
                required
              />
            </div>
          </div>

          {/* Авто-расчёт цены за грамм */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${formPricePerGram > 0 ? 'bg-green-50 border border-green-100' : 'bg-slate-50'}`}>
            <Calculator size={16} className={formPricePerGram > 0 ? 'text-green-500' : 'text-slate-300'} />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Цена за 1 грамм</p>
              <p className={`font-black text-lg ${formPricePerGram > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                {formPricePerGram > 0 ? `${formPricePerGram.toFixed(2)} ₸` : '—'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isAdding || !form.name || !form.totalGrams || !form.totalCost}
            className="w-full p-4 mt-2 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-100 disabled:opacity-50 transition hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            {isAdding ? 'Добавление...' : 'Добавить сорт'}
          </button>
        </form>
      </div>

      {/* Список сортов */}
      <div className="col-span-1 lg:col-span-2">
        {tobaccoTypes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100">
            <p className="text-4xl mb-3">🍃</p>
            <p className="text-slate-500 font-bold">Сорта табака ещё не добавлены</p>
            <p className="text-sm text-slate-400 mt-1">Добавьте первый сорт через форму слева</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tobaccoTypes.map(tt => (
              <Card key={tt.id} className="p-6 bg-white border border-slate-100 hover:border-green-200 hover:shadow-lg hover:shadow-green-50 hover:-translate-y-1 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">🍃</div>
                    <div>
                      <h3 className="font-black text-slate-900">{tt.name}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {tt.totalGrams}г • {formatMoney(tt.totalCost)} ₸
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingId !== tt.id && (
                      <button
                        onClick={() => {
                          setEditingId(tt.id);
                          setEditForm({ name: tt.name, totalGrams: tt.totalGrams || '', totalCost: tt.totalCost || '' });
                        }}
                        className="p-2 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm(`Удалить сорт "${tt.name}"?`)) deleteDoc(doc(db, 'tobacco_types', tt.id)); }}
                      className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {editingId !== tt.id ? (
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">1г</p>
                      <p className="font-black text-slate-700 text-sm">{(tt.pricePerGram || 0).toFixed(2)} ₸</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">100г</p>
                      <p className="font-black text-slate-700 text-sm">{formatMoney(Math.round((tt.pricePerGram || 0) * 100))} ₸</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{tt.totalGrams || 0}г</p>
                      <p className="font-black text-green-600 text-sm">{formatMoney(tt.totalCost || 0)} ₸</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-3 animate-in fade-in zoom-in-95 duration-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Название</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Граммаж (г)</label>
                        <input
                          type="number"
                          min="1"
                          value={editForm.totalGrams}
                          onChange={e => setEditForm({ ...editForm, totalGrams: e.target.value })}
                          className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Стоимость (₸)</label>
                        <input
                          type="number"
                          min="0"
                          value={editForm.totalCost}
                          onChange={e => setEditForm({ ...editForm, totalCost: e.target.value })}
                          className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none"
                        />
                      </div>
                    </div>
                    {/* Авто-расчёт при редактировании */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${editPricePerGram > 0 ? 'bg-green-50' : 'bg-slate-100'}`}>
                      <Calculator size={13} className={editPricePerGram > 0 ? 'text-green-500' : 'text-slate-300'} />
                      <span className="text-[10px] text-slate-400 font-bold">₸/г:</span>
                      <span className={`font-black text-sm ${editPricePerGram > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                        {editPricePerGram > 0 ? `${editPricePerGram.toFixed(2)} ₸` : '—'}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingId(null)} className="flex-1 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors">Отмена</button>
                      <button onClick={() => handleSaveEdit(tt.id)} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-green-700 transition-colors">Сохранить</button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TobaccoTypesTab;
