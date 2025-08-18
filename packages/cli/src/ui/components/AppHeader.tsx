/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box } from 'ink';
import { Header } from './Header.js';
import { Tips } from './Tips.js';
import { Config } from '@google/gemini-cli-core';
import { LoadedSettings } from '../../config/settings.js';

interface AppHeaderProps {
  version: string;
  nightly: boolean;
  settings: LoadedSettings;
  config: Config;
}

export const AppHeader = ({
  version,
  nightly,
  settings,
  config,
}: AppHeaderProps) => {
  return (
    <Box flexDirection="column">
      {!settings.merged.hideBanner && (
        <Header version={version} nightly={nightly} />
      )}
      {!settings.merged.hideTips && <Tips config={config} />}
    </Box>
  );
};
