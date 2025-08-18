/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

interface NotificationsProps {
  startupWarnings: string[];
}

export const Notifications = ({ startupWarnings }: NotificationsProps) => {
  if (startupWarnings.length === 0) {
    return null;
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentYellow}
      paddingX={1}
      marginY={1}
      flexDirection="column"
    >
      {startupWarnings.map((warning, index) => (
        <Text key={index} color={Colors.AccentYellow}>
          {warning}
        </Text>
      ))}
    </Box>
  );
};
