/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ApiErrorData {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      '@type'?: string;
      violations?: Array<{
        quotaMetric?: string;
        quotaId?: string;
        quotaDimensions?: {
          model?: string;
          location?: string;
        };
        quotaValue?: string;
      }>;
      links?: Array<{
        description?: string;
        url?: string;
      }>;
    }>;
  };
  message?: string;
  status?: number;
}

export interface InformationMessage {
  type: InformationMessageType;
  data: ApiErrorData;
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
  content: string;
  timestamp: number;
  retryAttempt?: number;
  maxRetries?: number;
  delayMs?: number;
}
