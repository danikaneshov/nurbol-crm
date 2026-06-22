import React from 'react';
import ClientMobileNav from './ClientMobileNav';
import { useEmployee } from '../context/EmployeeContext';
import { ArrowLeft } from 'lucide-react';

const ClientLayout = ({ children, activeTab, setActiveTab }) => {
  const { clearLocation } = useEmployee();

 return (
 <div className="flex flex-col min-h-[100dvh] w-full relative">
 {/* Top Bar for PWA aesthetics */}
 <div className="pt-safe pb-3 glass border-x-0 border-t-0 border-b sticky top-0 z-30 flex items-center justify-center relative">
  <button 
    onClick={clearLocation}
    className="absolute left-4 w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 active:scale-95 transition-all"
  >
    <ArrowLeft size={18} />
  </button>
 <span className="text-xl font-black tracking-tighter text-slate-900 ">
 CRM<span className="text-slate-900 ">.</span>
 </span>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 p-4 sm:p-6 pb-40 sm:pb-32 relative z-0">
 <div className="max-w-2xl mx-auto w-full">
 {children}
 </div>
 </div>

 {/* Navigation */}
 <ClientMobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
 </div>
 );
};

export default ClientLayout;
