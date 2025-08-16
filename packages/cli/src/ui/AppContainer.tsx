/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { App } from './App.js';
import { UIContext, useUI } from './hooks/useUI.js';
import { HistoryItem, StreamingState } from './types.js';
import { type Config, EditorType } from '@google/gemini-cli-core';
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
import { useConsoleMessages } from './hooks/useConsoleMessages.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useStdin } from 'ink';
import * as fs from 'fs';
import { useTextBuffer } from './components/shared/text-buffer.js';
import { useLogger } from './hooks/useLogger.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { useVim } from './hooks/vim.js';

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
  setIsProcessing: (isProcessing: boolean) => void;
  setGeminiMdFileCount: (count: number) => void;
}

const AppLogic = (props: AppLogicProps) => {
  const {
    config,
    settings,
    historyManager,
    setShowPrivacyNotice,
    isProcessing,
    geminiMdFileCount,
    ...rest
  } = props;
  const { history, addItem, clearItems, loadHistory, updateItem } =
    historyManager;
  const { toggleVimEnabled } = useVimMode();
  const ui = useUI();

  const [shellModeActive, setShellModeActive] = useState(false);
  const [modelSwitchedFromQuotaError, setModelSwitchedFromQuotaError] =
    useState<boolean>(false);

  const logger = useLogger();
  const [userMessages, setUserMessages] = useState<string[]>([]);

  const { columns: terminalWidth } = useTerminalSize();
  const { stdin, setRawMode } = useStdin();

  const widthFraction = 0.9;
  const inputWidth = Math.max(
    20,
    Math.floor(terminalWidth * widthFraction) - 3,
  );
  const suggestionsWidth = Math.max(20, Math.floor(terminalWidth * 0.8));

  const isValidPath = useCallback((filePath: string): boolean => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (_e) {
      return false;
    }
  }, []);

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { height: 10, width: inputWidth },
    stdin,
    setRawMode,
    isValidPath,
    shellModeActive,
  });

  const handleUserCancel = useCallback(() => {
    const lastUserMessage = userMessages.at(-1);
    if (lastUserMessage) {
      buffer.setText(lastUserMessage);
    }
  }, [userMessages, buffer]);

  useEffect(() => {
    const fetchUserMessages = async () => {
      const pastMessagesRaw = (await logger?.getPreviousUserMessages()) || [];
      const currentSessionUserMessages = history
        .filter(
          (item): item is HistoryItem & { type: 'user'; text: string } =>
            item.type === 'user' &&
            typeof item.text === 'string' &&
            item.text.trim() !== '',
        )
        .map((item) => item.text)
        .reverse();
      const combinedMessages = [
        ...currentSessionUserMessages,
        ...pastMessagesRaw,
      ];
      const deduplicatedMessages: string[] = [];
      if (combinedMessages.length > 0) {
        deduplicatedMessages.push(combinedMessages[0]);
        for (let i = 1; i < combinedMessages.length; i++) {
          if (combinedMessages[i] !== combinedMessages[i - 1]) {
            deduplicatedMessages.push(combinedMessages[i]);
          }
        }
      }
      setUserMessages(deduplicatedMessages.reverse());
    };
    fetchUserMessages();
  }, [history, logger]);

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
    props.setIsProcessing,
    props.setGeminiMdFileCount,
  );

  const {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems: pendingGeminiHistoryItems,
    thought,
    cancelOngoingRequest,
  } = useGeminiStream(
    config.getGeminiClient(),
    history,
    addItem,
    config,
    ui.setDebugMessage,
    handleSlashCommand,
    shellModeActive,
    () => settings.merged.preferredEditor as EditorType,
    ui.openAuthDialog,
    async () => {
      /* performMemoryRefresh */
    },
    modelSwitchedFromQuotaError,
    setModelSwitchedFromQuotaError,
    refreshStatic,
    handleUserCancel,
  );

  const handleFinalSubmit = useCallback(
    (submittedValue: string) => {
      const trimmedValue = submittedValue.trim();
      if (trimmedValue.length > 0) {
        submitQuery(trimmedValue);
      }
    },
    [submitQuery],
  );

  const handleClearScreen = useCallback(() => {
    clearItems();
    ui.clearConsoleMessages();
    console.clear();
    refreshStatic();
  }, [clearItems, ui, refreshStatic]);

  const { handleInput: vimHandleInput } = useVim(buffer, handleFinalSubmit);

  const isInputActive =
    streamingState === StreamingState.Idle && !initError && !isProcessing;

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
      streamingState={streamingState}
      initError={initError}
      pendingGeminiHistoryItems={pendingGeminiHistoryItems}
      thought={thought}
      cancelOngoingRequest={cancelOngoingRequest}
      shellModeActive={shellModeActive}
      setShellModeActive={setShellModeActive}
      userMessages={userMessages}
      buffer={buffer}
      inputWidth={inputWidth}
      suggestionsWidth={suggestionsWidth}
      handleFinalSubmit={handleFinalSubmit}
      handleClearScreen={handleClearScreen}
      vimHandleInput={vimHandleInput}
      isInputActive={isInputActive}
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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [geminiMdFileCount, setGeminiMdFileCount] = useState<number>(0);

  const {
    consoleMessages,
    handleNewMessage,
    clearConsoleMessages: clearConsoleMessagesState,
  } = useConsoleMessages();

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
      consoleMessages,
      handleNewMessage,
      clearConsoleMessages: clearConsoleMessagesState,
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
      consoleMessages,
      handleNewMessage,
      clearConsoleMessagesState,
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
            isProcessing={isProcessing}
            geminiMdFileCount={geminiMdFileCount}
            setIsProcessing={setIsProcessing}
            setGeminiMdFileCount={setGeminiMdFileCount}
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