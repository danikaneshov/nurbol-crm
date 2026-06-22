import React, { useState } from 'react';
import { EmployeeProvider, useEmployee } from './context/EmployeeContext';
import ClientLayout from './layout/ClientLayout';
import LoginScreen from './tabs/LoginScreen';
import ShiftTab from './tabs/ShiftTab';
import StatsTab from './tabs/StatsTab';
import GlobalModal from './components/GlobalModal';
import LocationSelectionScreen from './tabs/LocationSelectionScreen';

const AppContent = () => {
 const { employee, selectedLocationId } = useEmployee();
 const [activeTab, setActiveTab] = useState('shift'); // 'shift' or 'stats'

 if (!employee) {
 return <LoginScreen />;
 }

 if (!selectedLocationId) {
 return <LocationSelectionScreen />;
 }

 return (
 <ClientLayout activeTab={activeTab} setActiveTab={setActiveTab}>
 {activeTab === 'shift' && <ShiftTab />}
 {activeTab === 'stats' && <StatsTab />}
 <GlobalModal />
 </ClientLayout>
 );
};

const EmployeeAppNew = () => {
 return (
 <EmployeeProvider>
 <AppContent />
 </EmployeeProvider>
 );
};

export default EmployeeAppNew;
