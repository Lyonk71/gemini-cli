/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Box, DOMElement, measureElement, Static, Text } from 'ink';
import {
  StreamingState,
  type HistoryItem,
  type HistoryItemWithoutId,
  ThoughtSummary,
} from './types.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useLoadingIndicator } from './hooks/useLoadingIndicator.js';
import { useAutoAcceptIndicator } from './hooks/useAutoAcceptIndicator.js';
import { Header } from './components/Header.js';
import { LoadingIndicator } from './components/LoadingIndicator.js';
import { AutoAcceptIndicator } from './components/AutoAcceptIndicator.js';
import { ShellModeIndicator } from './components/ShellModeIndicator.js';
import { InputPrompt } from './components/InputPrompt.js';
import { Footer } from './components/Footer.js';
import { ThemeDialog } from './components/ThemeDialog.js';
import { AuthDialog } from './components/AuthDialog.js';
import { AuthInProgress } from './components/AuthInProgress.js';
import { EditorSettingsDialog } from './components/EditorSettingsDialog.js';
import { FolderTrustDialog } from './components/FolderTrustDialog.js';
import { ShellConfirmationDialog } from './components/ShellConfirmationDialog.js';
import { RadioButtonSelect } from './components/shared/RadioButtonSelect.js';
import { Colors } from './colors.js';
import { LoadedSettings, SettingScope } from '../config/settings.js';
import { Tips } from './components/Tips.js';
import { DetailedMessagesDisplay } from './components/DetailedMessagesDisplay.js';
import { HistoryItemDisplay } from './components/HistoryItemDisplay.js';
import { ContextSummaryDisplay } from './components/ContextSummaryDisplay.js';
import {
  type Config,
  getAllGeminiMdFilenames,
  ApprovalMode,
  EditorType,
  AuthType,
  type IdeContext,
  ideContext,
  ToolConfirmationOutcome,
} from '@google/gemini-cli-core';
import {
  IdeIntegrationNudge,
  IdeIntegrationNudgeResult,
} from './IdeIntegrationNudge.js';
import { StreamingContext } from './contexts/StreamingContext.js';
import { useSessionStats } from './contexts/SessionContext.js';
import { useGitBranchName } from './hooks/useGitBranchName.js';
import { useFocus } from './hooks/useFocus.js';
import { useBracketedPaste } from './hooks/useBracketedPaste.js';
import { TextBuffer } from './components/shared/text-buffer.js';
import { useKeypress, Key } from './hooks/useKeypress.js';
import { keyMatchers, Command } from './keyMatchers.js';
import { OverflowProvider } from './contexts/OverflowContext.js';
import { ShowMoreLines } from './components/ShowMoreLines.js';
import { PrivacyNotice } from './privacy/PrivacyNotice.js';
import { SettingsDialog } from './components/SettingsDialog.js';
import { appEvents, AppEvent } from '../utils/events.js';
import { isNarrowWidth } from './utils/isNarrowWidth.js';
import { useUI } from './hooks/useUI.js';
import { useVimMode } from './contexts/VimModeContext.js';
import { useFolderTrust } from './hooks/useFolderTrust.js';
import { type CommandContext, type SlashCommand } from './commands/types.js';

const CTRL_EXIT_PROMPT_DURATION_MS = 1000;

