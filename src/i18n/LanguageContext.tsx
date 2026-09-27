import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'uk';
type Params = Record<string, string | number>;

const en: Record<string, string> = {
  'language.label': 'Language',
  'app.subtitle': 'FIT repair workbench',
  'app.privacy': 'Files stay in this browser',
  'hero.title': 'Inspect the evidence.\nRepair only by choice.',
  'hero.body':
    'Decode Garmin FIT files locally, investigate every message, then create a separate distance repair when the recorded value cannot be trusted.',
  'drop.chooseLabel': 'Choose FIT files',
  'drop.active': 'Drop FIT files here',
  'drop.title': 'Attach FIT files',
  'drop.body': 'Drop files here or choose from your device',
  'drop.choose': 'Choose files',
  'drop.rejected': 'Only non-empty .fit files can be attached.',
  'attachments.title': 'Attachments',
  'attachments.label': 'Attached FIT files',
  'attachments.records': '{records} records · {messages} messages',
  'attachments.parsing': 'Parsing',
  'attachments.queued': 'Queued',
  'attachments.retry': 'Retry {file}',
  'attachments.remove': 'Remove {file}',
  'workspace.select': 'Select a FIT file to inspect it.',
  'workspace.parsing': 'Parsing locally',
  'workspace.parsingBody': 'The file is being decoded in a background worker.',
  'workspace.decodeError': 'This file could not be decoded',
  'workspace.retry': 'Retry parsing',
  'workspace.selected': 'Selected file',
  'workspace.complete': 'Complete decode',
  'workspace.partial': 'Partial decode',
  'workspace.views': 'Activity data views',
  'tab.summary': 'Summary',
  'tab.normalized': 'Normalized JSON',
  'tab.raw': 'Raw FIT JSON',
  'tab.records': 'Records',
  'tab.issues': 'Issues',
  'empty.title': 'No activity loaded',
  'empty.body': 'Attach one or more .fit files to begin. Each file is processed independently.',
  'empty.raw': 'raw.fit',
  'empty.inspect': 'inspect',
  'empty.derive': 'derive.json',
  'toast.copied': 'Copied to clipboard',
  'toast.fitDownloaded': 'Repaired FIT validated and downloaded',
  'summary.label': 'Activity summary',
  'summary.sport': 'Sport',
  'summary.started': 'Started',
  'summary.elapsed': 'Elapsed',
  'summary.timer': 'Timer',
  'summary.distance': 'Original distance',
  'summary.pace': 'Average pace',
  'summary.hr': 'Heart rate',
  'summary.records': 'Records',
  'summary.gps': 'GPS records',
  'summary.developer': 'Developer fields',
  'summary.unknown': 'Unknown',
  'summary.avg': 'avg',
  'summary.max': 'max',
  'summary.crcValid': 'CRC valid',
  'summary.crcMismatch': 'CRC mismatch',
  'summary.crcUnknown': 'CRC unknown',
  'summary.completeBody': 'The FIT container decoded completely.',
  'summary.reviewBody': 'Review warnings before using this activity.',
  'summary.warnings': 'Parsing warnings',
  'json.search': 'Search key or value',
  'json.depth': 'Collapse depth',
  'json.copy': 'Copy',
  'json.download': 'Download',
  'json.match': 'A matching key or value exists in this document.',
  'json.noMatch': 'No matching key or value.',
  'json.copyLabel': 'Copy {label}',
  'raw.search': 'Search raw messages',
  'raw.type': 'Message type',
  'raw.all': 'All types',
  'raw.copy': 'Copy raw JSON',
  'raw.showing': 'Showing {shown} of {total} messages',
  'records.configure': 'Configure columns',
  'records.index': 'Index',
  'records.timestamp': 'Timestamp',
  'records.latitude': 'Latitude',
  'records.longitude': 'Longitude',
  'records.distance': 'Distance m',
  'records.speed': 'Speed m/s',
  'records.cadence': 'Cadence',
  'records.heartRate': 'HR',
  'records.altitude': 'Altitude m',
  'records.heading': 'Heading',
  'records.developer': 'Developer fields',
  'issues.none': 'No anomalies were detected by the current checks.',
  'issues.records': 'Records: {records}',
  'issues.more': ' and {count} more',
  'issues.activity': 'Activity-level issue',
  'issues.evidence': 'Supporting evidence',
  'severity.info': 'info',
  'severity.warning': 'warning',
  'severity.critical': 'critical',
  'alphaGps.badge': 'Alpha experiment',
  'alphaGps.mapEntryTitle': 'Map changes',
  'alphaGps.mapEntryBody':
    'Redraw an incorrect route or recalculate distance from a correct GPS track.',
  'alphaGps.updateMap': 'Update map',
  'alphaGps.closeMap': 'Close map editor',
  'alphaGps.mapTitle': 'Update activity map',
  'alphaGps.mapBody':
    'Draw a new path or recalculate distance from the recorded GPS track. Review the change before creating a derived file.',
  'alphaGps.preserveDistanceReview':
    'The drawn path length is only a preview. Original record, lap, and session distances and speeds will remain unchanged.',
  'alphaGps.title': 'GPS repair lab',
  'alphaGps.body':
    'Test whether the surviving GPS trace can be aligned to nearby OpenStreetMap paths. Nothing is changed until you review and apply the result.',
  'alphaGps.evidence': 'Available route evidence',
  'alphaGps.positions': 'GPS positions',
  'alphaGps.heading': 'heading records',
  'alphaGps.altitude': 'altitude records',
  'alphaGps.outliers': 'local outliers',
  'alphaGps.startStep': 'Start anchor',
  'alphaGps.startTitle': 'Where did the activity really start?',
  'alphaGps.startBody':
    'The recorded start is shown in red. Search, click the map, drag the blue marker, or enter coordinates to place the corrected start.',
  'alphaGps.useRecorded': 'Use recorded start',
  'alphaGps.searchLabel': 'Search for the correct area',
  'alphaGps.searchPlaceholder': 'e.g. Bucha, Kyiv region',
  'alphaGps.search': 'Search',
  'alphaGps.searching': 'Searching…',
  'alphaGps.searchError':
    'The place search is unavailable. You can still use the map or coordinates.',
  'alphaGps.setCoordinates': 'Set coordinates',
  'alphaGps.recordedStart': 'Recorded start',
  'alphaGps.correctedStart': 'Corrected start',
  'alphaGps.mapHint': 'Click the map or drag the blue marker',
  'alphaGps.externalTitle': 'This step leaves the browser',
  'alphaGps.externalBody':
    'The map loads visible OpenStreetMap tiles. Search sends only your query to Nominatim. Matching sends at most 180 shifted coordinates, timing, and GPS accuracy to Valhalla; an elevation profile may also be requested. The FIT file stays local.',
  'alphaGps.find': 'Send trace and find route',
  'alphaGps.matching': 'Matching route…',
  'alphaGps.needsPositions': 'At least two valid GPS positions are required.',
  'alphaGps.error': 'The route could not be matched.',
  'alphaGps.originalTrace': 'Recorded trace',
  'alphaGps.shiftedTrace': 'Shifted trace',
  'alphaGps.distanceAdjustedTrace': 'Distance-adjusted trace',
  'alphaGps.headingGuide': 'Heading-derived guide',
  'alphaGps.noTrace': 'No reliable GPS trace',
  'alphaGps.modeLabel': 'Route method',
  'alphaGps.modeAutomatic': 'Suggest a route',
  'alphaGps.modeManual': 'Recreate map',
  'alphaGps.gps.mode': 'Recalculate from recorded GPS',
  'alphaGps.gps.reviewTitle': 'Review recorded GPS track',
  'alphaGps.gps.reviewBody':
    'The FIT file’s GPS positions stay unchanged. Distance and lap summaries are recalculated along this recorded track.',
  'alphaGps.gps.track': 'Recorded GPS track',
  'alphaGps.gps.start': 'Recorded start',
  'alphaGps.gps.end': 'Recorded finish',
  'alphaGps.gps.distance': 'GPS track distance',
  'alphaGps.gps.difference': 'Difference from recorded distance',
  'alphaGps.gps.warning':
    'Use this only when the GPS track is complete and correct. GPS noise affects distance. Automatic distance laps may be rebuilt; original lap-only metrics such as calories may not carry over.',
  'alphaGps.gps.discard': 'Back to options',
  'alphaGps.gps.apply': 'Apply GPS distance',
  'alphaGps.gps.applied':
    'Record distances and lap summaries aligned with the recorded GPS track; coordinates were unchanged.',
  'alphaGps.manual.title': 'Draw the run you remember',
  'alphaGps.manual.body':
    'Add points in running order. The route stays open unless you set a finish or choose to return to the start.',
  'alphaGps.manual.target': 'Sensor distance',
  'alphaGps.manual.mapLabel': 'Editable running route map',
  'alphaGps.manual.mapHint':
    'Click along the run, including turns, to draw straight segments. Drag S, F, or a numbered point to move it. Click a point to remove it.',
  'alphaGps.manual.placementMode': 'Map click action',
  'alphaGps.manual.addPointMode': 'Add route point',
  'alphaGps.manual.setFinishMode': 'Set finish',
  'alphaGps.manual.finishAtStart': 'Finish at start',
  'alphaGps.manual.leaveOpen': 'Leave route open',
  'alphaGps.manual.finish': 'Finish',
  'alphaGps.manual.drawnDistance': 'Drawn distance',
  'alphaGps.manual.point': 'Point {number}',
  'alphaGps.manual.editPoint': 'Edit point {number}',
  'alphaGps.manual.moveUp': 'Move point {number} earlier',
  'alphaGps.manual.moveDown': 'Move point {number} later',
  'alphaGps.manual.removePoint': 'Remove point {number}',
  'alphaGps.manual.addCoordinates': 'Add point',
  'alphaGps.manual.saveCoordinates': 'Save point',
  'alphaGps.manual.cancelEdit': 'Cancel edit',
  'alphaGps.manual.invalidCoordinates': 'Enter valid latitude and longitude.',
  'alphaGps.manual.clear': 'Clear points',
  'alphaGps.manual.pointCount': 'Points: {count}',
  'alphaGps.manual.build': 'Review drawn route',
  'alphaGps.manual.needsDistance':
    'A reliable sensor distance is needed to update distance data. Keep existing distance and speed data to edit only the map.',
  'alphaGps.manual.externalBody':
    'Drawing and distance calculations stay in this browser. Map tiles load from OpenStreetMap; place search sends only your search text to Nominatim.',
  'alphaGps.manual.reviewBody':
    'This is the path you drew, with straight segments between points—not a road-snapped route. Compare its length with the sensor distance before applying.',
  'alphaGps.manual.reviewTitle': 'Review your drawn path',
  'alphaGps.manual.notOriginal':
    'This path was drawn manually. It is not proof of the original route; add points at bends for a better distance estimate.',
  'alphaGps.manual.evidenceBody':
    'Available sensor signals are compared with the drawn path. Missing evidence is excluded.',
  'alphaGps.manual.routeDistance': 'Drawn path',
  'alphaGps.manual.discard': 'Continue drawing',
  'alphaGps.manual.apply': 'Apply drawn path',
  'alphaGps.manual.applied': '{records} record positions reconstructed from the drawn path.',
  'alphaGps.manual.editRoute': 'Edit this map',
  'alphaGps.manual.distanceConflict':
    'This route is {route} km, while the sensor estimate is {reference} km ({difference}% apart). Move or add points, then review it again.',
  'alphaGps.reviewBodyLoop':
    'Only the start at {latitude}, {longitude} and the {distance} km sensor estimate are known. These road loops are possibilities, not a recovered path.',
  'alphaGps.alternatives': 'Possible road loops near the start',
  'alphaGps.loopOption': 'Option {number} · {distance} km',
  'alphaGps.needsDistance': 'A reliable sensor distance is required to generate road loops.',
  'alphaGps.selectDistanceEstimate':
    'Select a calculated distance above before applying the map with distance recalculation.',
  'alphaGps.findLoops': 'Find possible road loops',
  'alphaGps.externalBodyLoop':
    'The GPS positions are too damaged to locate the route. Only the selected start and generated loop anchors are sent to Valhalla; the FIT file stays local.',
  'alphaGps.matchedRoute': 'Suggested route',
  'alphaGps.reconstructedStart': 'Reconstructed start',
  'alphaGps.reconstructedEnd': 'Reconstructed end',
  'alphaGps.reviewTitle': 'Review the reconstructed road',
  'alphaGps.reviewBody': 'Built around your corrected start at {latitude}, {longitude}.',
  'alphaGps.reviewBodyScaled':
    'Built at {latitude}, {longitude}. The surviving trace was scaled {scale}× toward the independent {distance} km sensor estimate before road matching.',
  'alphaGps.reviewBodyHeading':
    'Built at {latitude}, {longitude}. Because the GPS trace was severely collapsed, a {distance} km guide was reconstructed from heading and track records before road matching.',
  'alphaGps.changeStart': 'Change start location',
  'alphaGps.confidence': 'Combined confidence',
  'alphaGps.routeDistance': 'Suggested route',
  'alphaGps.distanceDifference': 'Distance difference',
  'alphaGps.distanceDifferenceEstimate': 'Difference from {distance} km sensor estimate',
  'alphaGps.distanceConflict':
    'Distance conflict: the matched road is {route} km, but the independent sensor estimate is {reference} km ({difference}% difference). The GPS shape may be incomplete, so this is not a credible full-route reconstruction.',
  'alphaGps.notOriginal':
    'This is a plausible route generated from map data. It is not proof of the original path.',
  'alphaGps.evidenceTitle': 'Why this route fits',
  'alphaGps.evidenceBody':
    'Independent signals check the road match. Missing evidence is excluded from the combined score.',
  'alphaGps.unavailable': 'Unavailable',
  'alphaGps.metric.distance': 'Recorded distance',
  'alphaGps.metric.heading': 'Heading and track',
  'alphaGps.metric.proximity': 'Shifted trace proximity',
  'alphaGps.metric.altitude': 'Elevation profile',
  'alphaGps.metric.distanceMissing': 'No recorded session distance',
  'alphaGps.metric.headingMissing': 'No usable heading or track values',
  'alphaGps.metric.proximityMissing': 'No usable GPS trace',
  'alphaGps.metric.altitudeMissing': 'No altitude evidence or map elevation',
  'alphaGps.discard': 'Discard suggestion',
  'alphaGps.apply': 'Apply suggested route',
  'alphaGps.attribution': 'Route data and matching:',
  'alphaGps.applied': '{records} record positions reconstructed from the suggested route.',
  'confidence.high': 'High',
  'confidence.medium': 'Medium',
  'confidence.low': 'Low',
  'repair.runningOnly':
    'Distance repair currently supports running activities only. This file is marked as {sport}.',
  'repair.needsSession': 'Distance repair needs a decoded running session.',
  'repair.needsRecords': 'Distance repair needs at least two running records.',
  'repair.options': 'Repair options',
  'repair.optionsBody': 'Edit the fields that need correction. Unchanged values stay as they are.',
  'repair.distanceSection': 'Distance',
  'repair.distanceSectionBody': 'Choose how the derived activity should handle distance.',
  'repair.keepDistance': 'Keep recorded distance',
  'repair.keepDistanceBody':
    'Keep distance and speed for time or redrawn-map changes. The recorded-GPS action recalculates them separately.',
  'repair.recalculateDistance': 'Recalculate distance',
  'repair.recalculateDistanceBody': 'Compare sensor-based estimates and choose one to apply.',
  'repair.timeOnlyBody': 'Only the corrected start time will change.',
  'repair.startTimeSection': 'Start date and time',
  'repair.startTimeChanged': 'Start time changed',
  'repair.startTimeWrong': 'The start date or time is wrong',
  'repair.startTimeCurrent': 'Current start: {time}',
  'repair.startTimeMissing': 'No valid session start time was decoded.',
  'repair.startTimeCorrected': 'Correct start date and time',
  'repair.country': 'Country',
  'repair.chooseCountry': 'Choose country',
  'repair.timeZone': 'Time zone',
  'repair.chooseTimeZone': 'Choose time zone',
  'repair.searchOptions': 'Search options',
  'repair.unavailableOption': 'Unavailable',
  'repair.noOptions': 'No matching options',
  'repair.timeZoneHelp':
    'Choose the country and then the time zone where the activity started. The entered clock time will be interpreted in that zone.',
  'repair.timeZoneInvalid': 'Choose a recognized city or time zone.',
  'repair.timeInvalidInZone':
    'This local time does not exist in the selected time zone (daylight-saving change).',
  'repair.startTimeHelp':
    'Enter one corrected start time. Every related timestamp will move by the same offset; durations and sensor readings stay unchanged.',
  'repair.timeOffset': 'Timeline offset: {offset}',
  'repair.backToPrevious': 'Back to previous step',
  'repair.applyTime': 'Apply time correction',
  'repair.timeChanged': 'Activity start corrected',
  'repair.timeChange': '{before} → {after}',
  'repair.calculating': 'Calculating three derived distance candidates…',
  'repair.ready': 'Derived files are ready',
  'repair.unchanged': 'The original FIT file, activity data, and raw messages remain unchanged.',
  'repair.jsonEvidence': 'JSON evidence',
  'repair.originalJson': 'Original JSON',
  'repair.repairedJson': 'Repaired JSON',
  'repair.device': 'Device-compatible activity',
  'repair.fit': 'Repaired FIT file',
  'repair.fitBody':
    'Re-encodes preserved messages with the selected repairs, then validates CRC, record count, timestamps, and session distance before download.',
  'repair.validating': 'Validating FIT…',
  'repair.createFit': 'Create repaired FIT',
  'repair.validated':
    'Validated and downloaded · {records} records · {messages} messages · {size} KB',
  'repair.compatibility':
    'The result is a newly encoded derivative, not a byte-for-byte copy. Unknown and developer fields are preserved when their original FIT definitions are available; importing software may recalculate its own metrics.',
  'repair.back': 'Back',
  'repair.review': 'Review derived changes',
  'repair.reviewBody': 'Only distance and speed fields in the derived JSON will change.',
  'repair.totalDistance': 'Total distance',
  'repair.averagePace': 'Average pace',
  'repair.changedRecords': 'Changed records',
  'repair.apply': 'Apply',
  'repair.compare': 'Compare distance repairs',
  'repair.compareBody': 'No option is selected automatically. Inspect the evidence and choose one.',
  'repair.originalValue': 'Original Garmin value',
  'repair.notCandidate': 'Flagged value is not a repair candidate',
  'repair.cancelRepair': 'Cancel repair',
  'repair.preview': 'Preview selected repair',
  'candidate.confidence': '{level} confidence',
  'candidate.high': 'high',
  'candidate.medium': 'medium',
  'candidate.low': 'low',
  'candidate.difference': 'Difference',
  'candidate.samples': 'Samples',
  'candidate.sampleCounts': '{accepted} accepted · {rejected} rejected',
  'candidate.inspect': 'Inspect calculation',
  'candidate.assumptions': 'Assumptions',
  'candidate.copy': 'Copy calculation',
  'guide.title': 'From Garmin Connect to 3R—and back',
  'guide.body':
    'Use Garmin Connect on a computer to export the original activity and import the validated derivative.',
  'guide.badge': 'Garmin handoff',
  'guide.downloadTitle': 'Download the original FIT',
  'guide.downloadBody':
    'In Garmin Connect Web, open Activities → All Activities, choose the activity, open the settings gear, and select Export File.',
  'guide.exportLink': 'Garmin export instructions',
  'guide.repairTitle': 'Repair and validate locally',
  'guide.repairBody':
    'Attach the exported .fit file here, review the evidence, select a repair candidate, and create the repaired FIT.',
  'guide.uploadTitle': 'Upload the repaired FIT',
  'guide.uploadBody':
    'In Garmin Connect Web, select the cloud upload icon, choose Import Data → Browse, select the .repaired.fit file, then import it.',
  'guide.importLink': 'Garmin upload instructions',
};

