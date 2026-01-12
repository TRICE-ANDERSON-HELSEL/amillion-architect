
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useState} from 'react';
import {CacheConfig} from '../types';

interface ParametersPanelProps {
  currentLength: number;
  onUpdateHistoryLength: (newLength: number) => void;
  onClosePanel: () => void;
  isStatefulnessEnabled: boolean;
  onSetStatefulness: (enabled: boolean) => void;
  cacheConfig: CacheConfig;
  onSetCacheConfig: (config: CacheConfig) => void;
  onOpenKeySelector: () => void;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  currentLength,
  onUpdateHistoryLength,
  onClosePanel,
  isStatefulnessEnabled,
  onSetStatefulness,
  cacheConfig,
  onSetCacheConfig,
  onOpenKeySelector,
}) => {
  const [localHistoryLengthInput, setLocalHistoryLengthInput] =
    useState<string>(currentLength.toString());
  const [localStatefulnessChecked, setLocalStatefulnessChecked] =
    useState<boolean>(isStatefulnessEnabled);
  const [localCacheEnabled, setLocalCacheEnabled] = 
    useState<boolean>(cacheConfig.enabled);
  const [localCacheSize, setLocalCacheSize] = 
    useState<number>(cacheConfig.sizeGB);

  useEffect(() => {
    setLocalHistoryLengthInput(currentLength.toString());
  }, [currentLength]);

  useEffect(() => {
    setLocalStatefulnessChecked(isStatefulnessEnabled);
  }, [isStatefulnessEnabled]);

  const handleApplyParameters = () => {
    const newLength = parseInt(localHistoryLengthInput, 10);
    if (!isNaN(newLength) && newLength >= 0 && newLength <= 10) {
      onUpdateHistoryLength(newLength);
    } else {
      alert('Please enter a number between 0 and 10 for history length.');
      setLocalHistoryLengthInput(currentLength.toString());
      return;
    }

    if (localStatefulnessChecked !== isStatefulnessEnabled) {
      onSetStatefulness(localStatefulnessChecked);
    }

    onSetCacheConfig({
      enabled: localCacheEnabled,
      sizeGB: localCacheSize
    });

    onClosePanel();
  };

  return (
    <div className="p-6 bg-gray-50 h-full flex flex-col items-start pt-8 overflow-y-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 w-full max-w-md">Kernel Configuration</h2>

      <div className="w-full max-w-md mb-6">
        <div className="llm-row items-center">
          <label htmlFor="maxHistoryLengthInput" className="llm-label flex-shrink-0" style={{minWidth: '150px'}}>
            Interaction Buffer:
          </label>
          <input
            type="number"
            id="maxHistoryLengthInput"
            value={localHistoryLengthInput}
            onChange={(e) => setLocalHistoryLengthInput(e.target.value)}
            min="0"
            max="10"
            className="llm-input flex-grow"
          />
        </div>
      </div>

      <div className="w-full max-w-md mb-8">
        <div className="llm-row items-center">
          <label htmlFor="statefulnessCheckbox" className="llm-label flex-shrink-0" style={{minWidth: '150px'}}>
            Persistence Layer:
          </label>
          <input
            type="checkbox"
            id="statefulnessCheckbox"
            checked={localStatefulnessChecked}
            onChange={(e) => setLocalStatefulnessChecked(e.target.checked)}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded cursor-pointer"
          />
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 w-full max-w-md">Gemini Security</h2>
      
      <div className="w-full max-w-md mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Switch to your own billable API key to bypass rate limits and enable high-performance Architect modes.
        </p>
        <button 
          onClick={onOpenKeySelector}
          className="w-full bg-slate-900 text-white text-xs font-black py-2.5 rounded-lg hover:bg-slate-800 transition-colors uppercase tracking-widest"
        >
          Manage API Keys
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          className="block text-[10px] text-center mt-3 text-blue-600 hover:underline"
        >
          Billing Documentation
        </a>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2 w-full max-w-md">Disk Management</h2>

      <div className="w-full max-w-md mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-bold text-gray-700">Virtual Disk Partition</label>
          <input 
            type="checkbox" 
            checked={localCacheEnabled}
            onChange={(e) => setLocalCacheEnabled(e.target.checked)}
            className="w-5 h-5 accent-blue-600 cursor-pointer"
          />
        </div>
        
        <div className={localCacheEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}>
          <label className="text-xs font-bold text-gray-600 block mb-2">Partition Size: <span className="text-blue-600">{localCacheSize}GB</span></label>
          <input 
            type="range" 
            min="5" 
            max="20" 
            step="1"
            value={localCacheSize}
            onChange={(e) => setLocalCacheSize(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>5GB</span>
            <span>20GB</span>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full max-w-md flex justify-start gap-3">
        <button onClick={handleApplyParameters} className="llm-button">Apply & Reboot</button>
        <button onClick={onClosePanel} className="llm-button bg-gray-500 hover:bg-gray-600">Cancel</button>
      </div>
    </div>
  );
};
