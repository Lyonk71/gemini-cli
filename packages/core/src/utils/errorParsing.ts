/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isProQuotaExceededError,
  isGenericQuotaExceededError,
  isApiError,
  isStructuredError,
} from './quotaErrorDetection.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
} from '../config/models.js';
import { UserTierId } from '../code_assist/types.js';
import { AuthType } from '../core/contentGenerator.js';

// Free Tier message functions
const getRateLimitErrorMessageGoogleFree = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session.`;

const getRateLimitErrorMessageGoogleProQuotaFree = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nYou have reached your daily ${currentModel} quota limit. You will be switched to the ${fallbackModel} model for the rest of this session. To increase your limits, upgrade to get higher limits at https://goo.gle/set-up-gemini-code-assist, or use /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

const getRateLimitErrorMessageGoogleGenericQuotaFree = () =>
  `\nYou have reached your daily quota limit. To increase your limits, upgrade to get higher limits at https://goo.gle/set-up-gemini-code-assist, or use /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

// Legacy/Standard Tier message functions
const getRateLimitErrorMessageGooglePaid = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session. We appreciate you for choosing Gemini Code Assist and the Gemini CLI.`;

const getRateLimitErrorMessageGoogleProQuotaPaid = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nYou have reached your daily ${currentModel} quota limit. You will be switched to the ${fallbackModel} model for the rest of this session. We appreciate you for choosing Gemini Code Assist and the Gemini CLI. To continue accessing the ${currentModel} model today, consider using /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

const getRateLimitErrorMessageGoogleGenericQuotaPaid = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
) =>
  `\nYou have reached your daily quota limit. We appreciate you for choosing Gemini Code Assist and the Gemini CLI. To continue accessing the ${currentModel} model today, consider using /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;
const RATE_LIMIT_ERROR_MESSAGE_USE_GEMINI =
  '\nPlease wait and try again later. To increase your limits, request a quota increase through AI Studio, or switch to another /auth method';
const RATE_LIMIT_ERROR_MESSAGE_VERTEX =
  '\nPlease wait and try again later. To increase your limits, request a quota increase through Vertex, or switch to another /auth method';
