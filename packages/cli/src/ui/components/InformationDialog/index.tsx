/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useState, useEffect } from 'react';
import { useKeypress } from '../../hooks/useKeypress.js';
import { theme } from '../../semantic-colors.js';
import { processInformationMessage } from './processors.js';
import type { InformationDialogData } from './types.js';

interface InformationDialogProps {
  data: InformationDialogData;
  onClose: () => void;
}

export const InformationDialog: React.FC<InformationDialogProps> = ({
  data,
  onClose
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const processed = processInformationMessage(data.content);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - data.timestamp) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    // Set initial value
    const elapsed = Math.floor((Date.now() - data.timestamp) / 1000);
    setElapsedSeconds(elapsed);

    return () => clearInterval(interval);
  }, [data.timestamp]);

  const getBottomStatus = () => {
    if (data.retryAttempt !== undefined && data.maxRetries !== undefined) {
      if (data.retryAttempt >= data.maxRetries) {
        return `Retries exhausted (${elapsedSeconds}s)`;
      }
      return `Retry attempt: ${data.retryAttempt} of ${data.maxRetries} (${elapsedSeconds}s)`;
    }
    return null;
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true }
  );

  return (
    <Box flexDirection="column" width="100%">
      <Box
        borderStyle="round"
        borderColor={theme.status.warning}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text bold color={theme.status.warning}>
            {processed.title}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text>{processed.content}</Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          {getBottomStatus() ? (
            <Text color={theme.ui.comment}>{getBottomStatus()}</Text>
          ) : (
            <Box />
          )}
          <Text color={theme.ui.comment}>[Press ESC to dismiss]</Text>
        </Box>
      </Box>
    </Box>
  );
};