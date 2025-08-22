/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { Header } from './Header.js';
import { Tips } from './Tips.js';
import { useAppContext } from '../contexts/AppContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';

interface AppHeaderProps {
  nightly: boolean;
}

export const AppHeader = ({ nightly }: AppHeaderProps) => {
  const { version } = useAppContext();
  const settings = useSettings();
  const config = useConfig();
  return (
    <Box flexDirection="column">
      {!(settings.merged.hideBanner || config.getScreenReader()) && (
        <Header version={version} nightly={nightly} />
      )}
      {!(settings.merged.hideTips || config.getScreenReader()) && <Tips config={config} />}
    </Box>
  );
};
