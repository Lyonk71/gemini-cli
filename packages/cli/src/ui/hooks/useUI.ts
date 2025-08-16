/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext } from 'react';
import { ConsoleMessageItem, HistoryItem } from '../types.js';

export interface UIContextActions {
  openHelp: () => void;
  openAuthDialog: () => void;
  openThemeDialog: () => void;
  openEditorDialog: () => void;
  openSettingsDialog: () => void;
  openPrivacyNotice: () => void;
  toggleCorgiMode: () => void;
  setDebugMessage: (message: string) => void;
  quit: (messages: HistoryItem[]) => void;
  consoleMessages: ConsoleMessageItem[];
  handleNewMessage: (message: ConsoleMessageItem) => void;
  clearConsoleMessages: () => void;
}

export const UIContext = createContext<UIContextActions | null>(null);

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
