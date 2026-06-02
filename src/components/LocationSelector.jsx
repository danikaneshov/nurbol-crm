import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { Card } from './ui/Card';

const LOCATIONS = [
  { id: 'loc1', name: 'Основная точка', address: 'ул. Абая, 12', isActive: true },
  { id: 'loc2', name: 'Вторая точка', address: 'ул. Достык, 89', isActive: true },
];

const LocationSelector = () => {
  const navigate = useNavigate();
  const [selectedLoc, setSelectedLoc] = useState(null);

  useEffect(() => {
    // If a location is already selected, we could theoretically redirect
    // but the user might want to change it. Let's keep it manual for now.
    const savedLoc = localStorage.getItem('currentLocation');
    if (savedLoc) setSelectedLoc(savedLoc);
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
          {LOCATIONS.map((loc, idx) => (
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
          ))}
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
