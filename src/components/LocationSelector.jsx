import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { Card } from './ui/Card';

import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const LocationSelector = () => {
  const navigate = useNavigate();
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedLoc = localStorage.getItem('currentLocation');
    if (savedLoc) setSelectedLoc(savedLoc);

    const q = query(collection(db, 'locations'), where('isActive', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSelect = (locId) => {
    localStorage.setItem('currentLocation', locId);
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md animate-in fade-in slide-in-bottom-4 duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-xl shadow-primary/10 mb-6 border border-slate-100">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Выберите точку</h1>
          <p className="text-slate-500 font-medium">Укажите заведение, в котором вы сегодня работаете</p>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="font-bold">Загрузка локаций...</p>
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-[32px] border border-slate-100">
              <p className="text-slate-500 font-bold">Активные локации не найдены.</p>
              <p className="text-sm text-slate-400 mt-2">Добавьте их через панель администратора.</p>
            </div>
          ) : (
            locations.map((loc, idx) => (
              <button
                key={loc.id}
                onClick={() => handleSelect(loc.id)}
                className={`w-full group text-left transition-all duration-300 animate-in fade-in slide-in-bottom-4`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <Card 
                  className={`p-6 border-2 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 relative overflow-hidden ${
                    selectedLoc === loc.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent bg-white hover:border-primary/20'
                  }`}
                >
                  {selectedLoc === loc.id && (
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Sparkles className="w-24 h-24 text-primary" />
                    </div>
                  )}
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                        selectedLoc === loc.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
                      }`}>
                        <MapPin size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{loc.name}</h3>
                        <p className="text-sm font-medium text-slate-400">{loc.address}</p>
                      </div>
                    </div>
                    <ChevronRight className={`transition-transform duration-300 ${
                      selectedLoc === loc.id ? 'text-primary translate-x-1' : 'text-slate-300 group-hover:text-primary group-hover:translate-x-1'
                    }`} />
                  </div>
                </Card>
              </button>
            ))
          )}
        </div>

        <div className="mt-12 text-center">
           <button onClick={() => navigate('/admin/login')} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Войти как администратор
           </button>
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
