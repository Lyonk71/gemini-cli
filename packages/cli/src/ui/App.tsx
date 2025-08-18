/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Box, DOMElement, measureElement } from 'ink';
import {
  StreamingState,
  type HistoryItem,
  type HistoryItemWithoutId,
  ThoughtSummary,
  ConsoleMessageItem,
  ShellConfirmationRequest,
  ConfirmationRequest,
} from './types.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useAutoAcceptIndicator } from './hooks/useAutoAcceptIndicator.js';
import { LoadedSettings, SettingScope } from '../config/settings.js';
import { HistoryItemDisplay } from './components/HistoryItemDisplay.js';
import {
  type Config,
  getAllGeminiMdFilenames,
  EditorType,
  AuthType,
  type IdeContext,
} from '@google/gemini-cli-core';
import { IdeIntegrationNudgeResult } from './IdeIntegrationNudge.js';
import { StreamingContext } from './contexts/StreamingContext.js';
import { useSessionStats } from './contexts/SessionContext.js';
import { useGitBranchName } from './hooks/useGitBranchName.js';
import { TextBuffer } from './components/shared/text-buffer.js';
import { Key } from './hooks/useKeypress.js';
import { useVimMode } from './contexts/VimModeContext.js';
import { type CommandContext, type SlashCommand } from './commands/types.js';
import { AppHeader } from './components/AppHeader.js';
import { Notifications } from './components/Notifications.js';
import { MainContent } from './components/MainContent.js';
import { DialogManager } from './components/DialogManager.js';
import { InputArea } from './components/InputArea.js';
import { useUI } from './hooks/useUI.js';

import { FolderTrustChoice } from './components/FolderTrustDialog.js';

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
  shellConfirmationRequest: ShellConfirmationRequest | null;
  confirmationRequest: ConfirmationRequest | null;
  geminiMdFileCount: number;
  streamingState: StreamingState;
  initError: string | null;
  pendingGeminiHistoryItems: HistoryItemWithoutId[];
  thought: ThoughtSummary | null;
  shellModeActive: boolean;
  setShellModeActive: (value: boolean) => void;
  userMessages: string[];
  buffer: TextBuffer;
  inputWidth: number;
  suggestionsWidth: number;
  vimHandleInput: (key: Key) => boolean;
  isInputActive: boolean;
  shouldShowIdePrompt: boolean;
  handleIdePromptComplete: (result: IdeIntegrationNudgeResult) => void;
  isFolderTrustDialogOpen: boolean;
  handleFolderTrustSelect: (choice: FolderTrustChoice) => void;
  constrainHeight: boolean;
  setConstrainHeight: (value: boolean) => void;
  showErrorDetails: boolean;
  filteredConsoleMessages: ConsoleMessageItem[];
  ideContextState: IdeContext | undefined;
  showToolDescriptions: boolean;
  ctrlCPressedOnce: boolean;
  ctrlDPressedOnce: boolean;
  showEscapePrompt: boolean;
  onEscapePromptChange: (show: boolean) => void;
  isFocused: boolean;
  elapsedTime: string;
  currentLoadingPhrase: string;
  refreshStatic: () => void;
}

