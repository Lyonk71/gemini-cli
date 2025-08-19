/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext } from 'react';
import {
  HistoryItem,
  StreamingState,
  ThoughtSummary,
  ConsoleMessageItem,
  ShellConfirmationRequest,
  ConfirmationRequest,
  HistoryItemWithoutId,
} from '../types.js';
import { type CommandContext, type SlashCommand } from '../commands/types.js';
import { TextBuffer } from '../components/shared/text-buffer.js';
import { IdeContext } from '@google/gemini-cli-core';

export interface UIState {
  history: HistoryItem[];
  isThemeDialogOpen: boolean;
  themeError: string | null;
  isAuthenticating: boolean;
  authError: string | null;
  isAuthDialogOpen: boolean;
  editorError: string | null;
  isEditorDialogOpen: boolean;
  showPrivacyNotice: boolean;
  corgiMode: boolean;
  debugMessage: string;
  quittingMessages: HistoryItem[] | null;
  isSettingsDialogOpen: boolean;
  slashCommands: readonly SlashCommand[];
  pendingSlashCommandHistoryItems: HistoryItemWithoutId[];
  commandContext: CommandContext;
  shellConfirmationRequest: ShellConfirmationRequest | null;
  confirmationRequest: ConfirmationRequest | null;
  geminiMdFileCount: number;
  streamingState: StreamingState;
  initError: string | null;
  pendingGeminiHistoryItems: HistoryItemWithoutId[];
  thought: ThoughtSummary | null;
  shellModeActive: boolean;
  userMessages: string[];
  buffer: TextBuffer;
  inputWidth: number;
  suggestionsWidth: number;
  isInputActive: boolean;
  shouldShowIdePrompt: boolean;
  isFolderTrustDialogOpen: boolean;
  constrainHeight: boolean;
  showErrorDetails: boolean;
  filteredConsoleMessages: ConsoleMessageItem[];
  ideContextState: IdeContext | undefined;
  showToolDescriptions: boolean;
  ctrlCPressedOnce: boolean;
  ctrlDPressedOnce: boolean;
  showEscapePrompt: boolean;
  isFocused: boolean;
  elapsedTime: string;
  currentLoadingPhrase: string;
}

export const UIStateContext = createContext<UIState | null>(null);

export const useUIState = () => {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
};
