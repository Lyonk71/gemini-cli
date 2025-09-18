/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface InformationMessage {
  type: InformationMessageType;
  data: any;
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