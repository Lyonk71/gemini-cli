/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useCallback } from 'react';
import { App } from './App.js';
import { UIContext } from './hooks/useUI.js';
import { type HistoryItem } from './types.js';
import { type Config } from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import process from 'node:process';
import {
  useHistory,
  UseHistoryManagerReturn,
} from './hooks/useHistoryManager.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { useAuthCommand } from './hooks/useAuthCommand.js';
import { useEditorSettings } from './hooks/useEditorSettings.js';
import { useSettingsCommand } from './hooks/useSettingsCommand.js';
import { useSlashCommandProcessor } from './hooks/slashCommandProcessor.js';
import { useVimMode, VimModeProvider } from './contexts/VimModeContext.js';
import { SessionStatsProvider } from './contexts/SessionContext.js';
import { InitializationResult } from '../core/initializer.js';

interface AppContainerProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
  version: string;
  initializationResult: InitializationResult;
}

interface AppLogicProps extends AppContainerProps {
  historyManager: UseHistoryManagerReturn;
  corgiMode: boolean;
  debugMessage: string;
  quittingMessages: HistoryItem[] | null;
  showPrivacyNotice: boolean;
  themeError: string | null;
  authError: string | null;
  editorError: string | null;
  isProcessing: boolean;
  geminiMdFileCount: number;
  isThemeDialogOpen: boolean;
  isAuthDialogOpen: boolean;
  isEditorDialogOpen: boolean;
  isSettingsDialogOpen: boolean;
  openThemeDialog: () => void;
  handleThemeSelect: (
    themeName: string | undefined,
    scope: import('../config/settings.js').SettingScope,
  ) => void;
  handleThemeHighlight: (themeName: string | undefined) => void;
  openAuthDialog: () => void;
  handleAuthSelect: (
    authType: import('@google/gemini-cli-core').AuthType | undefined,
    scope: import('../config/settings.js').SettingScope,
  ) => void;
  isAuthenticating: boolean;
  cancelAuthentication: () => void;
  openEditorDialog: () => void;
  handleEditorSelect: (
    editorType: import('@google/gemini-cli-core').EditorType | undefined,
    scope: import('../config/settings.js').SettingScope,
  ) => void;
  exitEditorDialog: () => void;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
  setShowPrivacyNotice: (show: boolean) => void;
}

const AppLogic = (props: AppLogicProps) => {
  const { config, settings, historyManager, setShowPrivacyNotice, ...rest } =
    props;
  const { addItem, clearItems, loadHistory } = historyManager;
  const { toggleVimEnabled } = useVimMode();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [geminiMdFileCount, setGeminiMdFileCount] = useState<number>(0);

  const refreshStatic = useCallback(() => {
    // This will be implemented in a later phase.
  }, []);

  const {
    handleSlashCommand,
    slashCommands,
    pendingHistoryItems: pendingSlashCommandHistoryItems,
    commandContext,
    shellConfirmationRequest,
    confirmationRequest,
  } = useSlashCommandProcessor(
    config,
    settings,
    addItem,
    clearItems,
    loadHistory,
    refreshStatic,
    toggleVimEnabled,
    setIsProcessing,
    setGeminiMdFileCount,
  );

  return (
    <App
      {...rest}
      config={config}
      settings={settings}
      history={historyManager.history}
      addItem={historyManager.addItem}
      clearItems={historyManager.clearItems}
      loadHistory={historyManager.loadHistory}
      updateItem={historyManager.updateItem}
      setShowPrivacyNotice={setShowPrivacyNotice}
      handleSlashCommand={handleSlashCommand}
      slashCommands={slashCommands}
      pendingSlashCommandHistoryItems={pendingSlashCommandHistoryItems}
      commandContext={commandContext}
      shellConfirmationRequest={shellConfirmationRequest}
      confirmationRequest={confirmationRequest}
      isProcessing={isProcessing}
      geminiMdFileCount={geminiMdFileCount}
      refreshStatic={refreshStatic}
    />
  );
};

export const AppContainer = (props: AppContainerProps) => {
  const { settings, config, initializationResult } = props;
  const historyManager = useHistory();
  const [corgiMode, setCorgiMode] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [quittingMessages, setQuittingMessages] = useState<
    HistoryItem[] | null
  >(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(false);
  const [themeError, setThemeError] = useState<string | null>(
    initializationResult.themeError,
  );
  const [authError, setAuthError] = useState<string | null>(
    initializationResult.authError,
  );
  const [editorError, setEditorError] = useState<string | null>(null);

  const {
    isThemeDialogOpen,
    openThemeDialog,
    handleThemeSelect,
    handleThemeHighlight,
  } = useThemeCommand(
    settings,
    setThemeError,
    historyManager.addItem,
    initializationResult.themeError,
  );

  const {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    isAuthenticating,
    cancelAuthentication,
  } = useAuthCommand(
    settings,
    setAuthError,
    config,
    initializationResult.shouldOpenAuthDialog,
  );

  const {
    isEditorDialogOpen,
    openEditorDialog,
    handleEditorSelect,
    exitEditorDialog,
  } = useEditorSettings(settings, setEditorError, historyManager.addItem);

  const { isSettingsDialogOpen, openSettingsDialog, closeSettingsDialog } =
    useSettingsCommand();

  const uiContextValue = useMemo(
    () => ({
      openHelp: () => {
        // This will be wired up to the slash command processor later
      },
      openAuthDialog,
      openThemeDialog,
      openEditorDialog,
      openSettingsDialog,
      openPrivacyNotice: () => setShowPrivacyNotice(true),
      toggleCorgiMode: () => setCorgiMode((prev) => !prev),
      setDebugMessage,
      quit: (messages: HistoryItem[]) => {
        setQuittingMessages(messages);
        setTimeout(() => {
          process.exit(0);
        }, 100);
      },
    }),
    [
      openAuthDialog,
      openThemeDialog,
      openEditorDialog,
      openSettingsDialog,
      setQuittingMessages,
      setDebugMessage,
      setShowPrivacyNotice,
      setCorgiMode,
    ],
  );

  return (
    <SessionStatsProvider>
      <VimModeProvider settings={props.settings}>
        <UIContext.Provider value={uiContextValue}>
          <AppLogic
            {...props}
            historyManager={historyManager}
            corgiMode={corgiMode}
            debugMessage={debugMessage}
            quittingMessages={quittingMessages}
            showPrivacyNotice={showPrivacyNotice}
            themeError={themeError}
            authError={authError}
            editorError={editorError}
            isProcessing={false}
            geminiMdFileCount={0}
            isThemeDialogOpen={isThemeDialogOpen}
            isAuthDialogOpen={isAuthDialogOpen}
            isEditorDialogOpen={isEditorDialogOpen}
            isSettingsDialogOpen={isSettingsDialogOpen}
            openThemeDialog={openThemeDialog}
            handleThemeSelect={handleThemeSelect}
            handleThemeHighlight={handleThemeHighlight}
            openAuthDialog={openAuthDialog}
            handleAuthSelect={handleAuthSelect}
            isAuthenticating={isAuthenticating}
            cancelAuthentication={cancelAuthentication}
            openEditorDialog={openEditorDialog}
            handleEditorSelect={handleEditorSelect}
            exitEditorDialog={exitEditorDialog}
            openSettingsDialog={openSettingsDialog}
            closeSettingsDialog={closeSettingsDialog}
            setShowPrivacyNotice={setShowPrivacyNotice}
          />
        </UIContext.Provider>
      </VimModeProvider>
    </SessionStatsProvider>
  );
};