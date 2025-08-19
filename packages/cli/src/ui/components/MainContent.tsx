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
import { HistoryItemWithoutId } from '../types.js';
import { Config } from '@google/gemini-cli-core';
import { useUIState } from '../contexts/UIStateContext.js';

interface MainContentProps {
  pendingHistoryItems: HistoryItemWithoutId[];
  mainAreaWidth: number;
  staticAreaMaxItemHeight: number;
  availableTerminalHeight: number | undefined;
  config: Config;
  pendingHistoryItemRef: React.RefObject<DOMElement | null>;
}

export const MainContent = (props: MainContentProps) => {
  const {
    pendingHistoryItems,
    mainAreaWidth,
    staticAreaMaxItemHeight,
    availableTerminalHeight,
    config,
    pendingHistoryItemRef,
  } = props;

  const uiState = useUIState();

  return (
    <>
      <Static
        items={uiState.history.map((h) => (
          <HistoryItemDisplay
            terminalWidth={mainAreaWidth}
            availableTerminalHeight={staticAreaMaxItemHeight}
            key={h.id}
            item={h}
            isPending={false}
            config={config}
            commands={uiState.slashCommands}
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
                uiState.constrainHeight ? availableTerminalHeight : undefined
              }
              terminalWidth={mainAreaWidth}
              item={{ ...item, id: 0 }}
              isPending={true}
              config={config}
              isFocused={!uiState.isEditorDialogOpen}
            />
          ))}
          <ShowMoreLines constrainHeight={uiState.constrainHeight} />
        </Box>
      </OverflowProvider>
    </>
  );
};