interface AppProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
  version: string;
  history: HistoryItem[];
  isThemeDialogOpen: boolean;
  themeError: string | null;
  handleThemeSelect: (
    themeName: string | undefined,
    scope: SettingScope,
  ) => void;
  handleThemeHighlight: (themeName: string | undefined) => void;
  isAuthenticating: boolean;
  authError: string | null;
  cancelAuthentication: () => void;
  isAuthDialogOpen: boolean;
  handleAuthSelect: (
    authType: AuthType | undefined,
    scope: SettingScope,
  ) => void;
  editorError: string | null;
  isEditorDialogOpen: boolean;
  handleEditorSelect: (
    editorType: EditorType | undefined,
    scope: SettingScope,
  ) => void;
  exitEditorDialog: () => void;
  showPrivacyNotice: boolean;
  corgiMode: boolean;
  debugMessage: string;
  quittingMessages: HistoryItem[] | null;
  isSettingsDialogOpen: boolean;
  closeSettingsDialog: () => void;
  slashCommands: readonly SlashCommand[];
  pendingSlashCommandHistoryItems: HistoryItemWithoutId[];
  commandContext: CommandContext;
  shellConfirmationRequest: {
    commands: string[];
    onConfirm: (
      outcome: ToolConfirmationOutcome,
      approvedCommands?: string[] | undefined,
    ) => void;
  } | null;
  confirmationRequest: {
    prompt: React.ReactNode;
    onConfirm: (confirmed: boolean) => void;
  } | null;
  isProcessing: boolean;
  geminiMdFileCount: number;
  refreshStatic: () => void;
  streamingState: StreamingState;
  initError: string | null;
  pendingGeminiHistoryItems: HistoryItemWithoutId[];
  thought: ThoughtSummary | null;
  cancelOngoingRequest?: () => void;
  shellModeActive: boolean;
  setShellModeActive: (value: boolean) => void;
  userMessages: string[];
  buffer: TextBuffer;
  inputWidth: number;
  suggestionsWidth: number;
  vimHandleInput: (key: Key) => boolean;
  isInputActive: boolean;
}

