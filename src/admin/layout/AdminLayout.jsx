import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

import { useAdmin } from '../context/AdminContext';

const AdminLayout = ({ children }) => {
 const { locations, selectedLocationId, setSelectedLocationId } = useAdmin();

 return (
  <div className="flex flex-col lg:flex-row min-h-[100dvh] w-full no-select relative">
    <Sidebar />
    <MobileNav />
    
    {/* Основной контент */}
    <div 
      className="flex-1 lg:ml-[320px] p-6 pb-32 lg:p-12 lg:pb-12"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
    >
      <div className="lg:hidden mb-6">
        <select 
          value={selectedLocationId} 
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="w-full bg-white border border-slate-200 p-3 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          {locations.length === 0 && <option value="">Нет точек</option>}
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>
      {children}
    </div>
 </div>
 );
};

export default AdminLayout;
