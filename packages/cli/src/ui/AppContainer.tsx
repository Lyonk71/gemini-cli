/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { App } from './App.js';
import {
  UIStateContext,
  useUIState,
  UIState,
} from './contexts/UIStateContext.js';
import {
  UIActionsContext,
  UIActions,
} from './contexts/UIActionsContext.js';
import { ConfigContext } from './contexts/ConfigContext.js';
import { SettingsContext } from './contexts/SettingsContext.js';
import { HistoryItem, StreamingState } from './types.js';
import {
  EditorType,
  Config,
  ideContext,
  IdeContext,
} from '@google/gemini-cli-core';
import process from 'node:process';
import { useHistory } from './hooks/useHistoryManager.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { useAuthCommand } from './hooks/useAuthCommand.js';
import { useEditorSettings } from './hooks/useEditorSettings.js';
import { useSettingsCommand } from './hooks/useSettingsCommand.js';
import { useSlashCommandProcessor } from './hooks/slashCommandProcessor.js';
import { useVimMode } from './contexts/VimModeContext.js';
import { useConsoleMessages } from './hooks/useConsoleMessages.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useStdin } from 'ink';
import * as fs from 'fs';
import { useTextBuffer } from './components/shared/text-buffer.js';
import { useLogger } from './hooks/useLogger.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { useVim } from './hooks/vim.js';
import { LoadedSettings, SettingScope } from '../config/settings.js';
import { InitializationResult } from '../core/initializer.js';
import { useFocus } from './hooks/useFocus.js';
import { useBracketedPaste } from './hooks/useBracketedPaste.js';
import { useKeypress, Key } from './hooks/useKeypress.js';
import { keyMatchers, Command } from './keyMatchers.js';
import { useLoadingIndicator } from './hooks/useLoadingIndicator.js';
import { FolderTrustChoice } from './components/FolderTrustDialog.js';
import { useFolderTrust } from './hooks/useFolderTrust.js';
import { IdeIntegrationNudgeResult } from './IdeIntegrationNudge.js';
import { appEvents, AppEvent } from '../utils/events.js';

