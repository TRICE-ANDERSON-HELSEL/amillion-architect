
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useCallback, useEffect, useState} from 'react';
import {GeneratedContent} from './components/GeneratedContent';
import {Icon} from './components/Icon';
import {ParametersPanel} from './components/ParametersPanel';
import {Window} from './components/Window';
import {APP_DEFINITIONS_CONFIG, INITIAL_MAX_HISTORY_LENGTH} from './constants';
import {streamAppContent} from './services/geminiService';
import {safeLocalStorage} from './storage';
import {AppDefinition, InteractionData, CacheConfig} from './types';

// Declare AIStudio interface globally for consistent TypeScript support across all declarations
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Using optional modifier to match potential platform/environment declarations and avoid "identical modifiers" error.
    aistudio?: AIStudio;
  }
}

const DesktopView: React.FC<{onAppOpen: (app: AppDefinition) => void}> = ({
  onAppOpen,
}) => (
  <div className="flex flex-wrap content-start p-4">
    {APP_DEFINITIONS_CONFIG.map((app) => (
      <Icon key={app.id} app={app} onInteract={() => onAppOpen(app)} />
    ))}
  </div>
);

const App: React.FC = () => {
  const [isBooted, setIsBooted] = useState<boolean>(false);
  const [cacheConfig, setCacheConfig] = useState<CacheConfig>(() => {
    const savedConfig = safeLocalStorage.getItem('gemini-os-cache-config');
    if (savedConfig) {
      try {
        // Ensure the parsed object matches the CacheConfig structure.
        const parsed = JSON.parse(savedConfig);
        if (typeof parsed.enabled === 'boolean' && typeof parsed.sizeGB === 'number') {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved cache config:', e);
      }
    }
    // Return default if nothing saved or parsing fails.
    return {
      enabled: true,
      sizeGB: 10,
    };
  });

  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);
  const [pipApp, setPipApp] = useState<AppDefinition | null>(null);
  const [pipContent, setPipContent] = useState<string>('');
  
  const [llmContent, setLlmContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<
    InteractionData[]
  >([]);
  const [isParametersOpen, setIsParametersOpen] = useState<boolean>(false);
  const [currentMaxHistoryLength, setCurrentMaxHistoryLength] =
    useState<number>(INITIAL_MAX_HISTORY_LENGTH);

  const [isStatefulnessEnabled, setIsStatefulnessEnabled] =
    useState<boolean>(false);

  // Effect to persist cache config changes to localStorage.
  useEffect(() => {
    safeLocalStorage.setItem('gemini-os-cache-config', JSON.stringify(cacheConfig));
  }, [cacheConfig]);


  /**
   * Orchestrates LLM requests, streaming content back to the UI.
   * Features robust error handling for project/quota issues.
   */
  const internalHandleLlmRequest = useCallback(
    async (historyForLlm: InteractionData[], maxHistoryLength: number, target: 'main' | 'pip' = 'main') => {
      if (historyForLlm.length === 0) return;

      setIsLoading(true);
      setError(null);

      let isFirstChunk = true;
      try {
        const stream = streamAppContent(historyForLlm, maxHistoryLength, cacheConfig);
        for await (const chunk of stream) {
          if (isFirstChunk) {
            target === 'main' ? setLlmContent(chunk) : setPipContent(chunk);
            isFirstChunk = false;
          } else {
            target === 'main' 
              ? setLlmContent((prev) => prev + chunk) 
              : setPipContent((prev) => prev + chunk);
          }
        }
      } catch (e: any) {
        console.error('Stream processing error:', e);
        // Fix: If the request fails with "Requested entity was not found.", trigger key selection logic as per guidelines.
        if (e.message?.includes("Requested entity was not found.")) {
          setError('API Key error. Please re-select a valid project key.');
          window.aistudio?.openSelectKey();
        } else if (e.message?.includes("429") || e.message?.toLowerCase().includes("quota")) {
          setError('Quota exceeded. Please switch to a paid API key.');
        } else {
          setError('Kernel communication error. Check your uplink.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [cacheConfig],
  );

  const handleInteraction = useCallback(
    async (interactionData: InteractionData) => {
      if (interactionData.id === 'app_close_button') {
        handleCloseAppView();
        return;
      }

      // Proactive Key Management
      if (interactionData.id === 'change_api_key') {
        setError(null); // Clear previous errors
        try {
          if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            // Assume success and refresh the last action if possible
            if (interactionHistory.length > 0) {
              const isTargetPip = pipApp && interactionHistory[0].appContext === pipApp.id;
              internalHandleLlmRequest(interactionHistory, currentMaxHistoryLength, isTargetPip ? 'pip' : 'main');
            }
          } else {
            setError('Native key selector unavailable in this environment.');
          }
        } catch (e) {
          setError('Failed to trigger native key management dialog.');
        }
        return;
      }

      // PiP Toggle integration
      if (interactionData.id === 'toggle_pip') {
        if (activeApp?.id === 'voice_assistant') {
          setPipApp(activeApp);
          setPipContent(llmContent);
          setActiveApp(null);
          setLlmContent('');
        } else if (pipApp) {
          const restoredApp = pipApp;
          const restoredContent = pipContent;
          setPipApp(null);
          setPipContent('');
          setActiveApp(restoredApp);
          setLlmContent(restoredContent);
        }
        return;
      }

      const newHistory = [
        interactionData,
        ...interactionHistory.slice(0, currentMaxHistoryLength - 1),
      ];
      setInteractionHistory(newHistory);

      const isTargetPip = pipApp && interactionData.appContext === pipApp.id;
      internalHandleLlmRequest(newHistory, currentMaxHistoryLength, isTargetPip ? 'pip' : 'main');
    },
    [
      interactionHistory,
      internalHandleLlmRequest,
      activeApp,
      pipApp,
      pipContent,
      llmContent,
      currentMaxHistoryLength,
    ],
  );

  const handleAppOpen = (app: AppDefinition) => {
    if (pipApp?.id === app.id) {
      handleInteraction({id: 'toggle_pip', type: 'generic_click', elementType: 'button', elementText: 'Restore', appContext: app.id});
      return;
    }

    const initialInteraction: InteractionData = {
      id: app.id,
      type: 'app_open',
      elementText: app.name,
      elementType: 'icon',
      appContext: app.id,
    };

    setInteractionHistory([initialInteraction]);
    setActiveApp(app);
    setLlmContent('');
    internalHandleLlmRequest([initialInteraction], currentMaxHistoryLength);
  };

  const handleCloseAppView = () => {
    setActiveApp(null);
    setLlmContent('');
    setInteractionHistory([]);
    setError(null);
  };

  const handleToggleParametersPanel = () => {
    setIsParametersOpen(!isParametersOpen);
    if (!isParametersOpen) {
      setActiveApp(null);
      setLlmContent('');
    }
  };

  const handleBoot = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }
    setIsBooted(true);
  };

  if (!isBooted) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6 z-50">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full border border-slate-700 font-sans">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold animate-pulse shadow-lg">
              Ω
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight tracking-[-0.05em]">Gemini OS</h1>
          </div>
          
          <div className="space-y-6">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Kernel Cache</span>
                <input 
                  type="checkbox" 
                  checked={cacheConfig.enabled}
                  onChange={(e) => setCacheConfig({...cacheConfig, enabled: e.target.checked})}
                  className="w-6 h-6 accent-blue-600 cursor-pointer"
                />
              </label>
              <div className={cacheConfig.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
                <input 
                  type="range" min="5" max="20" step="1"
                  value={cacheConfig.sizeGB}
                  onChange={(e) => setCacheConfig({...cacheConfig, sizeGB: parseInt(e.target.value)})}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                  <span>5GB Partition</span>
                  <span>{cacheConfig.sizeGB}GB Allocation</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleBoot}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-[0.98] text-sm uppercase tracking-[0.3em]"
            >
              Boot Architect
            </button>
            <p className="text-[10px] text-center text-slate-400 font-medium">Please ensure a paid API key is selected for best performance.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-200 overflow-hidden">
      <Window
        title={isParametersOpen ? 'System Configuration' : (activeApp?.name || 'Gemini OS')}
        onClose={handleCloseAppView}
        isAppOpen={!!activeApp}
        onToggleParameters={handleToggleParametersPanel}
        onExitToDesktop={handleCloseAppView}
        isParametersPanelOpen={isParametersOpen}
        cacheConfig={cacheConfig}
      >
        {isParametersOpen ? (
          <ParametersPanel
            currentLength={currentMaxHistoryLength}
            onUpdateHistoryLength={setCurrentMaxHistoryLength}
            onClosePanel={handleToggleParametersPanel}
            isStatefulnessEnabled={isStatefulnessEnabled}
            onSetStatefulness={setIsStatefulnessEnabled}
            cacheConfig={cacheConfig}
            onSetCacheConfig={setCacheConfig}
            onOpenKeySelector={() => handleInteraction({id: 'change_api_key', type: 'system', elementType: 'button', elementText: 'Key Manager', appContext: null})}
          />
        ) : activeApp ? (
          <GeneratedContent
            htmlContent={llmContent}
            onInteract={handleInteraction}
            appContext={activeApp.id}
            isLoading={isLoading}
          />
        ) : (
          <DesktopView onAppOpen={handleAppOpen} />
        )}

        {/* Architect PiP Overlay */}
        {pipApp && (
          <div className="absolute bottom-12 right-6 w-72 h-96 bg-slate-900/40 backdrop-blur-2xl rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden flex flex-col animate-in slide-in-from-right-8 fade-in duration-500 z-50 group hover:shadow-[0_48px_80px_-16px_rgba(0,0,0,0.8)] transition-shadow">
            <div className="bg-blue-600/90 text-white px-4 py-2 text-[10px] font-black flex justify-between items-center uppercase tracking-widest border-b border-white/5 select-none">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                {pipApp.name} Active
              </span>
              <button 
                data-interaction-id="toggle_pip" 
                className="hover:bg-white/20 px-2 py-0.5 rounded transition-colors"
                onClick={() => handleInteraction({id: 'toggle_pip', type: 'generic_click', elementType: 'button', elementText: 'Restore', appContext: pipApp.id})}
              >
                Expand
              </button>
            </div>
            <div className="flex-grow overflow-hidden relative">
              <GeneratedContent
                htmlContent={pipContent}
                onInteract={handleInteraction}
                appContext={pipApp.id}
                isLoading={isLoading && pipContent === ''}
              />
            </div>
          </div>
        )}
      </Window>
      
      {isLoading && !pipApp && (
        <div className="fixed top-12 left-1/2 -translate-x-1-2 px-6 py-3 bg-white/10 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in zoom-in duration-300 z-[100] pointer-events-none select-none">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce"></div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Syncing Kernel State</span>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-12 left-12 max-w-sm bg-red-600/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-red-400/50 animate-in slide-in-from-left-6 fade-in duration-400 z-[101] flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚫</span>
              <span className="font-black uppercase tracking-widest text-[10px]">Critical Alert</span>
            </div>
            <button onClick={() => setError(null)} className="text-white/60 hover:text-white transition-colors">✕</button>
          </div>
          <p className="text-xs font-bold leading-relaxed">{error}</p>
          {(error.includes('quota') || error.includes('Key') || error.includes('entity')) ? (
            <button 
              onClick={() => handleInteraction({id: 'change_api_key', type: 'system', elementType: 'button', elementText: 'Switch Key', appContext: null})}
              className="mt-1 bg-white text-red-600 text-[10px] font-black py-2.5 rounded-xl hover:bg-red-50 transition-colors shadow-lg shadow-black/10 uppercase tracking-widest"
            >
              Switch API Key
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default App;