export const App = (props: AppProps) => {
  const {
    config,
    settings,
    startupWarnings = [],
    version,
    history,
    quittingMessages,
    constrainHeight,
    isEditorDialogOpen,
    slashCommands,
    refreshStatic,
  } = props;

  const { stats: sessionStats } = useSessionStats();
  const { rows: terminalHeight, columns: terminalWidth } = useTerminalSize();
  const { vimEnabled } = useVimMode();
  const branchName = useGitBranchName(config.getTargetDir());
  const showAutoAcceptIndicator = useAutoAcceptIndicator({ config });
  const ui = useUI();

  const mainControlsRef = useRef<DOMElement>(null);
  const pendingHistoryItemRef = useRef<DOMElement>(null);
  const isInitialMount = useRef(true);
  const [staticNeedsRefresh, setStaticNeedsRefresh] = useState(false);

  const staticExtraHeight = 3;
  const availableTerminalHeight = useMemo(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      return terminalHeight - fullFooterMeasurement.height - staticExtraHeight;
    }
    return terminalHeight - staticExtraHeight;
  }, [terminalHeight, props.isInputActive]); // Re-calculate when input appears/disappears

  const contextFileNames = useMemo(() => {
    const fromSettings = settings.merged.contextFileName;
    return fromSettings
      ? Array.isArray(fromSettings)
        ? fromSettings
        : [fromSettings]
      : getAllGeminiMdFilenames();
  }, [settings.merged.contextFileName]);

  const initialPrompt = useMemo(() => config.getQuestion(), [config]);
  const initialPromptSubmitted = useRef(false);
  const geminiClient = config.getGeminiClient();

  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSubmitted.current &&
      !props.isAuthenticating &&
      !props.isAuthDialogOpen &&
      !props.isThemeDialogOpen &&
      !props.isEditorDialogOpen &&
      !props.showPrivacyNotice &&
      geminiClient?.isInitialized?.()
    ) {
      ui.handleFinalSubmit(initialPrompt);
      initialPromptSubmitted.current = true;
    }
  }, [
    initialPrompt,
    ui,
    props.isAuthenticating,
    props.isAuthDialogOpen,
    props.isThemeDialogOpen,
    props.isEditorDialogOpen,
    props.showPrivacyNotice,
    geminiClient,
  ]);

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
    if (props.streamingState === StreamingState.Idle && staticNeedsRefresh) {
      setStaticNeedsRefresh(false);
      refreshStatic();
    }
  }, [props.streamingState, refreshStatic, staticNeedsRefresh]);

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
  const nightly = version.includes('nightly');
  const pendingHistoryItems = [
    ...props.pendingSlashCommandHistoryItems,
    ...props.pendingGeminiHistoryItems,
  ];
  const errorCount = useMemo(
    () =>
      props.filteredConsoleMessages
        .filter((msg) => msg.type === 'error')
        .reduce((total, msg) => total + msg.count, 0),
    [props.filteredConsoleMessages],
  );

  const dialogsVisible =
    props.shouldShowIdePrompt ||
    props.isFolderTrustDialogOpen ||
    !!props.shellConfirmationRequest ||
    !!props.confirmationRequest ||
    props.isThemeDialogOpen ||
    props.isSettingsDialogOpen ||
    props.isAuthenticating ||
    props.isAuthDialogOpen ||
    props.isEditorDialogOpen ||
    props.showPrivacyNotice;

  return (
    <StreamingContext.Provider value={props.streamingState}>
      <Box flexDirection="column" width="90%">
        <AppHeader
          version={version}
          nightly={nightly}
          settings={settings}
          config={config}
        />
        <MainContent
          history={history}
          pendingHistoryItems={pendingHistoryItems}
          mainAreaWidth={mainAreaWidth}
          staticAreaMaxItemHeight={staticAreaMaxItemHeight}
          constrainHeight={constrainHeight}
          availableTerminalHeight={availableTerminalHeight}
          config={config}
          slashCommands={slashCommands}
          isEditorDialogOpen={isEditorDialogOpen}
          pendingHistoryItemRef={pendingHistoryItemRef}
        />

        <Box flexDirection="column" ref={mainControlsRef}>
          <Notifications startupWarnings={startupWarnings} />

          {dialogsVisible ? (
            <DialogManager
              config={config}
              settings={settings}
              shouldShowIdePrompt={props.shouldShowIdePrompt}
              handleIdePromptComplete={props.handleIdePromptComplete}
              isFolderTrustDialogOpen={props.isFolderTrustDialogOpen}
              handleFolderTrustSelect={props.handleFolderTrustSelect}
              shellConfirmationRequest={props.shellConfirmationRequest}
              confirmationRequest={props.confirmationRequest}
              isThemeDialogOpen={props.isThemeDialogOpen}
              themeError={props.themeError}
              handleThemeSelect={props.handleThemeSelect}
              handleThemeHighlight={props.handleThemeHighlight}
              isSettingsDialogOpen={props.isSettingsDialogOpen}
              closeSettingsDialog={props.closeSettingsDialog}
              isAuthenticating={props.isAuthenticating}
              isAuthDialogOpen={props.isAuthDialogOpen}
              authError={props.authError}
              handleAuthSelect={props.handleAuthSelect}
              isEditorDialogOpen={props.isEditorDialogOpen}
              editorError={props.editorError}
              handleEditorSelect={props.handleEditorSelect}
              exitEditorDialog={props.exitEditorDialog}
              showPrivacyNotice={props.showPrivacyNotice}
              constrainHeight={constrainHeight}
              terminalHeight={terminalHeight}
              staticExtraHeight={staticExtraHeight}
              mainAreaWidth={mainAreaWidth}
            />
          ) : (
            <InputArea
              config={config}
              streamingState={props.streamingState}
              thought={props.thought}
              currentLoadingPhrase={props.currentLoadingPhrase}
              elapsedTime={props.elapsedTime}
              ctrlCPressedOnce={props.ctrlCPressedOnce}
              ctrlDPressedOnce={props.ctrlDPressedOnce}
              showEscapePrompt={props.showEscapePrompt}
              ideContextState={props.ideContextState}
              geminiMdFileCount={props.geminiMdFileCount}
              contextFileNames={contextFileNames}
              showToolDescriptions={props.showToolDescriptions}
              showAutoAcceptIndicator={showAutoAcceptIndicator}
              shellModeActive={props.shellModeActive}
              setShellModeActive={props.setShellModeActive}
              showErrorDetails={props.showErrorDetails}
              filteredConsoleMessages={props.filteredConsoleMessages}
              constrainHeight={constrainHeight}
              debugConsoleMaxHeight={debugConsoleMaxHeight}
              inputWidth={props.inputWidth}
              isInputActive={props.isInputActive}
              buffer={props.buffer}
              suggestionsWidth={props.suggestionsWidth}
              userMessages={props.userMessages}
              slashCommands={slashCommands}
              commandContext={props.commandContext}
              onEscapePromptChange={props.onEscapePromptChange}
              isFocused={props.isFocused}
              vimHandleInput={props.vimHandleInput}
              placeholder={placeholder}
              initError={props.initError}
              footerProps={{
                model: config.getModel(),
                targetDir: config.getTargetDir(),
                debugMode: config.getDebugMode(),
                branchName: branchName || '',
                debugMessage: props.debugMessage,
                corgiMode: props.corgiMode,
                errorCount: errorCount,
                showErrorDetails: props.showErrorDetails,
                showMemoryUsage:
                  config.getDebugMode() ||
                  settings.merged.showMemoryUsage ||
                  false,
                promptTokenCount: sessionStats.lastPromptTokenCount,
                nightly: nightly,
              }}
            />
          )}
        </Box>
      </Box>
    </StreamingContext.Provider>
  );
};