const CTRL_EXIT_PROMPT_DURATION_MS = 1000;

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

  // New state and logic moved from App.tsx
  const isFocused = useFocus();
  useBracketedPaste();

  const [idePromptAnswered, setIdePromptAnswered] = useState(false);
  const currentIDE = config.getIdeClient().getCurrentIde();
  const shouldShowIdePrompt = Boolean(
    config.getIdeModeFeature() &&
    currentIDE &&
    !config.getIdeMode() &&
    !settings.merged.hasSeenIdeIntegrationNudge &&
    !idePromptAnswered
  );

  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [showToolDescriptions, setShowToolDescriptions] =
    useState<boolean>(false);

  const [ctrlCPressedOnce, setCtrlCPressedOnce] = useState(false);
  const ctrlCTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [ctrlDPressedOnce, setCtrlDPressedOnce] = useState(false);
  const ctrlDTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [constrainHeight, setConstrainHeight] = useState<boolean>(true);
  const [ideContextState, setIdeContextState] = useState<
    IdeContext | undefined
  >();
  const [showEscapePrompt, setShowEscapePrompt] = useState(false);

  const { isFolderTrustDialogOpen, handleFolderTrustSelect } =
    useFolderTrust(settings);

  useEffect(() => {
    const unsubscribe = ideContext.subscribeToIdeContext(setIdeContextState);
    setIdeContextState(ideContext.getIdeContext());
    return unsubscribe;
  }, []);

  useEffect(() => {
    const openDebugConsole = () => {
      setShowErrorDetails(true);
      setConstrainHeight(false);
    };
    appEvents.on(AppEvent.OpenDebugConsole, openDebugConsole);

    const logErrorHandler = (errorMessage: unknown) => {
      handleNewMessage({
        type: 'error',
        content: String(errorMessage),
        count: 1,
      });
    };
    appEvents.on(AppEvent.LogError, logErrorHandler);

    return () => {
      appEvents.off(AppEvent.OpenDebugConsole, openDebugConsole);
      appEvents.off(AppEvent.LogError, logErrorHandler);
    };
  }, [handleNewMessage]);

  const handleEscapePromptChange = useCallback((showPrompt: boolean) => {
    setShowEscapePrompt(showPrompt);
  }, []);

  const handleIdePromptComplete = useCallback(
    (result: IdeIntegrationNudgeResult) => {
      if (result === 'yes') {
        handleSlashCommand('/ide install');
        settings.setValue(
          SettingScope.User,
          'hasSeenIdeIntegrationNudge',
          true,
        );
      } else if (result === 'dismiss') {
        settings.setValue(
          SettingScope.User,
          'hasSeenIdeIntegrationNudge',
          true,
        );
      }
      setIdePromptAnswered(true);
    },
    [handleSlashCommand, settings],
  );

  const { elapsedTime, currentLoadingPhrase } =
    useLoadingIndicator(streamingState);

  const handleExit = useCallback(
    (
      pressedOnce: boolean,
      setPressedOnce: (value: boolean) => void,
      timerRef: React.MutableRefObject<NodeJS.Timeout | null>,
    ) => {
      if (pressedOnce) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        handleSlashCommand('/quit');
      } else {
        setPressedOnce(true);
        timerRef.current = setTimeout(() => {
          setPressedOnce(false);
          timerRef.current = null;
        }, CTRL_EXIT_PROMPT_DURATION_MS);
      }
    },
    [handleSlashCommand],
  );

  const handleGlobalKeypress = useCallback(
    (key: Key) => {
      let enteringConstrainHeightMode = false;
      if (!constrainHeight) {
        enteringConstrainHeightMode = true;
        setConstrainHeight(true);
      }

      if (keyMatchers[Command.SHOW_ERROR_DETAILS](key)) {
        setShowErrorDetails((prev) => !prev);
      } else if (keyMatchers[Command.TOGGLE_TOOL_DESCRIPTIONS](key)) {
        const newValue = !showToolDescriptions;
        setShowToolDescriptions(newValue);

        const mcpServers = config.getMcpServers();
        if (Object.keys(mcpServers || {}).length > 0) {
          handleSlashCommand(newValue ? '/mcp desc' : '/mcp nodesc');
        }
      } else if (
        keyMatchers[Command.TOGGLE_IDE_CONTEXT_DETAIL](key) &&
        config.getIdeMode() &&
        ideContextState
      ) {
        handleSlashCommand('/ide status');
      } else if (keyMatchers[Command.QUIT](key)) {
        if (isAuthenticating) {
          return;
        }
        if (!ctrlCPressedOnce) {
          cancelOngoingRequest?.();
        }
        handleExit(ctrlCPressedOnce, setCtrlCPressedOnce, ctrlCTimerRef);
      } else if (keyMatchers[Command.EXIT](key)) {
        if (buffer.text.length > 0) {
          return;
        }
        handleExit(ctrlDPressedOnce, setCtrlDPressedOnce, ctrlDTimerRef);
      } else if (
        keyMatchers[Command.SHOW_MORE_LINES](key) &&
        !enteringConstrainHeightMode
      ) {
        setConstrainHeight(false);
      }
    },
    [
      constrainHeight,
      setConstrainHeight,
      setShowErrorDetails,
      showToolDescriptions,
      setShowToolDescriptions,
      config,
      ideContextState,
      handleExit,
      ctrlCPressedOnce,
      setCtrlCPressedOnce,
      ctrlCTimerRef,
      buffer.text.length,
      ctrlDPressedOnce,
      setCtrlDPressedOnce,
      ctrlDTimerRef,
      handleSlashCommand,
      isAuthenticating,
      cancelOngoingRequest,
    ],
  );

  useKeypress(handleGlobalKeypress, { isActive: true });

  const filteredConsoleMessages = useMemo(() => {
    if (config.getDebugMode()) {
      return consoleMessages;
    }
    return consoleMessages.filter((msg) => msg.type !== 'debug');
  }, [consoleMessages, config]);

  const uiState: UIState = useMemo(
    () => ({
      history: historyManager.history,
      isThemeDialogOpen,
      themeError,
      isAuthenticating,
      authError,
      isAuthDialogOpen,
      editorError,
      isEditorDialogOpen,
      showPrivacyNotice,
      corgiMode,
      debugMessage,
      quittingMessages,
      isSettingsDialogOpen,
      slashCommands,
      pendingSlashCommandHistoryItems,
      commandContext,
      shellConfirmationRequest,
      confirmationRequest,
      geminiMdFileCount,
      streamingState,
      initError,
      pendingGeminiHistoryItems,
      thought,
      shellModeActive,
      userMessages,
      buffer,
      inputWidth,
      suggestionsWidth,
      isInputActive,
      shouldShowIdePrompt,
      isFolderTrustDialogOpen: isFolderTrustDialogOpen ?? false,
      constrainHeight,
      showErrorDetails,
      filteredConsoleMessages,
      ideContextState,
      showToolDescriptions,
      ctrlCPressedOnce,
      ctrlDPressedOnce,
      showEscapePrompt,
      isFocused,
      elapsedTime: elapsedTime.toString(),
      currentLoadingPhrase,
    }),
    [
      historyManager.history,
      isThemeDialogOpen,
      themeError,
      isAuthenticating,
      authError,
      isAuthDialogOpen,
      editorError,
      isEditorDialogOpen,
      showPrivacyNotice,
      corgiMode,
      debugMessage,
      quittingMessages,
      isSettingsDialogOpen,
      slashCommands,
      pendingSlashCommandHistoryItems,
      commandContext,
      shellConfirmationRequest,
      confirmationRequest,
      geminiMdFileCount,
      streamingState,
      initError,
      pendingGeminiHistoryItems,
      thought,
      shellModeActive,
      userMessages,
      buffer,
      inputWidth,
      suggestionsWidth,
      isInputActive,
      shouldShowIdePrompt,
      isFolderTrustDialogOpen,
      constrainHeight,
      showErrorDetails,
      filteredConsoleMessages,
      ideContextState,
      showToolDescriptions,
      ctrlCPressedOnce,
      ctrlDPressedOnce,
      showEscapePrompt,
      isFocused,
      elapsedTime,
      currentLoadingPhrase,
    ],
  );

  const uiActions: UIActions = useMemo(
    () => ({
      handleThemeSelect,
      handleThemeHighlight,
      handleAuthSelect,
      handleEditorSelect,
      exitEditorDialog,
      exitPrivacyNotice: () => setShowPrivacyNotice(false),
      closeSettingsDialog,
      setShellModeActive,
      vimHandleInput,
      handleIdePromptComplete,
      handleFolderTrustSelect,
      setConstrainHeight,
      onEscapePromptChange: handleEscapePromptChange,
      refreshStatic,
      handleFinalSubmit,
      handleClearScreen,
    }),
    [
      handleThemeSelect,
      handleThemeHighlight,
      handleAuthSelect,
      handleEditorSelect,
      exitEditorDialog,
      closeSettingsDialog,
      setShellModeActive,
      vimHandleInput,
      handleIdePromptComplete,
      handleFolderTrustSelect,
      setConstrainHeight,
      handleEscapePromptChange,
      refreshStatic,
      handleFinalSubmit,
      handleClearScreen,
    ],
  );

  return (
    <UIStateContext.Provider value={uiState}>
      <UIActionsContext.Provider value={uiActions}>
        <ConfigContext.Provider value={config}>
          <SettingsContext.Provider value={settings}>
            <App
              startupWarnings={props.startupWarnings}
              version={props.version}
            />
          </SettingsContext.Provider>
        </ConfigContext.Provider>
      </UIActionsContext.Provider>
    </UIStateContext.Provider>
  );
};