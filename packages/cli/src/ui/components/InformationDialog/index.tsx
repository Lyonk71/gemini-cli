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
  onClose,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const processed = processInformationMessage(data.content);

  // Update remaining time every second for countdown
  useEffect(() => {
    const updateTime = () => {
      if (data.delayMs) {
        const elapsed = Date.now() - data.timestamp;
        const remaining = Math.max(
          0,
          Math.ceil((data.delayMs - elapsed) / 1000),
        );
        setRemainingSeconds(remaining);
      } else {
        // If no delayMs, show elapsed time
        const elapsed = Math.floor((Date.now() - data.timestamp) / 1000);
        setRemainingSeconds(elapsed);
      }
    };

    const interval = setInterval(updateTime, 1000);
    updateTime(); // Set initial value

    return () => clearInterval(interval);
  }, [data.timestamp, data.delayMs]);

  const getBottomStatus = () => {
    if (data.retryAttempt !== undefined && data.maxRetries !== undefined) {
      if (data.retryAttempt >= data.maxRetries) {
        return `Retries exhausted`;
      }

      if (data.delayMs) {
        if (remainingSeconds > 0) {
          return `Retry attempt: ${data.retryAttempt} of ${data.maxRetries} (${remainingSeconds}s remaining)`;
        } else {
          return `Retry attempt: ${data.retryAttempt} of ${data.maxRetries} (Retrying...)`;
        }
      } else {
        return `Retry attempt: ${data.retryAttempt} of ${data.maxRetries} (${remainingSeconds}s)`;
      }
    }
    return null;
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
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

        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
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