const getRateLimitErrorMessageDefault = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session.`;

export enum ParsedErrorType {
  PRO_QUOTA,
  GENERIC_QUOTA,
  RATE_LIMIT,
  AUTH,
  GENERIC,
}

export interface ParsedError {
  type: ParsedErrorType;
  title: string;
  message: string;
  rawError: unknown;
}

function getRateLimitMessage(
  authType?: AuthType,
  error?: unknown,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): string {
  switch (authType) {
    case AuthType.LOGIN_WITH_GOOGLE: {
      // Determine if user is on a paid tier (Legacy or Standard) - default to FREE if not specified
      const isPaidTier =
        userTier === UserTierId.LEGACY || userTier === UserTierId.STANDARD;

      if (isProQuotaExceededError(error)) {
        return isPaidTier
          ? getRateLimitErrorMessageGoogleProQuotaPaid(
              currentModel || DEFAULT_GEMINI_MODEL,
              fallbackModel,
            )
          : getRateLimitErrorMessageGoogleProQuotaFree(
              currentModel || DEFAULT_GEMINI_MODEL,
              fallbackModel,
            );
      } else if (isGenericQuotaExceededError(error)) {
        return isPaidTier
          ? getRateLimitErrorMessageGoogleGenericQuotaPaid(
              currentModel || DEFAULT_GEMINI_MODEL,
            )
          : getRateLimitErrorMessageGoogleGenericQuotaFree();
      } else {
        return isPaidTier
          ? getRateLimitErrorMessageGooglePaid(fallbackModel)
          : getRateLimitErrorMessageGoogleFree(fallbackModel);
      }
    }
    case AuthType.USE_GEMINI:
      return RATE_LIMIT_ERROR_MESSAGE_USE_GEMINI;
    case AuthType.USE_VERTEX_AI:
      return RATE_LIMIT_ERROR_MESSAGE_VERTEX;
    default:
      return getRateLimitErrorMessageDefault(fallbackModel);
  }
}

function _parseError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): ParsedError {
  if (isStructuredError(error)) {
    if (error.status === 429) {
      const message = getRateLimitMessage(
        authType,
        error,
        userTier,
        currentModel,
        fallbackModel,
      );
      if (isProQuotaExceededError(error)) {
        return {
          type: ParsedErrorType.PRO_QUOTA,
          title: 'Quota Exceeded',
          message: `${error.message}${message}`,
          rawError: error,
        };
      } else if (isGenericQuotaExceededError(error)) {
        return {
          type: ParsedErrorType.GENERIC_QUOTA,
          title: 'Quota Exceeded',
          message: `${error.message}${message}`,
          rawError: error,
        };
      } else {
        return {
          type: ParsedErrorType.RATE_LIMIT,
          title: 'Rate Limit Exceeded',
          message: `${error.message}${message}`,
          rawError: error,
        };
      }
    }
    if (error.status === 401 || error.status === 403) {
      return {
        type: ParsedErrorType.AUTH,
        title: 'Authentication Error',
        message: error.message,
        rawError: error,
      };
    }
    return {
      type: ParsedErrorType.GENERIC,
      title: 'API Error',
      message: error.message,
      rawError: error,
    };
  }

  if (typeof error === 'string') {
    const jsonStart = error.indexOf('{');
    if (jsonStart === -1) {
      return {
        type: ParsedErrorType.GENERIC,
        title: 'API Error',
        message: error,
        rawError: error,
      };
    }

    const jsonString = error.substring(jsonStart);

    try {
      const parsedJson = JSON.parse(jsonString) as unknown;
      if (isApiError(parsedJson)) {
        let finalMessage = parsedJson.error.message;
        try {
          const nestedError = JSON.parse(finalMessage) as unknown;
          if (isApiError(nestedError)) {
            finalMessage = nestedError.error.message;
          }
        } catch (_e) {
          // Not nested
        }

        if (parsedJson.error.code === 429) {
          const message = getRateLimitMessage(
            authType,
            parsedJson,
            userTier,
            currentModel,
            fallbackModel,
          );
          if (isProQuotaExceededError(parsedJson)) {
            return {
              type: ParsedErrorType.PRO_QUOTA,
              title: 'Quota Exceeded',
              message: `${finalMessage}${message}`,
              rawError: error,
            };
          } else if (isGenericQuotaExceededError(parsedJson)) {
            return {
              type: ParsedErrorType.GENERIC_QUOTA,
              title: 'Quota Exceeded',
              message: `${finalMessage}${message}`,
              rawError: error,
            };
          } else {
            return {
              type: ParsedErrorType.RATE_LIMIT,
              title: 'Rate Limit Exceeded',
              message: `${finalMessage}${message}`,
              rawError: error,
            };
          }
        }
        if (parsedJson.error.code === 401 || parsedJson.error.code === 403) {
          return {
            type: ParsedErrorType.AUTH,
            title: 'Authentication Error',
            message: finalMessage,
            rawError: error,
          };
        }
        return {
          type: ParsedErrorType.GENERIC,
          title: 'API Error',
          message: finalMessage,
          rawError: error,
        };
      }
    } catch (_e) {
      // Not valid JSON
    }
    return {
      type: ParsedErrorType.GENERIC,
      title: 'API Error',
      message: error,
      rawError: error,
    };
  }

  return {
    type: ParsedErrorType.GENERIC,
    title: 'API Error',
    message: 'An unknown error occurred.',
    rawError: error,
  };
}

export function parseError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): ParsedError {
  return _parseError(error, authType, userTier, currentModel, fallbackModel);
}

export function parseAndFormatApiError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): string {
  const parsed = _parseError(
    error,
    authType,
    userTier,
    currentModel,
    fallbackModel,
  );
  return `[${parsed.title}: ${parsed.message}]`;
}
