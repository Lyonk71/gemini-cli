/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { App } from './App.js';
import { UIContext } from './hooks/useUI.js';
import { type HistoryItem } from './types.js';
import { type Config } from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import process from 'node:process';
import { useHistory } from './hooks/useHistoryManager.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { useAuthCommand } from './hooks/useAuthCommand.js';
import { useEditorSettings } from './hooks/useEditorSettings.js';
import { useSettingsCommand } from './hooks/useSettingsCommand.js';

import { SessionStatsProvider } from './contexts/SessionContext.js';
import { VimModeProvider } from './contexts/VimModeContext.js';

interface AppContainerProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
  version: string;
}

export const AppContainer = (props: AppContainerProps) => {
  const { settings, config } = props;
  const { history, addItem, clearItems, loadHistory, updateItem } =
    useHistory();
  const [corgiMode, setCorgiMode] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [quittingMessages, setQuittingMessages] = useState<
    HistoryItem[] | null
  >(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const {
    isThemeDialogOpen,
    openThemeDialog,
    handleThemeSelect,
    handleThemeHighlight,
  } = useThemeCommand(settings, setThemeError, addItem);

  const {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    isAuthenticating,
    cancelAuthentication,
  } = useAuthCommand(settings, setAuthError, config);

  const {
    isEditorDialogOpen,
    openEditorDialog,
    handleEditorSelect,
    exitEditorDialog,
  } = useEditorSettings(settings, setEditorError, addItem);

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
          <App
            {...props}
            history={history}
            addItem={addItem}
            clearItems={clearItems}
            loadHistory={loadHistory}
            updateItem={updateItem}
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
            setShowPrivacyNotice={setShowPrivacyNotice}
            corgiMode={corgiMode}
            debugMessage={debugMessage}
            quittingMessages={quittingMessages}
            isSettingsDialogOpen={isSettingsDialogOpen}
            closeSettingsDialog={closeSettingsDialog}
          />
        </UIContext.Provider>
      </VimModeProvider>
    </SessionStatsProvider>
  );
};
