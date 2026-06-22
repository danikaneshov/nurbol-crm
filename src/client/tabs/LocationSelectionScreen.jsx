import React from 'react';
import { useEmployee } from '../context/EmployeeContext';
import { Store, LogOut } from 'lucide-react';

const LocationSelectionScreen = () => {
  const { locations, selectLocation, logout, employee } = useEmployee();

  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-slate-50 relative">
      {/* Top Bar */}
      <div className="pt-safe pb-4 px-6 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-slate-900">
            CRM<span className="text-slate-900">.</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-0.5">{employee?.name}</p>
        </div>
        <button 
          onClick={logout}
          className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 pb-20">
        <div className="max-w-2xl mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Выбор точки</h2>
            <p className="text-slate-500 font-medium">Выберите заведение, в котором будете работать.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locations.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm">
                Нет доступных точек.
              </div>
            )}
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => selectLocation(loc.id)}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md active:scale-[0.98] transition-all text-left flex items-center gap-5 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Store size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 mb-1">{loc.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Перейти к смене</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSelectionScreen;
