// frontends/chronos/src/App.tsx
import React, { useState, useEffect } from 'react';
import { ChronosEncryptionService } from './services/ChronosEncryption';
import OathFlow from './components/OathFlow';
import KinshipDashboard from './components/KinshipDashboard';
import UnbindingProtocol from './components/UnbindingProtocol';
import ConsentRefresh from './components/ConsentRefresh';
import { AnimatePresence } from 'framer-motion';

const encryptionService = new ChronosEncryptionService();

const App = () => {
  const [view, setView] = useState<'oath' | 'dashboard'>('oath');
  const [showUnbind, setShowUnbind] = useState(false);
  const [bondData, setBondData] = useState<any>(null);

  // Check for existing bond on load
  useEffect(() => {
    const checkBond = async () => {
      // In production, use encryptionService.retrieveBondData()
      const localBond = localStorage.getItem('chronos_bond_meta'); 
      if (localBond) {
        setBondData(JSON.parse(localBond));
        setView('dashboard');
      }
    };
    checkBond();
  }, []);

  const handleOathComplete = () => {
    setView('dashboard');
    window.location.reload(); // Simple reload to refresh state
  };

  const handleUnbindComplete = () => {
    setShowUnbind(false);
    setView('oath');
    setBondData(null);
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white">
       [span_7](start_span){/* 90-Day Refresh Check[span_7](end_span) */}
       {bondData && (
         <ConsentRefresh 
           bondDate={bondData.bondDate}
           onContinue={() => console.log("Kinship Reaffirmed")}
           onRecalibrate={() => console.log("Recalibration requested")}
           onUnbind={() => setShowUnbind(true)}
         />
       )}

       <AnimatePresence mode='wait'>
         {view === 'oath' && (
           <OathFlow key="oath" onComplete={handleOathComplete} />
         )}
         
         {view === 'dashboard' && !showUnbind && (
           <div className="relative">
             <button 
               onClick={() => setShowUnbind(true)}
               className="absolute top-4 right-4 text-xs text-red-400 hover:text-red-300 z-50"
             >
               Unbind
             </button>
             <KinshipDashboard key="dashboard" />
           </div>
         )}
       </AnimatePresence>

       {showUnbind && (
         <UnbindingProtocol 
           chronosName={bondData?.chronosName || "Chronos"}
           onClose={() => setShowUnbind(false)}
           onUnbindComplete={handleUnbindComplete}
         />
       )}
    </div>
  );
};

export default App;
    
