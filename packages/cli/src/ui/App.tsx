/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useEffect } from 'react';
import type { DOMElement } from 'ink';
import { Box, measureElement } from 'ink';
import { getAllGeminiMdFilenames } from '@google/gemini-cli-core';
import { StreamingContext } from './contexts/StreamingContext.js';
import { useSessionStats } from './contexts/SessionContext.js';
import { useGitBranchName } from './hooks/useGitBranchName.js';
import { useAppContext } from './contexts/AppContext.js';
import { Notifications } from './components/Notifications.js';
import { MainContent } from './components/MainContent.js';
import { DialogManager } from './components/DialogManager.js';
import { Composer } from './components/Composer.js';
import { useUIState } from './contexts/UIStateContext.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { useConfig } from './contexts/ConfigContext.js';
import { useSettings } from './contexts/SettingsContext.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { QuittingDisplay } from './components/QuittingDisplay.js';

interface AppProps {}

export const App = (props: AppProps) => {
  const { version } = useAppContext();
  const config = useConfig();
  const settings = useSettings();
  const uiState = useUIState();
  const uiActions = useUIActions();

  const { stats: sessionStats } = useSessionStats();
  const { rows: terminalHeight, columns: terminalWidth } = useTerminalSize();
  const branchName = useGitBranchName(config.getTargetDir());

  const mainControlsRef = useRef<DOMElement>(null);

  const staticExtraHeight = 3;
  const availableTerminalHeight = useMemo(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      return terminalHeight - fullFooterMeasurement.height - staticExtraHeight;
    }
    return terminalHeight - staticExtraHeight;
  }, [terminalHeight, uiState.isInputActive]); // Re-calculate when input appears/disappears

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
      !uiState.isAuthenticating &&
      !uiState.isAuthDialogOpen &&
      !uiState.isThemeDialogOpen &&
      !uiState.isEditorDialogOpen &&
      !uiState.showPrivacyNotice &&
      geminiClient?.isInitialized?.()
    ) {
      uiActions.handleFinalSubmit(initialPrompt);
      initialPromptSubmitted.current = true;
    }
  }, [
    initialPrompt,
    uiActions,
    uiState.isAuthenticating,
    uiState.isAuthDialogOpen,
    uiState.isThemeDialogOpen,
    uiState.isEditorDialogOpen,
    uiState.showPrivacyNotice,
    geminiClient,
  ]);

  const errorCount = useMemo(
    () =>
      uiState.filteredConsoleMessages
        .filter((msg) => msg.type === 'error')
        .reduce((total, msg) => total + msg.count, 0),
    [uiState.filteredConsoleMessages],
  );

  if (uiState.quittingMessages) {
    return <QuittingDisplay />;
  }

  const mainAreaWidth = Math.floor(terminalWidth * 0.9);
  const nightly = version.includes('nightly');
  const pendingHistoryItems = [
    ...uiState.pendingSlashCommandHistoryItems,
    ...uiState.pendingGeminiHistoryItems,
  ];

  const dialogsVisible =
    uiState.showWorkspaceMigrationDialog ||
    uiState.shouldShowIdePrompt ||
    uiState.isFolderTrustDialogOpen ||
    !!uiState.shellConfirmationRequest ||
    !!uiState.confirmationRequest ||
    uiState.isThemeDialogOpen ||
    uiState.isSettingsDialogOpen ||
    uiState.isAuthenticating ||
    uiState.isAuthDialogOpen ||
    uiState.isEditorDialogOpen ||
    uiState.showPrivacyNotice;

  return (
    <StreamingContext.Provider value={uiState.streamingState}>
      <Box flexDirection="column" width="90%">
        <MainContent
          pendingHistoryItems={pendingHistoryItems}
          mainAreaWidth={mainAreaWidth}
          staticAreaMaxItemHeight={Math.max(terminalHeight * 4, 100)}
          availableTerminalHeight={availableTerminalHeight}
          nightly={nightly}
        />

        <Box flexDirection="column" ref={mainControlsRef}>
          <Notifications />

          {dialogsVisible ? (
            <DialogManager
              constrainHeight={uiState.constrainHeight}
              terminalHeight={terminalHeight}
              staticExtraHeight={staticExtraHeight}
              mainAreaWidth={mainAreaWidth}
            />
          ) : (
            <Composer
              contextFileNames={contextFileNames}
              showAutoAcceptIndicator={uiState.showAutoAcceptIndicator}
              footerProps={{
                model: config.getModel(),
                targetDir: config.getTargetDir(),
                debugMode: config.getDebugMode(),
                branchName: branchName || '',
                debugMessage: uiState.debugMessage,
                corgiMode: uiState.corgiMode,
                errorCount: errorCount,
                showErrorDetails: uiState.showErrorDetails,
                showMemoryUsage:
                  config.getDebugMode() ||
                  settings.merged.showMemoryUsage ||
                  false,
                promptTokenCount: sessionStats.lastPromptTokenCount,
                nightly: nightly,
                isTrustedFolder: uiState.isTrustedFolder,
              }}
            />
          )}
        </Box>
      </Box>
    </StreamingContext.Provider>
  );
};