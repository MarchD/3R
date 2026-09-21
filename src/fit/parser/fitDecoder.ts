import type { ParsedFitFile } from '../../models/fit';
import { detectAnomalies } from '../analysis/detectAnomalies';
import { normalizeFit } from '../normalization/normalizeFit';
import { decodeFit } from './fitAdapter';

export interface FileMetadata {
  name: string;
  size: number;
  lastModified: number;
}

export function parseFitBuffer(buffer: ArrayBuffer, file: FileMetadata): ParsedFitFile {
  if (!buffer.byteLength) throw new Error('The selected FIT file is empty.');
  const decoded = decodeFit(buffer);
  const normalized = normalizeFit(decoded.messages, decoded.developerFields);
  const errors = decoded.errors.map((error, index) => ({
    code: `decoder_${index + 1}`,
    message: error.message || String(error),
    recoverable: true,
  }));
  const warnings = [];
  if (!decoded.crcValid) warnings.push({ code: 'crc_mismatch', message: 'CRC validation failed. Decoded data may be incomplete.' });
  if (!normalized.session) warnings.push({ code: 'missing_session', message: 'No session message was decoded.' });
  if (!normalized.records.length) warnings.push({ code: 'missing_records', message: 'No record messages were decoded.' });
  if (errors.length) warnings.push({ code: 'partial_decode', message: 'The decoder returned partial data with errors.' });
  return {
    file,
    integrity: {
      crcValid: decoded.crcValid,
      complete: decoded.crcValid && errors.length === 0,
      warnings,
      errors,
    },
    raw: { messages: decoded.rawMessages, developerFields: decoded.developerFields },
    normalized,
    anomalies: detectAnomalies(normalized, decoded.crcValid),
  };
}
