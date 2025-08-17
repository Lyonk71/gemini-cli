/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { App } from './App.js';
import { UIContext } from './hooks/useUI.js';
import { HistoryItem, StreamingState } from './types.js';
import { EditorType } from '@google/gemini-cli-core';
import process from 'node:process';
import { useHistory } from './hooks/useHistoryManager.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { useAuthCommand } from './hooks/useAuthCommand.js';
import { useEditorSettings } from './hooks/useEditorSettings.js';
import { useSettingsCommand } from './hooks/useSettingsCommand.js';
import { useSlashCommandProcessor } from './hooks/slashCommandProcessor.js';
import { useVimMode, VimModeProvider } from './contexts/VimModeContext.js';
import { SessionStatsProvider } from './contexts/SessionContext.js';
import { useConsoleMessages } from './hooks/useConsoleMessages.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useStdin } from 'ink';
import * as fs from 'fs';
import { useTextBuffer } from './components/shared/text-buffer.js';
import { useLogger } from './hooks/useLogger.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { useVim } from './hooks/vim.js';
import { Config } from '@google/gemini-cli-core';
import { LoadedSettings } from '../config/settings.js';
import { InitializationResult } from '../core/initializer.js';

interface AppContainerProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
  version: string;
  initializationResult: InitializationResult;
}

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
      const currentSessionUserMessages = historyManager.history
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
  }, [historyManager.history, logger]);

  const refreshStatic = useCallback(() => {
    // This will be implemented in a later phase.
  }, []);

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

  const { toggleVimEnabled } = useVimMode();

  const slashCommandActions = useMemo(
    () => ({
      openAuthDialog,
      openThemeDialog,
      openEditorDialog,
      openPrivacyNotice: () => setShowPrivacyNotice(true),
      openSettingsDialog,
      quit: (messages: HistoryItem[]) => {
        setQuittingMessages(messages);
        setTimeout(() => {
          process.exit(0);
        }, 100);
      },
      setDebugMessage,
      toggleCorgiMode: () => setCorgiMode((prev) => !prev),
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
    historyManager.addItem,
    historyManager.clearItems,
    historyManager.loadHistory,
    refreshStatic,
    toggleVimEnabled,
    setIsProcessing,
    setGeminiMdFileCount,
    slashCommandActions,
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
    historyManager.history,
    historyManager.addItem,
    config,
    setDebugMessage,
    handleSlashCommand,
    shellModeActive,
    () => settings.merged.preferredEditor as EditorType,
    openAuthDialog,
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
    historyManager.clearItems();
    clearConsoleMessagesState();
    console.clear();
    refreshStatic();
  }, [historyManager, clearConsoleMessagesState, refreshStatic]);

  const { handleInput: vimHandleInput } = useVim(buffer, handleFinalSubmit);

  const isInputActive =
    streamingState === StreamingState.Idle && !initError && !isProcessing;

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
      handleSlashCommand,
      handleFinalSubmit,
      handleClearScreen,
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
      handleSlashCommand,
      handleFinalSubmit,
      handleClearScreen,
    ],
  );

  return (
    <UIContext.Provider value={uiContextValue}>
      <App
        config={config}
        settings={settings}
        startupWarnings={props.startupWarnings}
        version={props.version}
        history={historyManager.history}
        isThemeDialogOpen={isThemeDialogOpen}
        themeError={themeError}
        handleThemeSelect={handleThemeSelect}
        handleThemeHighlight={handleThemeHighlight}
        isAuthenticating={isAuthenticating}
        authError={authError}
        cancelAuthentication={cancelAuthentication}
        isAuthDialogOpen={isAuthDialogOpen}
        handleAuthSelect={handleAuthSelect}
        editorError={editorError}
        isEditorDialogOpen={isEditorDialogOpen}
        handleEditorSelect={handleEditorSelect}
        exitEditorDialog={exitEditorDialog}
        showPrivacyNotice={showPrivacyNotice}
        corgiMode={corgiMode}
        debugMessage={debugMessage}
        quittingMessages={quittingMessages}
        isSettingsDialogOpen={isSettingsDialogOpen}
        closeSettingsDialog={closeSettingsDialog}
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
        vimHandleInput={vimHandleInput}
        isInputActive={isInputActive}
      />
    </UIContext.Provider>
  );
};