export const App = (props: AppProps) => {
  const {
    config,
    settings,
    startupWarnings = [],
    version,
    history,
    isThemeDialogOpen,
    themeError,
    handleThemeSelect,
    handleThemeHighlight,
    isAuthenticating,
    authError,
    isAuthDialogOpen,
    handleAuthSelect,
    editorError,
    isEditorDialogOpen,
    handleEditorSelect,
    exitEditorDialog,
    showPrivacyNotice,
    corgiMode,
    debugMessage,
    quittingMessages,
    isSettingsDialogOpen,
    closeSettingsDialog,
    slashCommands,
    pendingSlashCommandHistoryItems,
    commandContext,
    shellConfirmationRequest,
    confirmationRequest,
    geminiMdFileCount,
    refreshStatic,
    streamingState,
    initError,
    pendingGeminiHistoryItems,
    thought,
    cancelOngoingRequest,
    shellModeActive,
    setShellModeActive,
    userMessages,
    buffer,
    inputWidth,
    suggestionsWidth,
    vimHandleInput,
    isInputActive,
  } = props;

  const ui = useUI();
  const isFocused = useFocus();
  useBracketedPaste();
  const nightly = version.includes('nightly');

  const { consoleMessages, handleNewMessage, handleSlashCommand } = ui;

  const [idePromptAnswered, setIdePromptAnswered] = useState(false);
  const currentIDE = config.getIdeClient().getCurrentIde();
  const shouldShowIdePrompt =
    config.getIdeModeFeature() &&
    currentIDE &&
    !config.getIdeMode() &&
    !settings.merged.hasSeenIdeIntegrationNudge &&
    !idePromptAnswered;

  const { stats: sessionStats } = useSessionStats();
  const [staticNeedsRefresh, setStaticNeedsRefresh] = useState(false);

  const [currentModel, setCurrentModel] = useState(config.getModel());
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

  const { vimEnabled, vimMode } = useVimMode();

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

  const initialPromptSubmitted = useRef(false);

  const errorCount = useMemo(
    () =>
      consoleMessages
        .filter((msg) => msg.type === 'error')
        .reduce((total, msg) => total + msg.count, 0),
    [consoleMessages],
  );

  useEffect(() => {
    const checkModelChange = () => {
      const configModel = config.getModel();
      if (configModel !== currentModel) {
        setCurrentModel(configModel);
      }
    };

    const interval = setInterval(checkModelChange, 1000);
    return () => clearInterval(interval);
  }, [config, currentModel]);

  const { rows: terminalHeight, columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);
  const isInitialMount = useRef(true);

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

  const pendingHistoryItems = [
    ...pendingSlashCommandHistoryItems,
    ...pendingGeminiHistoryItems,
  ];

  const { elapsedTime, currentLoadingPhrase } =
    useLoadingIndicator(streamingState);
  const showAutoAcceptIndicator = useAutoAcceptIndicator({ config });

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

  const mainControlsRef = useRef<DOMElement>(null);
  const pendingHistoryItemRef = useRef<DOMElement>(null);

  const staticExtraHeight = 3;
  const availableTerminalHeight = useMemo(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      return terminalHeight - fullFooterMeasurement.height - staticExtraHeight;
    }
    return terminalHeight - staticExtraHeight;
  }, [terminalHeight]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const handler = setTimeout(() => {
      setStaticNeedsRefresh(false);
      refreshStatic();
    }, 300);
    return () => clearTimeout(handler);
  }, [terminalWidth, terminalHeight, refreshStatic]);

  useEffect(() => {
    if (streamingState === StreamingState.Idle && staticNeedsRefresh) {
      setStaticNeedsRefresh(false);
      refreshStatic();
    }
  }, [streamingState, refreshStatic, staticNeedsRefresh]);

  const filteredConsoleMessages = useMemo(() => {
    if (config.getDebugMode()) {
      return consoleMessages;
    }
    return consoleMessages.filter((msg) => msg.type !== 'debug');
  }, [consoleMessages, config]);

  const branchName = useGitBranchName(config.getTargetDir());

  const contextFileNames = useMemo(() => {
    const fromSettings = settings.merged.contextFileName;
    return fromSettings
      ? Array.isArray(fromSettings)
        ? fromSettings
        : [fromSettings]
      : getAllGeminiMdFilenames();
  }, [settings.merged.contextFileName]);

  const initialPrompt = useMemo(() => config.getQuestion(), [config]);
  const geminiClient = config.getGeminiClient();

  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSubmitted.current &&
      !isAuthenticating &&
      !isAuthDialogOpen &&
      !isThemeDialogOpen &&
      !isEditorDialogOpen &&
      !showPrivacyNotice &&
      geminiClient?.isInitialized?.()
    ) {
      ui.handleFinalSubmit(initialPrompt);
      initialPromptSubmitted.current = true;
    }
  }, [
    initialPrompt,
    ui,
    isAuthenticating,
    isAuthDialogOpen,
    isThemeDialogOpen,
    isEditorDialogOpen,
    showPrivacyNotice,
    geminiClient,
  ]);

  if (quittingMessages) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {quittingMessages.map((item) => (
          <HistoryItemDisplay
            key={item.id}
            availableTerminalHeight={
              constrainHeight ? availableTerminalHeight : undefined
            }
            terminalWidth={terminalWidth}
            item={item}
            isPending={false}
            config={config}
          />
        ))}
      </Box>
    );
  }

  const mainAreaWidth = Math.floor(terminalWidth * 0.9);
  const debugConsoleMaxHeight = Math.floor(Math.max(terminalHeight * 0.2, 5));
  const staticAreaMaxItemHeight = Math.max(terminalHeight * 4, 100);
  const placeholder = vimEnabled
    ? "  Press 'i' for INSERT mode and 'Esc' for NORMAL mode."
    : '  Type your message or @path/to/file';

  return (
    <StreamingContext.Provider value={streamingState}>
      <Box flexDirection="column" width="90%">
        <Static
          items={[
            <Box flexDirection="column" key="header">
              {!settings.merged.hideBanner && (
                <Header version={version} nightly={nightly} />
              )}
              {!settings.merged.hideTips && <Tips config={config} />}
            </Box>,
            ...history.map((h) => (
              <HistoryItemDisplay
                terminalWidth={mainAreaWidth}
                availableTerminalHeight={staticAreaMaxItemHeight}
                key={h.id}
                item={h}
                isPending={false}
                config={config}
                commands={slashCommands}
              />
            )),
          ]}
        >
          {(item) => item}
        </Static>
        <OverflowProvider>
          <Box ref={pendingHistoryItemRef} flexDirection="column">
            {pendingHistoryItems.map((item, i) => (
              <HistoryItemDisplay
                key={i}
                availableTerminalHeight={
                  constrainHeight ? availableTerminalHeight : undefined
                }
                terminalWidth={mainAreaWidth}
                item={{ ...item, id: 0 }}
                isPending={true}
                config={config}
                isFocused={!isEditorDialogOpen}
              />
            ))}
            <ShowMoreLines constrainHeight={constrainHeight} />
          </Box>
        </OverflowProvider>

        <Box flexDirection="column" ref={mainControlsRef}>
          {startupWarnings.length > 0 && (
            <Box
              borderStyle="round"
              borderColor={Colors.AccentYellow}
              paddingX={1}
              marginY={1}
              flexDirection="column"
            >
              {startupWarnings.map((warning, index) => (
                <Text key={index} color={Colors.AccentYellow}>
                  {warning}
                </Text>
              ))}
            </Box>
          )}

          {shouldShowIdePrompt ? (
            <IdeIntegrationNudge
              ideName={config.getIdeClient().getDetectedIdeDisplayName()}
              onComplete={handleIdePromptComplete}
            />
          ) : isFolderTrustDialogOpen ? (
            <FolderTrustDialog onSelect={handleFolderTrustSelect} />
          ) : shellConfirmationRequest ? (
            <ShellConfirmationDialog request={shellConfirmationRequest} />
          ) : confirmationRequest ? (
            <Box flexDirection="column">
              {confirmationRequest.prompt}
              <Box paddingY={1}>
                <RadioButtonSelect
                  items={[
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                  ]}
                  onSelect={(value: boolean) => {
                    confirmationRequest.onConfirm(value);
                  }}
                />
              </Box>
            </Box>
          ) : isThemeDialogOpen ? (
            <Box flexDirection="column">
              {themeError && (
                <Box marginBottom={1}>
                  <Text color={Colors.AccentRed}>{themeError}</Text>
                </Box>
              )}
              <ThemeDialog
                onSelect={handleThemeSelect}
                onHighlight={handleThemeHighlight}
                settings={settings}
                availableTerminalHeight={
                  constrainHeight
                    ? terminalHeight - staticExtraHeight
                    : undefined
                }
                terminalWidth={mainAreaWidth}
              />
            </Box>
          ) : isSettingsDialogOpen ? (
            <Box flexDirection="column">
              <SettingsDialog
                settings={settings}
                onSelect={() => closeSettingsDialog()}
                onRestartRequest={() => process.exit(0)}
              />
            </Box>
          ) : isAuthenticating ? (
            <>
              <AuthInProgress
                onTimeout={() => {
                  /* Handled in AppContainer */
                }}
              />
              {showErrorDetails && (
                <OverflowProvider>
                  <Box flexDirection="column">
                    <DetailedMessagesDisplay
                      messages={filteredConsoleMessages}
                      maxHeight={
                        constrainHeight ? debugConsoleMaxHeight : undefined
                      }
                      width={inputWidth}
                    />
                    <ShowMoreLines constrainHeight={constrainHeight} />
                  </Box>
                </OverflowProvider>
              )}
            </>
          ) : isAuthDialogOpen ? (
            <Box flexDirection="column">
              <AuthDialog
                onSelect={handleAuthSelect}
                settings={settings}
                initialErrorMessage={authError}
              />
            </Box>
          ) : isEditorDialogOpen ? (
            <Box flexDirection="column">
              {editorError && (
                <Box marginBottom={1}>
                  <Text color={Colors.AccentRed}>{editorError}</Text>
                </Box>
              )}
              <EditorSettingsDialog
                onSelect={handleEditorSelect}
                settings={settings}
                onExit={exitEditorDialog}
              />
            </Box>
          ) : showPrivacyNotice ? (
            <PrivacyNotice
              onExit={() => ui.openPrivacyNotice()}
              config={config}
            />
          ) : (
            <>
              <LoadingIndicator
                thought={
                  streamingState === StreamingState.WaitingForConfirmation ||
                  config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : thought
                }
                currentLoadingPhrase={
                  config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : currentLoadingPhrase
                }
                elapsedTime={elapsedTime}
              />

              <Box
                marginTop={1}
                justifyContent="space-between"
                width="100%"
                flexDirection={isNarrow ? 'column' : 'row'}
                alignItems={isNarrow ? 'flex-start' : 'center'}
              >
                <Box>
                  {process.env.GEMINI_SYSTEM_MD && (
                    <Text color={Colors.AccentRed}>|⌐■_■| </Text>
                  )}
                  {ctrlCPressedOnce ? (
                    <Text color={Colors.AccentYellow}>
                      Press Ctrl+C again to exit.
                    </Text>
                  ) : ctrlDPressedOnce ? (
                    <Text color={Colors.AccentYellow}>
                      Press Ctrl+D again to exit.
                    </Text>
                  ) : showEscapePrompt ? (
                    <Text color={Colors.Gray}>Press Esc again to clear.</Text>
                  ) : (
                    <ContextSummaryDisplay
                      ideContext={ideContextState}
                      geminiMdFileCount={geminiMdFileCount}
                      contextFileNames={contextFileNames}
                      mcpServers={config.getMcpServers()}
                      blockedMcpServers={config.getBlockedMcpServers()}
                      showToolDescriptions={showToolDescriptions}
                    />
                  )}
                </Box>
                <Box paddingTop={isNarrow ? 1 : 0}>
                  {showAutoAcceptIndicator !== ApprovalMode.DEFAULT &&
                    !shellModeActive && (
                      <AutoAcceptIndicator
                        approvalMode={showAutoAcceptIndicator}
                      />
                    )}
                  {shellModeActive && <ShellModeIndicator />}
                </Box>
              </Box>

              {showErrorDetails && (
                <OverflowProvider>
                  <Box flexDirection="column">
                    <DetailedMessagesDisplay
                      messages={filteredConsoleMessages}
                      maxHeight={
                        constrainHeight ? debugConsoleMaxHeight : undefined
                      }
                      width={inputWidth}
                    />
                    <ShowMoreLines constrainHeight={constrainHeight} />
                  </Box>
                </OverflowProvider>
              )}

              {isInputActive && (
                <InputPrompt
                  buffer={buffer}
                  inputWidth={inputWidth}
                  suggestionsWidth={suggestionsWidth}
                  onSubmit={ui.handleFinalSubmit}
                  userMessages={userMessages}
                  onClearScreen={ui.handleClearScreen}
                  config={config}
                  slashCommands={slashCommands}
                  commandContext={commandContext}
                  shellModeActive={shellModeActive}
                  setShellModeActive={setShellModeActive}
                  onEscapePromptChange={handleEscapePromptChange}
                  focus={isFocused}
                  vimHandleInput={vimHandleInput}
                  placeholder={placeholder}
                />
              )}
            </>
          )}

          {initError && streamingState !== StreamingState.Responding && (
            <Box
              borderStyle="round"
              borderColor={Colors.AccentRed}
              paddingX={1}
              marginBottom={1}
            >
              <Text color={Colors.AccentRed}>
                Initialization Error: {initError}
              </Text>
            </Box>
          )}
          <Footer
            model={currentModel}
            targetDir={config.getTargetDir()}
            debugMode={config.getDebugMode()}
            branchName={branchName}
            debugMessage={debugMessage}
            corgiMode={corgiMode}
            errorCount={errorCount}
            showErrorDetails={showErrorDetails}
            showMemoryUsage={
              config.getDebugMode() || settings.merged.showMemoryUsage || false
            }
            promptTokenCount={sessionStats.lastPromptTokenCount}
            nightly={nightly}
            vimMode={vimEnabled ? vimMode : undefined}
          />
        </Box>
      </Box>
    </StreamingContext.Provider>
  );
};
