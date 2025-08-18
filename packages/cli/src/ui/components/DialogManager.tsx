/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  IdeIntegrationNudge,
  IdeIntegrationNudgeResult,
} from '../IdeIntegrationNudge.js';
import {
  FolderTrustDialog,
  FolderTrustChoice,
} from './FolderTrustDialog.js';
import { ShellConfirmationDialog } from './ShellConfirmationDialog.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { ThemeDialog } from './ThemeDialog.js';
import { SettingsDialog } from './SettingsDialog.js';
import { AuthInProgress } from './AuthInProgress.js';
import { AuthDialog } from './AuthDialog.js';
import { EditorSettingsDialog } from './EditorSettingsDialog.js';
import { PrivacyNotice } from '../privacy/PrivacyNotice.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import {
  AuthType,
  Config,
  EditorType,
  ToolConfirmationOutcome,
} from '@google/gemini-cli-core';
import { Colors } from '../colors.js';
import { useUI } from '../hooks/useUI.js';
import { ShellConfirmationRequest, ConfirmationRequest } from '../types.js';
import process from 'node:process';

// Props for DialogManager
interface DialogManagerProps {
  config: Config;
  settings: LoadedSettings;
  shouldShowIdePrompt: boolean;
  handleIdePromptComplete: (result: IdeIntegrationNudgeResult) => void;
  isFolderTrustDialogOpen: boolean;
  handleFolderTrustSelect: (choice: FolderTrustChoice) => void;
  shellConfirmationRequest: ShellConfirmationRequest | null;
  confirmationRequest: ConfirmationRequest | null;
  isThemeDialogOpen: boolean;
  themeError: string | null;
  handleThemeSelect: (
    themeName: string | undefined,
    scope: SettingScope,
  ) => void;
  handleThemeHighlight: (themeName: string | undefined) => void;
  isSettingsDialogOpen: boolean;
  closeSettingsDialog: () => void;
  isAuthenticating: boolean;
  isAuthDialogOpen: boolean;
  authError: string | null;
  handleAuthSelect: (
    authType: AuthType | undefined,
    scope: SettingScope,
  ) => void;
  isEditorDialogOpen: boolean;
  editorError: string | null;
  handleEditorSelect: (
    editorType: EditorType | undefined,
    scope: SettingScope,
  ) => void;
  exitEditorDialog: () => void;
  showPrivacyNotice: boolean;
  constrainHeight: boolean;
  terminalHeight: number;
  staticExtraHeight: number;
  mainAreaWidth: number;
}

export const DialogManager = (props: DialogManagerProps) => {
  const {
    config,
    settings,
    shouldShowIdePrompt,
    handleIdePromptComplete,
    isFolderTrustDialogOpen,
    handleFolderTrustSelect,
    shellConfirmationRequest,
    confirmationRequest,
    isThemeDialogOpen,
    themeError,
    handleThemeSelect,
    handleThemeHighlight,
    isSettingsDialogOpen,
    closeSettingsDialog,
    isAuthenticating,
    isAuthDialogOpen,
    authError,
    handleAuthSelect,
    isEditorDialogOpen,
    editorError,
    handleEditorSelect,
    exitEditorDialog,
    showPrivacyNotice,
    constrainHeight,
    terminalHeight,
    staticExtraHeight,
    mainAreaWidth,
  } = props;

  const ui = useUI();

  if (shouldShowIdePrompt) {
    return (
      <IdeIntegrationNudge
        ideName={config.getIdeClient().getDetectedIdeDisplayName()}
        onComplete={handleIdePromptComplete}
      />
    );
  }
  if (isFolderTrustDialogOpen) {
    return <FolderTrustDialog onSelect={handleFolderTrustSelect} />;
  }
  if (shellConfirmationRequest) {
    return <ShellConfirmationDialog request={shellConfirmationRequest} />;
  }
  if (confirmationRequest) {
    return (
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
    );
  }
  if (isThemeDialogOpen) {
    return (
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
            constrainHeight ? terminalHeight - staticExtraHeight : undefined
          }
          terminalWidth={mainAreaWidth}
        />
      </Box>
    );
  }
  if (isSettingsDialogOpen) {
    return (
      <Box flexDirection="column">
        <SettingsDialog
          settings={settings}
          onSelect={() => closeSettingsDialog()}
          onRestartRequest={() => process.exit(0)}
        />
      </Box>
    );
  }
  if (isAuthenticating) {
    return (
      <AuthInProgress
        onTimeout={() => {
          /* This is now handled in AppContainer */
        }}
      />
    );
  }
  if (isAuthDialogOpen) {
    return (
      <Box flexDirection="column">
        <AuthDialog
          onSelect={handleAuthSelect}
          settings={settings}
          initialErrorMessage={authError}
        />
      </Box>
    );
  }
  if (isEditorDialogOpen) {
    return (
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
    );
  }
  if (showPrivacyNotice) {
    return (
      <PrivacyNotice onExit={() => ui.openPrivacyNotice()} config={config} />
    );
  }

  return null;
};