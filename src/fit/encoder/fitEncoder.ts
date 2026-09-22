import {
  Decoder,
  Encoder,
  Profile,
  Stream,
  Utils,
  type FieldDescription,
  type Mesg,
  type MesgDefinition,
  type ProfileField,
  type ProfileMesg,
} from '@garmin/fitsdk';
import type { RepairPatch } from '../../models/repair';

type MutableMesg = Mesg & Record<string, unknown>;

export interface FitExportReport {
  messageCount: number;
  recordCount: number;
  developerFieldCount: number;
  unknownMessageTypes: number;
  outputBytes: number;
  shiftedTimestampFields: number;
  positionPatchedRecords: number;
  warnings: string[];
}

function addUnknownProfileFields(
  definition: MesgDefinition,
  unknownMessageNumbers: Set<number>,
): void {
  const messageNumber = definition.globalMessageNumber;
  const profiles = Profile.messages as Record<number, ProfileMesg>;
  let messageProfile = profiles[messageNumber];
  if (!messageProfile) {
    unknownMessageNumbers.add(messageNumber);
    messageProfile = {
      num: messageNumber,
      name: `mesg${messageNumber}`,
      messagesKey: `mesg${messageNumber}Mesgs`,
      fields: {},
    };
    profiles[messageNumber] = messageProfile;
  }
  definition.fieldDefinitions.forEach((fieldDefinition) => {
    if (messageProfile.fields[fieldDefinition.fieldDefinitionNumber]) return;
    const type = Utils.BaseTypeToFieldType[fieldDefinition.baseType];
    messageProfile.fields[fieldDefinition.fieldDefinitionNumber] = {
      num: fieldDefinition.fieldDefinitionNumber,
      name: `field${fieldDefinition.fieldDefinitionNumber}`,
      type,
      baseType: type,
      array: fieldDefinition.size / fieldDefinition.baseTypeSize > 1,
      scale: 1,
      offset: 0,
      units: '',
      bits: [],
      components: [],
      isAccumulated: false,
      hasComponents: false,
      subFields: [],
    } as ProfileField;
  });
}

function dateMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value * 1000 + Utils.FIT_EPOCH_MS;
  return undefined;
}

function degreesToSemicircles(value: number): number {
  return Math.round((value * 2 ** 31) / 180);
}

function semicirclesToDegrees(value: unknown): number | undefined {
  return typeof value === 'number' ? (value * 180) / 2 ** 31 : undefined;
}

function shiftMessageTimestamps(
  messageNumber: number,
  message: MutableMesg,
  offsetMs: number,
): number {
  const profile = (Profile.messages as Record<number, ProfileMesg>)[messageNumber];
  if (!profile) return 0;

  let shiftedFields = 0;
  Object.values(profile.fields).forEach((field) => {
    if (field.type !== 'dateTime' && field.type !== 'localDateTime') return;
    const value = message[field.name];
    if (value instanceof Date) {
      message[field.name] = new Date(value.getTime() + offsetMs);
      shiftedFields += 1;
      return;
    }
    if (typeof value === 'number' && value >= 0x10000000) {
      message[field.name] = value + offsetMs / 1000;
      shiftedFields += 1;
    }
  });
  return shiftedFields;
}

function patchSummarySpeed(
  message: MutableMesg,
  distanceM: number,
  timerTimeS: unknown,
  maxSpeedMps: number,
): void {
  const timer = typeof timerTimeS === 'number' ? timerTimeS : undefined;
  const average = timer && timer > 0 ? distanceM / timer : undefined;
  message.totalDistance = distanceM;
  if (average != null) {
    message.avgSpeed = average;
    message.enhancedAvgSpeed = average;
  }
  message.maxSpeed = maxSpeedMps;
  message.enhancedMaxSpeed = maxSpeedMps;
}

