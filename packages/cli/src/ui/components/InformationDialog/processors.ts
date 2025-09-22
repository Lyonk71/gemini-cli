/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InformationMessage, ProcessedMessage } from './types.js';
import { InformationMessageType } from './types.js';
import { type ParsedError, ParsedErrorType } from '@google/gemini-cli-core';

// Main entry point with type switch
export function processInformationMessage(
  message: InformationMessage,
): ProcessedMessage {
  switch (message.type) {
    case InformationMessageType.API_ERROR:
      return processApiError(message.data as ParsedError);

    default:
      return {
        title: 'Information',
        content: JSON.stringify(message.data, null, 2),
      };
  }
}

// Process API errors with subtype detection
function processApiError(data: ParsedError): ProcessedMessage {
  switch (data.type) {
    case ParsedErrorType.PRO_QUOTA:
    case ParsedErrorType.GENERIC_QUOTA:
    case ParsedErrorType.RATE_LIMIT:
      return {
        title: data.title,
        content: data.message,
      };
    case ParsedErrorType.AUTH:
      return {
        title: data.title,
        content: data.message,
      };
    default:
      return {
        title: data.title,
        content: data.message,
      };
  }
}
