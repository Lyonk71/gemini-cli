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
    // Processing quota exceeded error for dialog display

    const error = data.error || data;

    if (!error) {
      return 'Rate limit exceeded. Please try again later.';
    }

    const lines: string[] = [];

    // Extract main message
    if (error.message) {
      const message = error.message;
      // Processing error message for information extraction

      // Look for quota information in the message
      const quotaMatch = message.match(/Quota exceeded for quota metric '([^']+)'/);
      const limitMatch = message.match(/limit '([^']+)'/);
      const retryMatch = message.match(/Please retry in ([0-9.]+)s/);

      if (quotaMatch) {
        const quotaName = quotaMatch[1]
          .replace(/generativelanguage\.googleapis\.com\//, '')
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .toLowerCase();
        lines.push(`• Quota: ${quotaName}`);
      }

      if (limitMatch) {
        const limitType = limitMatch[1].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        lines.push(`• Limit type: ${limitType}`);
      }

      if (retryMatch) {
        const seconds = parseFloat(retryMatch[1]);
        if (seconds >= 60) {
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          lines.push(`• Retry in: ${minutes}m ${remainingSeconds}s`);
        } else {
          lines.push(`• Retry in: ${Math.floor(seconds)}s`);
        }
      }
    }

    // Try to parse nested JSON from the message first
    if (error.message && typeof error.message === 'string' && error.message.includes('{')) {
      try {
        const jsonStart = error.message.indexOf('{');
        const jsonEnd = error.message.lastIndexOf('}') + 1;
        if (jsonEnd > jsonStart) {
          const jsonPart = error.message.substring(jsonStart, jsonEnd);
          const parsedError = JSON.parse(jsonPart);
          // Successfully parsed nested error from message

          // Process the parsed error
          if (parsedError.error) {
            const nestedError = parsedError.error;

            // Extract from nested error message
            if (nestedError.message) {
              const quotaMatch = nestedError.message.match(/Quota exceeded for quota metric '([^']+)'/);
              const limitMatch = nestedError.message.match(/limit '([^']+)'/);

              if (quotaMatch && !lines.some(l => l.includes('Quota:'))) {
                const quotaName = quotaMatch[1]
                  .replace(/generativelanguage\.googleapis\.com\//, '')
                  .replace(/_/g, ' ')
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .toLowerCase();
                lines.push(`• Quota: ${quotaName}`);
              }

              if (limitMatch && !lines.some(l => l.includes('Limit type:'))) {
                const limitType = limitMatch[1].replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                lines.push(`• Limit type: ${limitType}`);
              }
            }

            // Process nested details
            if (nestedError.details && Array.isArray(nestedError.details)) {
              for (const detail of nestedError.details) {
                if (detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && detail.violations) {
                  for (const violation of detail.violations) {
                    if (violation.quotaValue && !lines.some(l => l.includes('Daily limit:'))) {
                      lines.push(`• Daily limit: ${violation.quotaValue} requests`);
                    }
                    if (violation.quotaDimensions?.model && !lines.some(l => l.includes('Model:'))) {
                      lines.push(`• Model: ${violation.quotaDimensions.model}`);
                    }
                  }
                }

                if (detail['@type'] === 'type.googleapis.com/google.rpc.Help' && detail.links) {
                  for (const link of detail.links) {
                    if (link.url && !lines.some(l => l.includes(link.url))) {
                      lines.push(`• Learn more: ${link.url}`);
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Failed to parse nested JSON, continue with fallback logic
      }
    }

    // Extract details if available (fallback to original logic)
    const errorDetails = ('details' in error && error.details) || (data.error && data.error.details);
    if (errorDetails && Array.isArray(errorDetails)) {
      for (const detail of errorDetails) {
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

    return lines.length > 0 ? lines.join('\n') : extractNestedErrorMessage(data);

  } catch {
    // If parsing fails, fall back to the original extraction method
    return extractNestedErrorMessage(data);
  }
}