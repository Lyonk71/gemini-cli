/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box } from 'ink';
import { Header } from './Header.js';
import { Tips } from './Tips.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';

interface AppHeaderProps {
  version: string;
  nightly: boolean;
}

export const AppHeader = ({ version, nightly }: AppHeaderProps) => {
  const settings = useSettings();
  const config = useConfig();
  return (
    <Box flexDirection="column">
      {!settings.merged.hideBanner && (
        <Header version={version} nightly={nightly} />
      )}
      {!settings.merged.hideTips && <Tips config={config} />}
    </Box>
  );
};