const uk: Record<string, string> = {
  ...en,
  'language.label': 'Мова',
  'app.subtitle': 'Майстерня відновлення FIT',
  'app.privacy': 'Файли залишаються у цьому браузері',
  'hero.title': 'Перевірте дані.\nВідновлюйте лише свідомо.',
  'hero.body':
    'Декодуйте файли Garmin FIT локально, досліджуйте кожне повідомлення та створюйте окрему версію з відновленою дистанцією, якщо записаному значенню не можна довіряти.',
  'drop.chooseLabel': 'Вибрати файли FIT',
  'drop.active': 'Перетягніть файли FIT сюди',
  'drop.title': 'Додайте файли FIT',
  'drop.body': 'Перетягніть файли сюди або виберіть їх на пристрої',
  'drop.choose': 'Вибрати файли',
  'drop.rejected': 'Можна додати лише непорожні файли .fit.',
  'attachments.title': 'Вкладення',
  'attachments.label': 'Додані файли FIT',
  'attachments.records': '{records} записів · {messages} повідомлень',
  'attachments.parsing': 'Обробка',
  'attachments.queued': 'У черзі',
  'attachments.retry': 'Повторити {file}',
  'attachments.remove': 'Видалити {file}',
  'workspace.select': 'Виберіть файл FIT для перегляду.',
  'workspace.parsing': 'Локальна обробка',
  'workspace.parsingBody': 'Файл декодується у фоновому процесі.',
  'workspace.decodeError': 'Не вдалося декодувати цей файл',
  'workspace.retry': 'Повторити обробку',
  'workspace.selected': 'Вибраний файл',
  'workspace.complete': 'Повністю декодовано',
  'workspace.partial': 'Частково декодовано',
  'workspace.views': 'Подання даних активності',
  'tab.summary': 'Огляд',
  'tab.normalized': 'Нормалізований JSON',
  'tab.raw': 'Необроблений FIT JSON',
  'tab.records': 'Записи',
  'tab.issues': 'Проблеми',
  'empty.title': 'Активність не завантажено',
  'empty.body': 'Додайте один або кілька файлів .fit. Кожен файл обробляється окремо.',
  'empty.raw': 'raw.fit',
  'empty.inspect': 'перевірка',
  'empty.derive': 'derive.json',
  'toast.copied': 'Скопійовано в буфер обміну',
  'toast.fitDownloaded': 'Відновлений FIT перевірено та завантажено',
  'summary.label': 'Огляд активності',
  'summary.sport': 'Вид спорту',
  'summary.started': 'Початок',
  'summary.elapsed': 'Загальний час',
  'summary.timer': 'Час таймера',
  'summary.distance': 'Початкова дистанція',
  'summary.pace': 'Середній темп',
  'summary.hr': 'Пульс',
  'summary.records': 'Записи',
  'summary.gps': 'Записи GPS',
  'summary.developer': 'Поля розробника',
  'summary.unknown': 'Невідомо',
  'summary.avg': 'сер.',
  'summary.max': 'макс.',
  'summary.crcValid': 'CRC дійсний',
  'summary.crcMismatch': 'CRC не збігається',
  'summary.crcUnknown': 'CRC невідомий',
  'summary.completeBody': 'Контейнер FIT повністю декодовано.',
  'summary.reviewBody': 'Перегляньте попередження перед використанням цієї активності.',
  'summary.warnings': 'Попередження обробки',
  'json.search': 'Пошук ключа або значення',
  'json.depth': 'Глибина згортання',
  'json.copy': 'Копіювати',
  'json.download': 'Завантажити',
  'json.match': 'У документі знайдено відповідний ключ або значення.',
  'json.noMatch': 'Відповідного ключа або значення немає.',
  'json.copyLabel': 'Копіювати {label}',
  'raw.search': 'Пошук у повідомленнях',
  'raw.type': 'Тип повідомлення',
  'raw.all': 'Усі типи',
  'raw.copy': 'Копіювати JSON',
  'raw.showing': 'Показано {shown} з {total} повідомлень',
  'records.configure': 'Налаштувати стовпці',
  'records.index': 'Індекс',
  'records.timestamp': 'Часова позначка',
  'records.latitude': 'Широта',
  'records.longitude': 'Довгота',
  'records.distance': 'Дистанція, м',
  'records.speed': 'Швидкість, м/с',
  'records.cadence': 'Каденс',
  'records.heartRate': 'Пульс',
  'records.altitude': 'Висота, м',
  'records.heading': 'Напрямок',
  'records.developer': 'Поля розробника',
  'issues.none': 'Поточні перевірки не виявили аномалій.',
  'issues.records': 'Записи: {records}',
  'issues.more': ' та ще {count}',
  'issues.activity': 'Проблема рівня активності',
  'issues.evidence': 'Підтвердні дані',
  'severity.info': 'інформація',
  'severity.warning': 'попередження',
  'severity.critical': 'критично',
  'alphaGps.badge': 'Альфа-експеримент',
  'alphaGps.mapEntryTitle': 'Зміни карти',
  'alphaGps.mapEntryBody':
    'Перемалюйте неправильний маршрут або перерахуйте дистанцію за правильним GPS-треком.',
  'alphaGps.updateMap': 'Оновити карту',
  'alphaGps.closeMap': 'Закрити редактор карти',
  'alphaGps.mapTitle': 'Оновити карту активності',
  'alphaGps.mapBody':
    'Намалюйте новий шлях або перерахуйте дистанцію за записаним GPS-треком. Перевірте зміни перед створенням похідного файлу.',
  'alphaGps.preserveDistanceReview':
    'Довжина намальованого шляху — лише попередній перегляд. Дистанції та швидкості записів, кіл і сесії залишаться без змін.',
  'alphaGps.title': 'Лабораторія відновлення GPS',
  'alphaGps.body':
    'Перевірте, чи можна зіставити збережений GPS-трек із сусідніми шляхами OpenStreetMap. Нічого не зміниться, доки ви не переглянете й не застосуєте результат.',
  'alphaGps.evidence': 'Доступні дані маршруту',
  'alphaGps.positions': 'GPS-позиції',
  'alphaGps.heading': 'записи напрямку',
  'alphaGps.altitude': 'записи висоти',
  'alphaGps.outliers': 'локальні викиди',
  'alphaGps.startStep': 'Початкова точка',
  'alphaGps.startTitle': 'Де насправді почалася активність?',
  'alphaGps.startBody':
    'Записаний старт показано червоним. Знайдіть місце, клацніть карту, перетягніть синій маркер або введіть координати правильного старту.',
  'alphaGps.useRecorded': 'Використати записаний старт',
  'alphaGps.searchLabel': 'Знайти правильну місцевість',
  'alphaGps.searchPlaceholder': 'наприклад, Буча, Київська область',
  'alphaGps.search': 'Знайти',
  'alphaGps.searching': 'Пошук…',
  'alphaGps.searchError':
    'Пошук місця недоступний. Ви все одно можете скористатися картою або координатами.',
  'alphaGps.setCoordinates': 'Задати координати',
  'alphaGps.recordedStart': 'Записаний старт',
  'alphaGps.correctedStart': 'Правильний старт',
  'alphaGps.mapHint': 'Клацніть карту або перетягніть синій маркер',
  'alphaGps.externalTitle': 'Цей крок виходить за межі браузера',
  'alphaGps.externalBody':
    'Карта завантажує видимі фрагменти OpenStreetMap. Пошук надсилає лише ваш запит до Nominatim. Для зіставлення до Valhalla надсилається не більше 180 зміщених координат, час і точність GPS; також може запитуватися профіль висоти. Файл FIT залишається локальним.',
  'alphaGps.find': 'Надіслати трек і знайти маршрут',
  'alphaGps.matching': 'Зіставлення маршруту…',
  'alphaGps.needsPositions': 'Потрібні щонайменше дві коректні GPS-позиції.',
  'alphaGps.error': 'Не вдалося зіставити маршрут.',
  'alphaGps.originalTrace': 'Записаний трек',
  'alphaGps.shiftedTrace': 'Зміщений трек',
  'alphaGps.distanceAdjustedTrace': 'Трек із виправленою дистанцією',
  'alphaGps.headingGuide': 'Орієнтир за напрямком руху',
  'alphaGps.noTrace': 'Немає надійного GPS-треку',
  'alphaGps.modeLabel': 'Спосіб побудови маршруту',
  'alphaGps.modeAutomatic': 'Запропонувати маршрут',
  'alphaGps.modeManual': 'Відтворити карту',
  'alphaGps.gps.mode': 'Перерахувати за записаним GPS',
  'alphaGps.gps.reviewTitle': 'Перевірте записаний GPS-трек',
  'alphaGps.gps.reviewBody':
    'GPS-координати у FIT-файлі не зміняться. Дистанцію та підсумки кіл буде перераховано за записаним треком.',
  'alphaGps.gps.track': 'Записаний GPS-трек',
  'alphaGps.gps.start': 'Записаний старт',
  'alphaGps.gps.end': 'Записаний фініш',
  'alphaGps.gps.distance': 'Дистанція GPS-треку',
  'alphaGps.gps.difference': 'Різниця із записаною дистанцією',
  'alphaGps.gps.warning':
    'Використовуйте лише якщо GPS-трек повний і правильний. Похибка GPS впливає на дистанцію. Автоматичні кола можуть бути перебудовані; показники лише для кіл, як-от калорії, можуть не зберегтися.',
  'alphaGps.gps.discard': 'Назад до варіантів',
  'alphaGps.gps.apply': 'Застосувати дистанцію GPS',
  'alphaGps.gps.applied':
    'Дистанцію записів і підсумки кіл узгоджено із записаним GPS-треком; координати не змінено.',
  'alphaGps.manual.title': 'Намалюйте пробіжку, яку пам’ятаєте',
  'alphaGps.manual.body':
    'Додавайте точки в порядку руху. Маршрут залишається відкритим, доки ви не встановите фініш або не виберете повернення до старту.',
  'alphaGps.manual.target': 'Дистанція за датчиками',
  'alphaGps.manual.mapLabel': 'Карта для редагування бігового маршруту',
  'alphaGps.manual.mapHint':
    'Клацайте вздовж пробіжки, зокрема на поворотах, щоб намалювати прямі відрізки. Перетягніть S, F або номер, щоб перемістити його. Клацніть на точці, щоб видалити її.',
  'alphaGps.manual.placementMode': 'Дія при натисканні на карту',
  'alphaGps.manual.addPointMode': 'Додати точку маршруту',
  'alphaGps.manual.setFinishMode': 'Встановити фініш',
  'alphaGps.manual.finishAtStart': 'Фініш на старті',
  'alphaGps.manual.leaveOpen': 'Залишити маршрут відкритим',
  'alphaGps.manual.finish': 'Фініш',
  'alphaGps.manual.drawnDistance': 'Намальована дистанція',
  'alphaGps.manual.point': 'Точка {number}',
  'alphaGps.manual.editPoint': 'Змінити точку {number}',
  'alphaGps.manual.moveUp': 'Перемістити точку {number} раніше',
  'alphaGps.manual.moveDown': 'Перемістити точку {number} пізніше',
  'alphaGps.manual.removePoint': 'Видалити точку {number}',
  'alphaGps.manual.addCoordinates': 'Додати точку',
  'alphaGps.manual.saveCoordinates': 'Зберегти точку',
  'alphaGps.manual.cancelEdit': 'Скасувати редагування',
  'alphaGps.manual.invalidCoordinates': 'Укажіть правильні широту й довготу.',
  'alphaGps.manual.clear': 'Очистити точки',
  'alphaGps.manual.pointCount': 'Точок: {count}',
  'alphaGps.manual.build': 'Переглянути намальований маршрут',
  'alphaGps.manual.needsDistance':
    'Для оновлення дистанції потрібна надійна оцінка датчиків. Щоб змінити лише карту, збережіть наявні дані дистанції та швидкості.',
  'alphaGps.manual.externalBody':
    'Малювання та обчислення дистанції відбуваються в браузері. Фрагменти карти завантажуються з OpenStreetMap; пошук надсилає лише текст запиту до Nominatim.',
  'alphaGps.manual.reviewBody':
    'Це намальований вами шлях із прямими відрізками між точками, а не маршрут, прив’язаний до доріг. Перед застосуванням порівняйте його довжину з дистанцією за датчиками.',
  'alphaGps.manual.reviewTitle': 'Перевірте намальований шлях',
  'alphaGps.manual.notOriginal':
    'Цей шлях намальовано вручну. Він не доводить, яким був початковий маршрут; додавайте точки на поворотах для точнішої оцінки дистанції.',
  'alphaGps.manual.evidenceBody':
    'Доступні сигнали датчиків порівнюються з намальованим шляхом. Відсутні дані не враховуються.',
  'alphaGps.manual.routeDistance': 'Намальований шлях',
  'alphaGps.manual.discard': 'Продовжити малювання',
  'alphaGps.manual.apply': 'Застосувати намальований шлях',
  'alphaGps.manual.applied': 'Позиції у {records} записах відновлено з намальованого шляху.',
  'alphaGps.manual.editRoute': 'Редагувати цю карту',
  'alphaGps.manual.distanceConflict':
    'Цей маршрут має {route} км, а оцінка датчиків — {reference} км (різниця {difference}%). Перемістіть або додайте точки й перегляньте маршрут ще раз.',
  'alphaGps.reviewBodyLoop':
    'Відомі лише старт {latitude}, {longitude} та оцінка датчиків {distance} км. Ці дорожні петлі — можливі варіанти, а не відновлений справжній шлях.',
  'alphaGps.alternatives': 'Можливі дорожні петлі поблизу старту',
  'alphaGps.loopOption': 'Варіант {number} · {distance} км',
  'alphaGps.needsDistance': 'Для побудови дорожніх петель потрібна надійна оцінка дистанції.',
  'alphaGps.selectDistanceEstimate':
    'Виберіть обчислену дистанцію вище, перш ніж застосувати карту з перерахунком дистанції.',
  'alphaGps.findLoops': 'Знайти можливі дорожні петлі',
  'alphaGps.externalBodyLoop':
    'GPS-позиції надто пошкоджені, щоб визначити шлях. До Valhalla надсилаються лише вибраний старт і згенеровані орієнтири петель; FIT-файл залишається локальним.',
  'alphaGps.matchedRoute': 'Запропонований маршрут',
  'alphaGps.reconstructedStart': 'Відновлений старт',
  'alphaGps.reconstructedEnd': 'Відновлений фініш',
  'alphaGps.reviewTitle': 'Перевірте відновлений маршрут',
  'alphaGps.reviewBody': 'Побудовано навколо правильного старту {latitude}, {longitude}.',
  'alphaGps.reviewBodyScaled':
    'Побудовано від {latitude}, {longitude}. Перед зіставленням із дорогами збережений трек масштабовано у {scale} раза до незалежної оцінки датчиків {distance} км.',
  'alphaGps.reviewBodyHeading':
    'Побудовано від {latitude}, {longitude}. Оскільки GPS-трек сильно стиснений, перед зіставленням із дорогами орієнтир на {distance} км відновлено з даних heading і track.',
  'alphaGps.changeStart': 'Змінити місце старту',
  'alphaGps.confidence': 'Сукупна достовірність',
  'alphaGps.routeDistance': 'Запропонований маршрут',
  'alphaGps.distanceDifference': 'Різниця дистанції',
  'alphaGps.distanceDifferenceEstimate': 'Різниця з оцінкою датчиків {distance} км',
  'alphaGps.distanceConflict':
    'Конфлікт дистанції: зіставлений маршрут має {route} км, а незалежна оцінка датчиків — {reference} км (різниця {difference}%). GPS-трек може бути неповним, тому це не достовірне відновлення всього маршруту.',
  'alphaGps.notOriginal':
    'Це правдоподібний маршрут, створений із картографічних даних. Він не доводить, яким був початковий шлях.',
  'alphaGps.evidenceTitle': 'Чому цей маршрут підходить',
  'alphaGps.evidenceBody':
    'Незалежні сигнали перевіряють зіставлення з дорогою. Відсутні дані не впливають на сукупну оцінку.',
  'alphaGps.unavailable': 'Недоступно',
  'alphaGps.metric.distance': 'Записана дистанція',
  'alphaGps.metric.heading': 'Напрямок і трек',
  'alphaGps.metric.proximity': 'Близькість зміщеного треку',
  'alphaGps.metric.altitude': 'Профіль висоти',
  'alphaGps.metric.distanceMissing': 'Немає дистанції сесії',
  'alphaGps.metric.headingMissing': 'Немає придатних значень напрямку або треку',
  'alphaGps.metric.proximityMissing': 'Немає придатного GPS-треку',
  'alphaGps.metric.altitudeMissing': 'Немає даних висоти або висоти карти',
  'alphaGps.discard': 'Відхилити пропозицію',
  'alphaGps.apply': 'Застосувати маршрут',
  'alphaGps.attribution': 'Дані маршруту та зіставлення:',
  'alphaGps.applied': 'Позиції у {records} записах відновлено із запропонованого маршруту.',
  'confidence.high': 'Висока',
  'confidence.medium': 'Середня',
  'confidence.low': 'Низька',
  'repair.runningOnly':
    'Відновлення дистанції наразі підтримує лише бігові активності. Цей файл позначено як «{sport}».',
  'repair.needsSession': 'Для відновлення дистанції потрібна декодована бігова сесія.',
  'repair.needsRecords': 'Для відновлення дистанції потрібно щонайменше два бігові записи.',
  'repair.options': 'Параметри відновлення',
  'repair.optionsBody':
    'Змініть поля, які потребують виправлення. Незмінені значення залишаться як є.',
  'repair.distanceSection': 'Дистанція',
  'repair.distanceSectionBody': 'Виберіть, як обробити дистанцію в похідній активності.',
  'repair.keepDistance': 'Зберегти записану дистанцію',
  'repair.keepDistanceBody':
    'Зберегти дистанцію та швидкість для змін часу чи перемальованої карти. Окрема GPS-дія перераховує їх.',
  'repair.recalculateDistance': 'Перерахувати дистанцію',
  'repair.recalculateDistanceBody': 'Порівняти оцінки за датчиками й вибрати одну.',
  'repair.timeOnlyBody': 'Зміниться лише виправлений час початку.',
  'repair.startTimeSection': 'Дата й час початку',
  'repair.startTimeChanged': 'Час початку змінено',
  'repair.startTimeWrong': 'Дата або час початку неправильні',
  'repair.startTimeCurrent': 'Поточний початок: {time}',
  'repair.startTimeMissing': 'Не вдалося декодувати коректний час початку сесії.',
  'repair.startTimeCorrected': 'Правильна дата й час початку',
  'repair.country': 'Країна',
  'repair.chooseCountry': 'Виберіть країну',
  'repair.timeZone': 'Часовий пояс',
  'repair.chooseTimeZone': 'Виберіть часовий пояс',
  'repair.searchOptions': 'Пошук варіантів',
  'repair.unavailableOption': 'Недоступно',
  'repair.noOptions': 'Варіантів не знайдено',
  'repair.timeZoneHelp':
    'Виберіть країну, а потім часовий пояс, де почалася активність. Введений час буде витлумачено в цьому поясі.',
  'repair.timeZoneInvalid': 'Виберіть відоме місто або часовий пояс.',
  'repair.timeInvalidInZone':
    'Такого місцевого часу немає у вибраному поясі через перехід на літній час.',
  'repair.startTimeHelp':
    'Введіть один правильний час початку. Усі пов’язані часові позначки змістяться на однакову величину; тривалість і показники датчиків не зміняться.',
  'repair.timeOffset': 'Зсув часової шкали: {offset}',
  'repair.backToPrevious': 'Повернутися до попереднього кроку',
  'repair.applyTime': 'Застосувати виправлення часу',
  'repair.timeChanged': 'Час початку активності виправлено',
  'repair.timeChange': '{before} → {after}',
  'repair.calculating': 'Обчислюємо три варіанти дистанції…',
  'repair.ready': 'Похідні файли готові',
  'repair.unchanged': 'Початковий файл FIT, дані активності й необроблені повідомлення не змінено.',
  'repair.jsonEvidence': 'Дані JSON',
  'repair.originalJson': 'Початковий JSON',
  'repair.repairedJson': 'Відновлений JSON',
  'repair.device': 'Активність для пристроїв',
  'repair.fit': 'Відновлений файл FIT',
  'repair.fitBody':
    'Повторно кодує збережені повідомлення з вибраними виправленнями, а потім перевіряє CRC, кількість записів, часові позначки й дистанцію сесії перед завантаженням.',
  'repair.validating': 'Перевірка FIT…',
  'repair.createFit': 'Створити відновлений FIT',
  'repair.validated':
    'Перевірено й завантажено · {records} записів · {messages} повідомлень · {size} КБ',
  'repair.compatibility':
    'Результат є заново закодованою похідною версією, а не побайтовою копією. Невідомі поля та поля розробника зберігаються, якщо доступні їхні початкові визначення FIT; програма імпорту може повторно обчислити власні показники.',
  'repair.back': 'Назад',
  'repair.review': 'Перегляньте похідні зміни',
  'repair.reviewBody': 'У похідному JSON зміняться лише поля дистанції та швидкості.',
  'repair.totalDistance': 'Загальна дистанція',
  'repair.averagePace': 'Середній темп',
  'repair.changedRecords': 'Змінені записи',
  'repair.apply': 'Застосувати',
  'repair.compare': 'Порівняйте варіанти дистанції',
  'repair.compareBody': 'Жоден варіант не вибрано автоматично. Перегляньте дані та зробіть вибір.',
  'repair.originalValue': 'Початкове значення Garmin',
  'repair.notCandidate': 'Позначене значення не є варіантом відновлення',
  'repair.cancelRepair': 'Скасувати відновлення',
  'repair.preview': 'Переглянути вибране відновлення',
  'candidate.confidence': 'Достовірність: {level}',
  'candidate.high': 'висока',
  'candidate.medium': 'середня',
  'candidate.low': 'низька',
  'candidate.difference': 'Різниця',
  'candidate.samples': 'Зразки',
  'candidate.sampleCounts': 'прийнято: {accepted} · відхилено: {rejected}',
  'candidate.inspect': 'Переглянути обчислення',
  'candidate.assumptions': 'Припущення',
  'candidate.copy': 'Копіювати обчислення',
  'guide.title': 'З Garmin Connect до 3R — і назад',
  'guide.body':
    'Скористайтеся Garmin Connect на комп’ютері, щоб експортувати початкову активність та імпортувати перевірену похідну версію.',
  'guide.badge': 'Обмін із Garmin',
  'guide.downloadTitle': 'Завантажте початковий FIT',
  'guide.downloadBody':
    'У Garmin Connect Web відкрийте Activities → All Activities, виберіть активність, відкрийте налаштування та натисніть Export File.',
  'guide.exportLink': 'Інструкція Garmin з експорту',
  'guide.repairTitle': 'Відновіть і перевірте локально',
  'guide.repairBody':
    'Додайте експортований файл .fit, перегляньте дані, виберіть варіант відновлення та створіть відновлений FIT.',
  'guide.uploadTitle': 'Завантажте відновлений FIT',
  'guide.uploadBody':
    'У Garmin Connect Web натисніть значок хмарного завантаження, виберіть Import Data → Browse, файл .repaired.fit та імпортуйте його.',
  'guide.importLink': 'Інструкція Garmin із завантаження',
};

