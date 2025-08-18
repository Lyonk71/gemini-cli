/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { LoadingIndicator } from './LoadingIndicator.js';
import { ContextSummaryDisplay } from './ContextSummaryDisplay.js';
import { AutoAcceptIndicator } from './AutoAcceptIndicator.js';
import { ShellModeIndicator } from './ShellModeIndicator.js';
import { DetailedMessagesDisplay } from './DetailedMessagesDisplay.js';
import { InputPrompt } from './InputPrompt.js';
import { Footer, FooterProps } from './Footer.js';
import { ShowMoreLines } from './ShowMoreLines.js';
import { OverflowProvider } from '../contexts/OverflowContext.js';
import { Colors } from '../colors.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';
import { useUI } from '../hooks/useUI.js';
import { useVimMode } from '../contexts/VimModeContext.js';
import { Config, ApprovalMode, IdeContext } from '@google/gemini-cli-core';
import {
  StreamingState,
  ThoughtSummary,
  ConsoleMessageItem,
} from '../types.js';
import { TextBuffer } from './shared/text-buffer.js';
import { type CommandContext, type SlashCommand } from '../commands/types.js';
import { Key } from '../hooks/useKeypress.js';

interface InputAreaProps {
  config: Config;
  streamingState: StreamingState;
  thought: ThoughtSummary | null;
  currentLoadingPhrase: string;
  elapsedTime: string;
  ctrlCPressedOnce: boolean;
  ctrlDPressedOnce: boolean;
  showEscapePrompt: boolean;
  ideContextState: IdeContext | undefined;
  geminiMdFileCount: number;
  contextFileNames: string[];
  showToolDescriptions: boolean;
  showAutoAcceptIndicator: ApprovalMode;
  shellModeActive: boolean;
  setShellModeActive: (value: boolean) => void;
  showErrorDetails: boolean;
  filteredConsoleMessages: ConsoleMessageItem[];
  constrainHeight: boolean;
  debugConsoleMaxHeight: number;
  inputWidth: number;
  isInputActive: boolean;
  buffer: TextBuffer;
  suggestionsWidth: number;
  userMessages: string[];
  slashCommands: readonly SlashCommand[];
  commandContext: CommandContext;
  onEscapePromptChange: (show: boolean) => void;
  isFocused: boolean;
  vimHandleInput: (key: Key) => boolean;
  placeholder: string;
  initError: string | null;
  footerProps: Omit<FooterProps, 'vimMode'>;
}

export const InputArea = (props: InputAreaProps) => {
  const {
    config,
    streamingState,
    thought,
    currentLoadingPhrase,
    elapsedTime,
    ctrlCPressedOnce,
    ctrlDPressedOnce,
    showEscapePrompt,
    ideContextState,
    geminiMdFileCount,
    contextFileNames,
    showToolDescriptions,
    showAutoAcceptIndicator,
    shellModeActive,
    setShellModeActive,
    showErrorDetails,
    filteredConsoleMessages,
    constrainHeight,
    debugConsoleMaxHeight,
    inputWidth,
    isInputActive,
    buffer,
    suggestionsWidth,
    userMessages,
    slashCommands,
    commandContext,
    onEscapePromptChange,
    isFocused,
    vimHandleInput,
    placeholder,
    initError,
    footerProps,
  } = props;

  const ui = useUI();
  const { vimEnabled, vimMode } = useVimMode();
  const terminalWidth = process.stdout.columns;
  const isNarrow = isNarrowWidth(terminalWidth);

  return (
    <Box flexDirection="column">
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
        elapsedTime={parseInt(elapsedTime, 10)}
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
          onEscapePromptChange={onEscapePromptChange}
          focus={isFocused}
          vimHandleInput={vimHandleInput}
          placeholder={placeholder}
        />
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
      <Footer {...footerProps} vimMode={vimEnabled ? vimMode : undefined} />
    </Box>
  );
};