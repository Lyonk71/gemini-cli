/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InformationMessage, ProcessedMessage, ApiErrorData } from './types.js';
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
  } catch {
    return {
      title: 'Information',
      content: input
    };
  }
}

// Process API errors with subtype detection
function processApiError(data: ApiErrorData): ProcessedMessage {
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
function detectApiErrorSubtype(data: ApiErrorData): string {
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
function processQuotaExceededError(data: ApiErrorData): ProcessedMessage {
  const content = formatQuotaExceededError(data);

  return {
    title: 'Rate Limit Exceeded',
    content
  };
}

// Process auth failed errors
function processAuthFailedError(data: ApiErrorData): ProcessedMessage {
  const content = extractNestedErrorMessage(data);

  return {
    title: 'Authentication Error',
    content
  };
}

// Process generic API errors
function processGenericApiError(data: ApiErrorData): ProcessedMessage {
  const content = extractNestedErrorMessage(data);

  return {
    title: 'API Error',
    content
  };
}

// Helper to extract and format nested error messages
function extractNestedErrorMessage(data: ApiErrorData): string {
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

// Format quota exceeded errors in a human-readable way
function formatQuotaExceededError(data: ApiErrorData): string {
  try {

    const error = data.error || data;

    if (!error) {
      return 'Rate limit exceeded. Please try again later.';
    }

    const lines: string[] = [];

    // Parse the nested JSON structure in error.message
    if (error.message && typeof error.message === 'string') {
      try {
        const nestedError = JSON.parse(error.message);

        if (nestedError.error) {
          const actualError = nestedError.error;

          // Extract the main human-readable message
          if (actualError.message) {
            const message = actualError.message;

            // Get the first sentence before any technical details
            const mainMessageMatch = message.match(/^([^.]*\.)/);
            if (mainMessageMatch) {
              const mainMessage = mainMessageMatch[1].trim();
              lines.push(mainMessage);
              lines.push(''); // Add blank line
            }
          }

          // Extract details from the structured data
          if (actualError.details && Array.isArray(actualError.details)) {
            for (const detail of actualError.details) {
              if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && detail.violations) {
                for (const violation of detail.violations) {
                  if (violation.quotaValue) {
                    lines.push(`• Daily limit: ${violation.quotaValue} requests`);
                  }
                  if (violation.quotaDimensions?.model) {
                    lines.push(`• Model: ${violation.quotaDimensions.model}`);
                  }
                }
              }

              if (detail['@type'] === 'type.googleapis.com/google.rpc.Help' && detail.links) {
                for (const link of detail.links) {
                  if (link.url) {
                    lines.push(`• Learn more: ${link.url}`);
                  }
                }
              }
            }
          }
        }
      } catch (parseError) {
        // If parsing fails, fall back to simple message
        lines.push('Rate limit exceeded. Please try again later.');
      }
    }


    // If we extracted a main message or any bullet points, return formatted content
    if (lines.length > 0) {
      return lines.join('\n');
    }

    // Only fall back to raw error if we couldn't extract anything useful
    return 'Rate limit exceeded. Please try again later.';

  } catch {
    // If parsing fails, provide a simple fallback for quota errors
    return 'Rate limit exceeded. Please try again later.';
  }
}