const dictionaries = { en, uk };
const LANGUAGE_STORAGE_KEY = '3r-language';
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
} | null>(null);

function format(template: string, params: Params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

function savedLanguage(): Language | undefined {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'en' || saved === 'uk' ? saved : undefined;
}

function browserLanguage(): Language {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const supportsUkrainian = browserLanguages.some(
    (language) => language.toLocaleLowerCase().split('-')[0] === 'uk',
  );
  return supportsUkrainian ? 'uk' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setActiveLanguage] = useState<Language>(
    () => savedLanguage() ?? browserLanguage(),
  );

  const setLanguage = useCallback((nextLanguage: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setActiveLanguage(nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'uk' ? '3R — відновлення FIT' : '3R — FIT repair workbench';
  }, [language]);

  useEffect(() => {
    const followBrowserLanguage = () => {
      if (!savedLanguage()) setActiveLanguage(browserLanguage());
    };
    window.addEventListener('languagechange', followBrowserLanguage);
    return () => window.removeEventListener('languagechange', followBrowserLanguage);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string, params?: Params) =>
        format(dictionaries[language][key] ?? en[key] ?? key, params),
    }),
    [language, setLanguage],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

export function sportLabel(sport: string, language: Language) {
  if (language === 'uk')
    return (
      (
        {
          running: 'біг',
          cycling: 'велоспорт',
          swimming: 'плавання',
          unknown: 'невідомо',
        } as Record<string, string>
      )[sport] ?? sport
    );
  return sport;
}
