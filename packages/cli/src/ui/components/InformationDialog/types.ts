/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ParsedError } from '@google/gemini-cli-core';

export interface InformationMessage {
  type: InformationMessageType;
  data: ParsedError;
  title?: string;
}

export enum InformationMessageType {
  API_ERROR = 'api_error',
  // Future types will go here
}

export interface ProcessedMessage {
  title: string;
  content: string;
}

export interface InformationDialogData {
  content: ParsedError;
  timestamp: number;
  retryAttempt?: number;
  maxRetries?: number;
  delayMs?: number;
}
