/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, DOMElement, Static } from 'ink';
import { HistoryItemDisplay } from './HistoryItemDisplay.js';
import { ShowMoreLines } from './ShowMoreLines.js';
import { OverflowProvider } from '../contexts/OverflowContext.js';
import { HistoryItem, HistoryItemWithoutId } from '../types.js';
import { Config } from '@google/gemini-cli-core';
import { type SlashCommand } from '../commands/types.js';

interface MainContentProps {
  history: HistoryItem[];
  pendingHistoryItems: HistoryItemWithoutId[];
  mainAreaWidth: number;
  staticAreaMaxItemHeight: number;
  constrainHeight: boolean;
  availableTerminalHeight: number | undefined;
  config: Config;
  slashCommands: readonly SlashCommand[];
  isEditorDialogOpen: boolean;
  pendingHistoryItemRef: React.RefObject<DOMElement | null>;
}

export const MainContent = (props: MainContentProps) => {
  const {
    history,
    pendingHistoryItems,
    mainAreaWidth,
    staticAreaMaxItemHeight,
    constrainHeight,
    availableTerminalHeight,
    config,
    slashCommands,
    isEditorDialogOpen,
    pendingHistoryItemRef,
  } = props;

  return (
    <>
      <Static
        items={history.map((h) => (
          <HistoryItemDisplay
            terminalWidth={mainAreaWidth}
            availableTerminalHeight={staticAreaMaxItemHeight}
            key={h.id}
            item={h}
            isPending={false}
            config={config}
            commands={slashCommands}
          />
        ))}
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
    </>
  );
};