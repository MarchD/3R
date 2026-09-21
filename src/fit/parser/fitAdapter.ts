import { Decoder, Profile, Stream } from '@garmin/fitsdk';
import type { DeveloperFieldDefinition, RawFitMessage } from '../../models/fit';
import { toJsonCompatible } from '../../utils/json';

export interface DecodedFit {
  crcValid: boolean;
  messages: Record<string, unknown[]>;
  rawMessages: RawFitMessage[];
  developerFields: DeveloperFieldDefinition[];
  errors: Error[];
}

export function decodeFit(buffer: ArrayBuffer): DecodedFit {
  const integrityDecoder = new Decoder(Stream.fromArrayBuffer(buffer));
  if (!integrityDecoder.isFIT()) throw new Error('The file does not contain a valid FIT header.');
  const crcValid = integrityDecoder.checkIntegrity();
  const rawMessages: RawFitMessage[] = [];
  const developerFields: DeveloperFieldDefinition[] = [];
  const decoder = new Decoder(Stream.fromArrayBuffer(buffer));
  const decoded = decoder.read({
    includeUnknownData: true,
    convertDateTimesToDates: true,
    convertTypesToStrings: true,
    fieldDescriptionListener: (key, developerDataId, description) => {
      const data = toJsonCompatible({ ...developerDataId, ...description }) as Record<string, unknown>;
      developerFields.push({ key, ...data });
    },
    mesgListener: (messageNumber, message) => {
      const messageType = Profile.types.mesgNum[messageNumber] ?? `unknown_${messageNumber}`;
      rawMessages.push({
        index: rawMessages.length,
        messageNumber,
        messageType,
        data: toJsonCompatible(message) as Record<string, unknown>,
      });
    },
  });
  return {
    crcValid,
    messages: toJsonCompatible(decoded.messages) as Record<string, unknown[]>,
    rawMessages,
    developerFields,
    errors: decoded.errors,
  };
}