export function encodeRepairedFit(
  source: ArrayBuffer,
  patch: RepairPatch,
): {
  bytes: Uint8Array;
  report: FitExportReport;
} {
  const decoder = new Decoder(Stream.fromArrayBuffer(source));
  if (!decoder.isFIT()) throw new Error('The original file no longer has a valid FIT header.');

  const allMessages: { messageNumber: number; message: MutableMesg }[] = [];
  const definitions: MesgDefinition[] = [];
  const fieldDescriptions: Record<number, FieldDescription> = {};
  const unknownMessageNumbers = new Set<number>();
  const decoded = decoder.read({
    expandComponents: false,
    expandSubFields: false,
    mergeHeartRates: false,
    includeUnknownData: true,
    mesgDefinitionListener: (definition) => {
      addUnknownProfileFields(definition, unknownMessageNumbers);
      definitions.push(definition);
    },
    fieldDescriptionListener: (key, developerDataIdMesg, fieldDescriptionMesg) => {
      fieldDescriptions[key] = { developerDataIdMesg, fieldDescriptionMesg };
    },
    mesgListener: (messageNumber, message) => {
      allMessages.push({ messageNumber, message: message as MutableMesg });
    },
  });
  if (decoded.errors.length) {
    throw new Error(
      `The source decoder reported ${decoded.errors.length} error(s); FIT export was stopped to avoid producing an incomplete activity.`,
    );
  }

  const timestampOffsetMs = patch.timestampOffsetMs ?? 0;
  const shiftedTimestampFields = timestampOffsetMs
    ? allMessages.reduce(
        (count, item) =>
          count + shiftMessageTimestamps(item.messageNumber, item.message, timestampOffsetMs),
        0,
      )
    : 0;

  const patches = new Map(patch.recordPatches.map((item) => [item.recordIndex, item]));
  const positionPatches = new Map(
    (patch.positionPatches ?? []).map((item) => [item.recordIndex, item]),
  );
  const hasDistanceRepair = patches.size > 0;
  const patchedRecords: { timestamp?: number; distanceM: number; speedMps: number }[] = [];
  let recordIndex = 0;
  for (const item of allMessages) {
    if (item.messageNumber !== Profile.MesgNum.RECORD) continue;
    if (hasDistanceRepair) {
      const recordPatch = patches.get(recordIndex);
      if (!recordPatch) throw new Error(`The repair patch is missing record ${recordIndex}.`);
      item.message.distance = recordPatch.distanceM;
      if (recordPatch.derivedSpeedMps != null) {
        item.message.speed = recordPatch.derivedSpeedMps;
        item.message.enhancedSpeed = recordPatch.derivedSpeedMps;
      }
      patchedRecords.push({
        timestamp: dateMs(item.message.timestamp),
        distanceM: recordPatch.distanceM,
        speedMps: recordPatch.derivedSpeedMps ?? 0,
      });
    }
    const positionPatch = positionPatches.get(recordIndex);
    if (positionPatch) {
      item.message.positionLat = degreesToSemicircles(positionPatch.latitude);
      item.message.positionLong = degreesToSemicircles(positionPatch.longitude);
    }
    recordIndex += 1;
  }
  if (hasDistanceRepair && recordIndex !== patch.recordPatches.length) {
    throw new Error(
      `Record count changed since repair (${recordIndex} source records, ${patch.recordPatches.length} patched records).`,
    );
  }

  const maxSpeedMps = patchedRecords.reduce(
    (maximum, record) => Math.max(maximum, record.speedMps),
    0,
  );
  if (hasDistanceRepair) {
    let sessionIndex = 0;
    for (const item of allMessages) {
      if (item.messageNumber === Profile.MesgNum.SESSION) {
        if (sessionIndex === 0 && patch.repairedSummary.totalDistanceM != null) {
          patchSummarySpeed(
            item.message,
            patch.repairedSummary.totalDistanceM,
            item.message.totalTimerTime,
            maxSpeedMps,
          );
        }
        sessionIndex += 1;
      }
      if (item.messageNumber === Profile.MesgNum.LAP) {
        const start = dateMs(item.message.startTime);
        const end = dateMs(item.message.timestamp);
        if (start == null || end == null) continue;
        const beforeStart = [...patchedRecords]
          .reverse()
          .find((record) => record.timestamp != null && record.timestamp <= start);
        const lapRecords = patchedRecords.filter(
          (record) =>
            record.timestamp != null && record.timestamp > start && record.timestamp <= end,
        );
        const last = lapRecords.at(-1);
        if (!last) continue;
        const startDistance = beforeStart?.distanceM ?? lapRecords[0].distanceM;
        const lapDistance = Math.max(0, last.distanceM - startDistance);
        const lapMaxSpeed = lapRecords.reduce(
          (maximum, record) => Math.max(maximum, record.speedMps),
          0,
        );
        patchSummarySpeed(item.message, lapDistance, item.message.totalTimerTime, lapMaxSpeed);
      }
    }
  }

  definitions.forEach((definition) => addUnknownProfileFields(definition, unknownMessageNumbers));
  const encoder = new Encoder({ fieldDescriptions });
  allMessages.forEach(({ messageNumber, message }) => encoder.onMesg(messageNumber, message));
  const bytes = encoder.close();

  const validationDecoder = new Decoder(
    Stream.fromArrayBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  );
  if (!validationDecoder.checkIntegrity())
    throw new Error('The encoded FIT file failed CRC validation.');
  const validation = validationDecoder.read({ includeUnknownData: true });
  if (validation.errors.length)
    throw new Error('The encoded FIT file could not be decoded cleanly.');
  const validationRecords = validation.messages.recordMesgs ?? [];
  const validationDistance = validation.messages.sessionMesgs?.[0]?.totalDistance;
  const validationStartTime = validation.messages.sessionMesgs?.[0]?.startTime;
  const validationStartMs = dateMs(validationStartTime);
  const expectedDistance = patch.repairedSummary.totalDistanceM;
  if (validationRecords.length !== recordIndex) {
    throw new Error('The encoded FIT file did not preserve every record.');
  }
  for (const positionPatch of positionPatches.values()) {
    const validationRecord = validationRecords[positionPatch.recordIndex];
    const latitude = semicirclesToDegrees(validationRecord?.positionLat);
    const longitude = semicirclesToDegrees(validationRecord?.positionLong);
    if (
      latitude == null ||
      longitude == null ||
      Math.abs(latitude - positionPatch.latitude) > 0.00001 ||
      Math.abs(longitude - positionPatch.longitude) > 0.00001
    ) {
      throw new Error('The encoded FIT file did not preserve every reconstructed position.');
    }
  }
  if (
    hasDistanceRepair &&
    expectedDistance != null &&
    (typeof validationDistance !== 'number' ||
      Math.abs(validationDistance - expectedDistance) > 0.1)
  ) {
    throw new Error('The encoded FIT file did not preserve the repaired session distance.');
  }
  if (
    patch.correctedStartTime &&
    (validationStartMs == null ||
      Math.abs(validationStartMs - Date.parse(patch.correctedStartTime)) > 1000)
  ) {
    throw new Error('The encoded FIT file did not preserve the corrected start time.');
  }

  return {
    bytes,
    report: {
      messageCount: allMessages.length,
      recordCount: recordIndex,
      developerFieldCount: Object.keys(fieldDescriptions).length,
      unknownMessageTypes: unknownMessageNumbers.size,
      outputBytes: bytes.byteLength,
      shiftedTimestampFields,
      positionPatchedRecords: positionPatches.size,
      warnings: unknownMessageNumbers.size
        ? [
            `${unknownMessageNumbers.size} unknown message type(s) were preserved using their original field definitions.`,
          ]
        : [],
    },
  };
}
