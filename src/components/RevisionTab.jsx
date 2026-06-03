import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardCheck, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import { Card } from './ui/Card';

const formatMoney = (amount) => {
  if (!amount) return '0';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const getRevisionPeriod = () => {
  const now = new Date();
  const day = now.getDate();
  // Если до 20-го — ближайший период 15-е текущего месяца, иначе — конец месяца
  return day <= 20 ? '15' : '30';
};

const getCurrentMonthStr = () => {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
};

const RevisionTab = ({ locationId, locations, tobaccoTypes, allShifts, invStandards }) => {
  const [revisions, setRevisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filterLocId, setFilterLocId] = useState(locationId || 'all');
  const [expandedRevId, setExpandedRevId] = useState(null);

  // Форма ревизии
  const [period, setPeriod] = useState(getRevisionPeriod());
  const [month, setMonth] = useState(getCurrentMonthStr());
  const [selectedLocForRevision, setSelectedLocForRevision] = useState(locationId || '');
  // actuals: { [tobaccoTypeId]: actualGrams }
  const [actuals, setActuals] = useState({});

  const activeLocs = locations.filter(l => l.isActive);

  // Загружаем ревизии
  useEffect(() => {
    const q = query(collection(db, 'revisions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRevisions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Рассчитываем ожидаемые граммы по инвентарю (приходы - расход по сменам) для данной точки
  const [invMovements, setInvMovements] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'inventory_movements'));
    const unsub = onSnapshot(q, (snap) => {
      setInvMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Считаем ожидаемый расход табака по смене для выбранной локации
  const expectedByTobaccoType = useMemo(() => {
    if (!selectedLocForRevision || tobaccoTypes.length === 0) return {};
    
    // Общий приход табака по каждому сорту (привязан к сорту через templateId или tobaccoTypeId)
    // Сначала считаем общий теоретический остаток (всё приходившее минус расход по продажам)
    const locShifts = allShifts.filter(s => s.status === 'closed' && s.locationId === selectedLocForRevision);
    const totalBowlsForLoc = locShifts.reduce((a, s) => a + (s.items?.cocktail1 || 0) + (s.items?.cocktail2 || 0) + (s.staffHookahs || 0), 0);
    const totalTobaccoUsed = totalBowlsForLoc * (invStandards?.tobaccoPerBowl || 23);

    // Приход табака для этой локации (по движениям склада)
    const locMovements = invMovements.filter(m => 
      (!m.locationId || m.locationId === selectedLocForRevision) && 
      m.item === 'tobacco' && 
      m.type === 'in'
    );
    const totalTobaccoIn = locMovements.reduce((a, m) => a + (m.amount || 0), 0);

    // Распределяем теоретический остаток по сортам (пропорционально приходу каждого сорта)
    const tobaccoInByType = {};
    tobaccoTypes.forEach(tt => {
      const typeMovements = locMovements.filter(m => m.tobaccoTypeId === tt.id || m.tobaccoTypeName === tt.name);
      tobaccoInByType[tt.id] = typeMovements.reduce((a, m) => a + (m.amount || 0), 0);
    });

    // Расход пропорционален доле каждого сорта в общем приходе
    const result = {};
    tobaccoTypes.forEach(tt => {
      const share = totalTobaccoIn > 0 ? (tobaccoInByType[tt.id] || 0) / totalTobaccoIn : 0;
      const usedForType = totalTobaccoUsed * share;
      result[tt.id] = Math.max(0, (tobaccoInByType[tt.id] || 0) - usedForType);
    });

    return result;
  }, [selectedLocForRevision, tobaccoTypes, allShifts, invMovements, invStandards]);

  const revisionItems = useMemo(() => {
    return tobaccoTypes.map(tt => {
      const expectedGrams = expectedByTobaccoType[tt.id] || 0;
      const actualGrams = Number(actuals[tt.id] || 0);
      const shortage = Math.max(0, expectedGrams - actualGrams);
      const shortageInMoney = shortage * tt.pricePerGram;
      return {
        tobaccoTypeId: tt.id,
        tobaccoName: tt.name,
        pricePerGram: tt.pricePerGram,
        expectedGrams: Math.round(expectedGrams),
        actualGrams,
        shortage: Math.round(shortage),
        shortageInMoney: Math.round(shortageInMoney),
      };
    });
  }, [tobaccoTypes, expectedByTobaccoType, actuals]);

  const totalShortage = revisionItems.reduce((a, i) => a + i.shortageInMoney, 0);
  const hasShortage = totalShortage > 0;

  const handleSaveRevision = async () => {
    if (!selectedLocForRevision) return alert('Выберите заведение');
    if (tobaccoTypes.length === 0) return alert('Сначала добавьте сорта табака в Настройки → Сорта табака');

    const alreadyExists = revisions.some(
      r => r.locationId === selectedLocForRevision && r.period === period && r.month === month
    );
    if (alreadyExists && !window.confirm(`Ревизия за ${period}-е число, ${month} для этой точки уже есть. Добавить ещё одну?`)) return;

    setIsSaving(true);
    try {
      const locName = locations.find(l => l.id === selectedLocForRevision)?.name || '';
      await addDoc(collection(db, 'revisions'), {
        locationId: selectedLocForRevision,
        locationName: locName,
        period,
        month,
        items: revisionItems,
        totalShortage,
        createdAt: serverTimestamp()
      });
      setActuals({});
      alert('Ревизия сохранена!');
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsSaving(false); }
  };

  const filteredRevisions = filterLocId === 'all'
    ? revisions
    : revisions.filter(r => r.locationId === filterLocId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Ревизия табака</h1>
          <p className="text-sm text-slate-400 mt-1">Проводится 15-го и 30-го (31-го) числа каждого месяца</p>
        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Форма проведения ревизии */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <ClipboardCheck className="text-indigo-600" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black">Провести ревизию</h2>
                <p className="text-xs text-slate-400">Введите фактические остатки</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Заведение</label>
                <select
                  value={selectedLocForRevision}
                  onChange={e => setSelectedLocForRevision(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none"
                >
                  <option value="">— Выберите точку —</option>
                  {activeLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Период</label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none"
                  >
                    <option value="15">15-е число</option>
                    <option value="30">30-е / 31-е</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Месяц / Год</label>
                  <input
                    type="text"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    placeholder="ММ.ГГГГ"
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {tobaccoTypes.length === 0 ? (
              <div className="text-center p-6 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-amber-600 font-bold text-sm">⚠️ Сначала добавьте сорта табака</p>
                <p className="text-amber-500 text-xs mt-1">Настройки → Сорта табака</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Фактический остаток (г)</p>
                  {tobaccoTypes.map(tt => (
                    <div key={tt.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-800 truncate">{tt.name}</p>
                        <p className="text-[10px] text-slate-400">{tt.pricePerGram} ₸/г</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs text-slate-400">
                          <p>Ожид:</p>
                          <p className="font-bold text-slate-600">{Math.round(expectedByTobaccoType[tt.id] || 0)}г</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={actuals[tt.id] || ''}
                          onChange={e => setActuals(prev => ({ ...prev, [tt.id]: e.target.value }))}
                          placeholder="Факт"
                          className="w-20 p-2.5 bg-white rounded-xl border border-slate-200 text-sm font-black text-center outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-xs text-slate-400 font-bold">г</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Итог */}
                {hasShortage ? (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="text-red-500" size={16} />
                      <p className="font-black text-red-600 text-sm">Выявлена недостача</p>
                    </div>
                    <p className="text-2xl font-black text-red-600">{formatMoney(totalShortage)} ₸</p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-100 p-4 rounded-2xl mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-green-500" size={16} />
                      <p className="font-black text-green-600 text-sm">Недостачи нет — всё сходится!</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveRevision}
                  disabled={isSaving || !selectedLocForRevision}
                  className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  <ClipboardCheck size={18} />
                  {isSaving ? 'Сохранение...' : 'Сохранить ревизию'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* История ревизий */}
        <div className="xl:col-span-3 space-y-4">
          <h2 className="text-lg font-black text-slate-800">История ревизий</h2>

          {isLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && filteredRevisions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-[32px] border border-slate-100">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-slate-500 font-bold">Ревизий пока нет</p>
              <p className="text-sm text-slate-400 mt-1">Проведите первую ревизию через форму</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredRevisions.map(rev => {
              const isExpanded = expandedRevId === rev.id;
              return (
                <Card key={rev.id} className="bg-white border border-slate-100 overflow-hidden transition-all">
                  <button
                    className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${rev.totalShortage > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                        {rev.totalShortage > 0
                          ? <AlertTriangle className="text-red-500" size={18} />
                          : <CheckCircle2 className="text-green-500" size={18} />
                        }
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">
                          {rev.period === '15' ? '15-е' : '30-е'} число — {rev.month}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><MapPin size={10}/>{rev.locationName || '—'}</span>
                          {rev.totalShortage > 0
                            ? <span className="text-red-500 font-black">−{formatMoney(rev.totalShortage)} ₸</span>
                            : <span className="text-green-500 font-black">Норма</span>
                          }
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-5 py-3 text-left">Сорт</th>
                            <th className="px-3 py-3 text-right">Ожидалось</th>
                            <th className="px-3 py-3 text-right">Факт</th>
                            <th className="px-3 py-3 text-right">Недостача (г)</th>
                            <th className="px-5 py-3 text-right">Недостача (₸)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(rev.items || []).map((item, i) => (
                            <tr key={i} className={item.shortage > 0 ? 'bg-red-50/40' : ''}>
                              <td className="px-5 py-3 font-bold text-slate-800">{item.tobaccoName}</td>
                              <td className="px-3 py-3 text-right text-slate-500">{item.expectedGrams}г</td>
                              <td className="px-3 py-3 text-right font-bold text-slate-700">{item.actualGrams}г</td>
                              <td className={`px-3 py-3 text-right font-black ${item.shortage > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                {item.shortage > 0 ? `−${item.shortage}г` : '—'}
                              </td>
                              <td className={`px-5 py-3 text-right font-black ${item.shortageInMoney > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {item.shortageInMoney > 0 ? `−${formatMoney(item.shortageInMoney)} ₸` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {rev.totalShortage > 0 && (
                          <tfoot>
                            <tr className="bg-red-50 border-t-2 border-red-100">
                              <td colSpan={4} className="px-5 py-3 font-black text-red-600 text-sm">Итого недостача</td>
                              <td className="px-5 py-3 text-right font-black text-red-600 text-base">−{formatMoney(rev.totalShortage)} ₸</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevisionTab;
