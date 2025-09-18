/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InformationMessage, ProcessedMessage } from './types.js';
import { InformationMessageType } from './types.js';

// Main entry point with type switch
export function processInformationMessage(input: string): ProcessedMessage {
  try {
    const message = JSON.parse(input) as InformationMessage;

    switch (message.type) {
      case InformationMessageType.API_ERROR:
        return processApiError(message.data);

      default:
        return {
          title: 'Information',
          content: JSON.stringify(message.data, null, 2)
        };
    }
  } catch (e) {
    return {
      title: 'Information',
      content: input
    };
  }
}

// Process API errors with subtype detection
function processApiError(data: any): ProcessedMessage {
  const errorSubtype = detectApiErrorSubtype(data);

  switch (errorSubtype) {
    case 'quota_exceeded':
      return processQuotaExceededError(data);

    case 'auth_failed':
      return processAuthFailedError(data);

    default:
      return processGenericApiError(data);
  }
}

// Detect API error subtype from error data
function detectApiErrorSubtype(data: any): string {
  // Check outer level error code
  if (data.error?.code === 429 || data.error?.status === 'Too Many Requests') {
    return 'quota_exceeded';
  }

  if (data.error?.code === 401 || data.error?.code === 403) {
    return 'auth_failed';
  }

  // Check nested JSON if present
  if (data.error?.message && typeof data.error.message === 'string') {
    try {
      const nested = JSON.parse(data.error.message);
      if (nested.error?.code === 429 || nested.error?.status === 'RESOURCE_EXHAUSTED') {
        return 'quota_exceeded';
      }
      if (nested.error?.code === 401 || nested.error?.code === 403) {
        return 'auth_failed';
      }
    } catch {
      // Not nested JSON, continue
    }
  }

  return 'generic';
}

// Process quota exceeded errors
function processQuotaExceededError(data: any): ProcessedMessage {
  // Extract and pretty print the nested error message
  const content = extractNestedErrorMessage(data);

  return {
    title: 'Rate Limit Exceeded',
    content
  };
}

// Process auth failed errors
function processAuthFailedError(data: any): ProcessedMessage {
  const content = extractNestedErrorMessage(data);

  return {
    title: 'Authentication Error',
    content
  };
}

// Process generic API errors
function processGenericApiError(data: any): ProcessedMessage {
  const content = extractNestedErrorMessage(data);

  return {
    title: 'API Error',
    content
  };
}

// Helper to extract and format nested error messages
function extractNestedErrorMessage(data: any): string {
  // Check if error.message contains nested JSON
  if (data.error?.message && typeof data.error.message === 'string') {
    try {
      // Parse the nested JSON and pretty print it
      const nested = JSON.parse(data.error.message);
      return JSON.stringify(nested, null, 2);
    } catch {
      // Not JSON, return as-is
      return data.error.message;
    }
  }

  // Simple message
  if (data.error?.message) {
    return data.error.message;
  }

  // Fallback - pretty print the whole error
  return JSON.stringify(data, null, 2);
}