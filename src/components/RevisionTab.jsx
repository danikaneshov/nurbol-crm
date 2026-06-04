import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ClipboardCheck, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, MapPin, Calendar, TrendingDown, Scale } from 'lucide-react';

const formatMoney = (amount) => {
  if (!amount) return '0';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const RevisionTab = ({ locationId, locations, tobaccoTemplates = [], tobaccoTypes = [], allShifts, invStandards }) => {
  // Нормализуем: используем tobaccoTypes если есть, иначе фолбэк на tobaccoTemplates
  const allTobaccoSorts = useMemo(() => {
    if (tobaccoTypes && tobaccoTypes.length > 0) {
      return tobaccoTypes.map(t => ({
        id: t.id,
        name: t.name,
        totalGrams: Number(t.totalGrams) || 0,
        totalCost: Number(t.totalCost) || 0,
        pricePerGram: t.pricePerGram || ((t.totalGrams && t.totalCost) ? Number(t.totalCost) / Number(t.totalGrams) : 0),
      }));
    }
    return tobaccoTemplates.map(t => ({
      id: t.id,
      name: t.name,
      totalGrams: Number(t.amount) || 0,
      totalCost: Number(t.price) || 0,
      pricePerGram: (t.amount && t.price) ? Number(t.price) / Number(t.amount) : 0,
    }));
  }, [tobaccoTypes, tobaccoTemplates]);

  const [revisions, setRevisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRevId, setExpandedRevId] = useState(null);

  // Форма ревизии — свободная дата
  const [revisionDate, setRevisionDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`;
  });
  const [selectedLocForRevision, setSelectedLocForRevision] = useState(locationId || '');
  // actuals: { [tobaccoSortId]: actualGrams }
  const [actuals, setActuals] = useState({});

  useEffect(() => {
    setSelectedLocForRevision(locationId || '');
  }, [locationId]);

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

  // Загружаем движения склада
  const [invMovements, setInvMovements] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'inventory_movements'));
    const unsub = onSnapshot(q, (snap) => {
      setInvMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Считаем ожидаемый остаток табака по каждому сорту
  const expectedByTobaccoType = useMemo(() => {
    if (!selectedLocForRevision || allTobaccoSorts.length === 0) return {};
    
    const locShifts = allShifts.filter(s => s.status === 'closed' && s.locationId === selectedLocForRevision);
    const totalBowlsForLoc = locShifts.reduce((a, s) => a + (s.items?.cocktail1 || 0) + (s.items?.cocktail2 || 0) + (s.staffHookahs || 0), 0);
    const totalTobaccoUsed = totalBowlsForLoc * (invStandards?.tobaccoPerBowl || 23);

    const locMovements = invMovements.filter(m => 
      (!m.locationId || m.locationId === selectedLocForRevision) && 
      m.item === 'tobacco' && 
      m.type === 'in'
    );
    const totalTobaccoIn = locMovements.reduce((a, m) => a + (m.amount || 0), 0);

    // Распределяем по сортам
    const tobaccoInByType = {};
    allTobaccoSorts.forEach(tt => {
      const typeMovements = locMovements.filter(m => 
        m.tobaccoTypeId === tt.id || 
        m.tobaccoTypeName === tt.name || 
        m.templateId === tt.id || 
        m.templateName === tt.name
      );
      tobaccoInByType[tt.id] = typeMovements.reduce((a, m) => a + (m.amount || 0), 0);
    });

    // Расход пропорционален доле каждого сорта
    const result = {};
    allTobaccoSorts.forEach(tt => {
      const share = totalTobaccoIn > 0 ? (tobaccoInByType[tt.id] || 0) / totalTobaccoIn : 0;
      const usedForType = totalTobaccoUsed * share;
      result[tt.id] = {
        incoming: tobaccoInByType[tt.id] || 0,
        used: Math.round(usedForType),
        expected: Math.max(0, (tobaccoInByType[tt.id] || 0) - usedForType),
      };
    });

    return result;
  }, [selectedLocForRevision, allTobaccoSorts, allShifts, invMovements, invStandards]);

  // Считаем сколько кальянов продано для выбранной локации
  const soldHookahs = useMemo(() => {
    if (!selectedLocForRevision) return 0;
    const locShifts = allShifts.filter(s => s.status === 'closed' && s.locationId === selectedLocForRevision);
    return locShifts.reduce((a, s) => a + (s.items?.cocktail1 || 0) + (s.items?.cocktail2 || 0) + (s.staffHookahs || 0), 0);
  }, [selectedLocForRevision, allShifts]);

  const revisionItems = useMemo(() => {
    return allTobaccoSorts.map(tt => {
      const data = expectedByTobaccoType[tt.id] || { incoming: 0, used: 0, expected: 0 };
      const actualGrams = Number(actuals[tt.id] || 0);
      const shortage = Math.max(0, data.expected - actualGrams);
      const excess = Math.max(0, actualGrams - data.expected);
      const shortageInMoney = shortage * tt.pricePerGram;
      return {
        tobaccoTypeId: tt.id,
        tobaccoName: tt.name,
        pricePerGram: tt.pricePerGram,
        incoming: Math.round(data.incoming),
        used: Math.round(data.used),
        expectedGrams: Math.round(data.expected),
        actualGrams,
        shortage: Math.round(shortage),
        excess: Math.round(excess),
        shortageInMoney: Math.round(shortageInMoney),
      };
    });
  }, [allTobaccoSorts, expectedByTobaccoType, actuals]);

  const totalShortageGrams = revisionItems.reduce((a, i) => a + i.shortage, 0);
  const totalShortage = revisionItems.reduce((a, i) => a + i.shortageInMoney, 0);
  const hasShortage = totalShortage > 0;

  const handleSaveRevision = async () => {
    if (!selectedLocForRevision) return alert('Выберите заведение');
    if (allTobaccoSorts.length === 0) return alert('Сначала добавьте сорта табака');

    setIsSaving(true);
    try {
      const locName = locations.find(l => l.id === selectedLocForRevision)?.name || '';
      await addDoc(collection(db, 'revisions'), {
        locationId: selectedLocForRevision,
        locationName: locName,
        dateStr: revisionDate,
        soldHookahs,
        items: revisionItems,
        totalShortage,
        totalShortageGrams,
        createdAt: serverTimestamp()
      });
      setActuals({});
      alert('Ревизия сохранена!');
    } catch (err) { alert('Ошибка: ' + err.message); }
    finally { setIsSaving(false); }
  };

  const filteredRevisions = locationId
    ? revisions.filter(r => r.locationId === locationId)
    : revisions;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Ревизия табака</h1>
          <p className="text-xs text-slate-500 mt-0.5">Снимите ревизию в любое время — данные сохраняются в истории</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Форма проведения ревизии */}
        <div className="xl:col-span-2 space-y-4">
          <div className="stat-card p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-indigo-600/15 rounded-lg flex items-center justify-center border border-indigo-600/20">
                <ClipboardCheck className="text-indigo-600" size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Провести ревизию</h2>
                <p className="text-[10px] text-slate-500">Введите фактические остатки</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Заведение</label>
                {locationId ? (
                  <div className="input-flat !bg-white/30 cursor-default">
                    {locations.find(l => l.id === locationId)?.name || 'Неизвестная точка'}
                  </div>
                ) : (
                  <select
                    value={selectedLocForRevision}
                    onChange={e => setSelectedLocForRevision(e.target.value)}
                    className="input-flat"
                  >
                    <option value="">— Выберите точку —</option>
                    {activeLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Дата ревизии</label>
                <input
                  type="text"
                  value={revisionDate}
                  onChange={e => setRevisionDate(e.target.value)}
                  placeholder="ДД.ММ.ГГГГ"
                  className="input-flat"
                />
              </div>

              {/* Инфо: сколько кальянов продано */}
              {selectedLocForRevision && (
                <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl flex items-center gap-3">
                  <Scale size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Продано кальянов</p>
                    <p className="text-sm font-black text-primary">{soldHookahs} шт <span className="text-slate-500 font-medium">× {invStandards?.tobaccoPerBowl || 23}г = {formatMoney(soldHookahs * (invStandards?.tobaccoPerBowl || 23))}г расход</span></p>
                  </div>
                </div>
              )}
            </div>

            {allTobaccoSorts.length === 0 ? (
              <div className="text-center p-5 bg-amber-500/5 rounded-xl border border-amber-500/10">
                <p className="text-amber-400 font-bold text-xs">⚠️ Нет сортов табака</p>
                <p className="text-amber-400/60 text-[10px] mt-0.5">Добавьте сорта в Склад → Сорта табака</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Фактический остаток (г)</p>
                  {allTobaccoSorts.map(tt => {
                    const data = expectedByTobaccoType[tt.id] || { expected: 0 };
                    return (
                    <div key={tt.id} className="flex items-center gap-3 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-xs text-slate-800 truncate">{tt.name}</p>
                        <p className="text-[9px] text-slate-500">{tt.pricePerGram.toFixed(1)} ₸/г</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-[10px] text-slate-500 leading-tight">
                          <p>Ожид:</p>
                          <p className="font-bold text-slate-400">{Math.round(data.expected)}г</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={actuals[tt.id] || ''}
                          onChange={e => setActuals(prev => ({ ...prev, [tt.id]: e.target.value }))}
                          placeholder="Факт"
                          className="w-20 p-2 bg-white rounded-lg border border-slate-200 text-sm font-black text-center text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600/30 transition-all"
                        />
                        <span className="text-[10px] text-slate-500 font-bold">г</span>
                      </div>
                    </div>
                  );})}
                </div>

                {/* Итого / Детализация */}
                {Object.keys(actuals).length > 0 && (
                  <div className="space-y-3 mb-4">
                    {/* Breakdown по каждому сорту */}
                    {revisionItems.filter(i => i.actualGrams > 0 || i.shortage > 0).map(item => (
                      <div key={item.tobaccoTypeId} className={`p-3 rounded-xl border text-xs ${item.shortage > 0 ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800">{item.tobaccoName}</span>
                          {item.shortage > 0 
                            ? <span className="font-black text-red-400">−{item.shortage}г ({formatMoney(item.shortageInMoney)} ₸)</span>
                            : <span className="font-black text-emerald-400">Норма {item.excess > 0 ? `+${item.excess}г` : ''}</span>
                          }
                        </div>
                        <div className="flex gap-4 text-[10px] text-slate-500">
                          <span>Приход: {formatMoney(item.incoming)}г</span>
                          <span>Расход: {formatMoney(item.used)}г</span>
                          <span>Ожид: {formatMoney(item.expectedGrams)}г</span>
                          <span>Факт: {item.actualGrams}г</span>
                        </div>
                      </div>
                    ))}

                    {/* Общий итог */}
                    {hasShortage ? (
                      <div className="bg-red-500/10 border border-red-500/15 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="text-red-400" size={16} />
                          <p className="font-black text-red-400 text-sm">Общая недостача</p>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <p className="text-2xl font-black text-red-400">{formatMoney(totalShortage)} ₸</p>
                          <p className="text-xs text-red-400/60">{totalShortageGrams}г</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-emerald-400" size={16} />
                          <p className="font-black text-emerald-400 text-sm">Недостачи нет — всё сходится!</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSaveRevision}
                  disabled={isSaving || !selectedLocForRevision}
                  className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold shadow-sm-purple/15 disabled:opacity-40 hover:bg-indigo-600/90 transition flex items-center justify-center gap-2 text-sm"
                >
                  <ClipboardCheck size={16} />
                  {isSaving ? 'Сохранение...' : 'Сохранить ревизию'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* История ревизий */}
        <div className="xl:col-span-3 space-y-4">
          <h2 className="text-sm font-black text-slate-900">История ревизий</h2>

          {isLoading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <div className="w-7 h-7 border-[3px] border-white border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && filteredRevisions.length === 0 && (
            <div className="text-center py-14 stat-card">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-slate-400 font-bold text-sm">Ревизий пока нет</p>
              <p className="text-xs text-slate-500 mt-0.5">Проведите первую ревизию через форму</p>
            </div>
          )}

          <div className="space-y-3">
            {filteredRevisions.map(rev => {
              const isExpanded = expandedRevId === rev.id;
              const revDate = rev.dateStr || (rev.period ? `${rev.period === '15' ? '15-е' : '30-е'} — ${rev.month}` : 'Неизвестно');
              return (
                <div key={rev.id} className="stat-card overflow-hidden transition-all p-0">
                  <button
                    className="w-full p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                    onClick={() => setExpandedRevId(isExpanded ? null : rev.id)}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${rev.totalShortage > 0 ? 'bg-red-500/10 border border-red-500/15' : 'bg-emerald-500/10 border border-emerald-500/15'}`}>
                        {rev.totalShortage > 0
                          ? <AlertTriangle className="text-red-400" size={16} />
                          : <CheckCircle2 className="text-emerald-400" size={16} />
                        }
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">{revDate}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1"><MapPin size={9}/>{rev.locationName || '—'}</span>
                          {rev.soldHookahs != null && <span>{rev.soldHookahs} кальянов</span>}
                          {rev.totalShortage > 0
                            ? <span className="text-red-400 font-black">−{formatMoney(rev.totalShortage)} ₸</span>
                            : <span className="text-emerald-400 font-black">Норма</span>
                          }
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                            <th className="px-4 py-2 text-left">Сорт</th>
                            <th className="px-2 py-2 text-right">Ожидалось</th>
                            <th className="px-2 py-2 text-right">Факт</th>
                            <th className="px-2 py-2 text-right">Недостача (г)</th>
                            <th className="px-4 py-2 text-right">Недостача (₸)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {(rev.items || []).map((item, i) => (
                            <tr key={i} className={item.shortage > 0 ? 'bg-red-500/3' : ''}>
                              <td className="px-4 py-2 font-bold text-slate-800">{item.tobaccoName}</td>
                              <td className="px-2 py-2 text-right text-slate-500">{item.expectedGrams}г</td>
                              <td className="px-2 py-2 text-right font-bold text-slate-800">{item.actualGrams}г</td>
                              <td className={`px-2 py-2 text-right font-black ${item.shortage > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                {item.shortage > 0 ? `−${item.shortage}г` : '—'}
                              </td>
                              <td className={`px-4 py-2 text-right font-black ${item.shortageInMoney > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                {item.shortageInMoney > 0 ? `−${formatMoney(item.shortageInMoney)} ₸` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {rev.totalShortage > 0 && (
                          <tfoot>
                            <tr className="bg-red-500/5 border-t-2 border-red-500/10">
                              <td colSpan={4} className="px-4 py-2 font-black text-red-400 text-xs">Итого недостача</td>
                              <td className="px-4 py-2 text-right font-black text-red-400 text-sm">−{formatMoney(rev.totalShortage)} ₸</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevisionTab;
