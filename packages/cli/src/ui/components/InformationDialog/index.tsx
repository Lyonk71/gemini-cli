/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../../hooks/useKeypress.js';
import { theme } from '../../semantic-colors.js';
import { processInformationMessage } from './processors.js';

interface InformationDialogProps {
  content: string;
  onClose: () => void;
}

export const InformationDialog: React.FC<InformationDialogProps> = ({
  content,
  onClose
}) => {
  const processed = processInformationMessage(content);

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
        borderColor={theme.ui.comment}
        paddingX={1}
        paddingY={1}
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text bold color={theme.text.primary}>
            {processed.title}
          </Text>
        </Box>

        <Text>{processed.content}</Text>

        <Box marginTop={1}>
          <Text dimColor>[Press ESC to dismiss]</Text>
        </Box>
      </Box>
    </Box>
  );
};