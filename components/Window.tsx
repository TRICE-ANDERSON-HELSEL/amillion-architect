
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React from 'react';
import {CacheConfig} from '../types';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAppOpen: boolean;
  appId?: string | null;
  onToggleParameters: () => void;
  onExitToDesktop: () => void;
  isParametersPanelOpen?: boolean;
  cacheConfig?: CacheConfig;
}

const MenuItem: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({children, onClick, className}) => (
  <span
    className={`menu-item cursor-pointer hover:text-blue-600 ${className}`}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onClick?.();
    }}
    tabIndex={0}
    role="button">
    {children}
  </span>
);

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  onClose,
  isAppOpen,
  onToggleParameters,
  onExitToDesktop,
  isParametersPanelOpen,
  cacheConfig,
}) => {
  return (
    <div className="w-[800px] h-[600px] bg-white border border-gray-300 rounded-xl shadow-2xl flex flex-col relative overflow-hidden font-sans backdrop-blur-sm bg-white/80">
      {/* Title Bar */}
      <div className="bg-gray-800/90 text-white py-2 px-4 font-semibold text-base flex justify-between items-center select-none cursor-default rounded-t-xl flex-shrink-0">
        <span className="title-bar-text">{title}</span>
      </div>

      {/* Menu Bar */}
      <div className="bg-gray-100/80 py-2 px-3 border-b border-gray-200 select-none flex gap-4 flex-shrink-0 text-sm text-gray-700 items-center">
        {!isParametersPanelOpen && (
          <MenuItem onClick={onToggleParameters}>
            <u>P</u>arameters
          </MenuItem>
        )}
        {isAppOpen && (
          <MenuItem onClick={onExitToDesktop} className="ml-auto">
            Exit to Desktop
          </MenuItem>
        )}
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto">{children}</div>

      {/* Status Bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-1 flex justify-between items-center text-[10px] text-gray-500 font-mono select-none">
        <div className="flex items-center gap-3">
          <span>Ready</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            DISK: {cacheConfig?.enabled ? (
              <span className="text-green-600 font-bold uppercase">Online ({cacheConfig.sizeGB}GB)</span>
            ) : (
              <span className="text-gray-400">Offline</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};
