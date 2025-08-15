/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Config } from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import { SessionStatsProvider } from './contexts/SessionContext.js';
import { VimModeProvider } from './contexts/VimModeContext.js';
import { AppController } from './AppController.js';

interface AppContainerProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
  version: string;
}

export const AppContainer = (props: AppContainerProps) => {
  return (
    <SessionStatsProvider>
      <VimModeProvider settings={props.settings}>
        <AppController {...props} />
      </VimModeProvider>
    </SessionStatsProvider>
  );
};
