## ADDED Requirements

### Requirement: Bulk Queue Capacity
The system SHALL allow queueing up to 20 files at a time on each entry point: Gemini video remover, Veo video remover, and the Gemini image cleaner (auto mode). File inputs SHALL accept multi-select and drag-and-drop of multiple files. Files beyond the limit SHALL be rejected with a clear message. Invalid files (wrong type, unsupported dimensions) SHALL be skipped with a message while valid files in the same selection are still queued.

#### Scenario: Queue twenty videos at once
- **WHEN** a user drops 20 valid MP4 files on the Veo or Gemini dropzone
- **THEN** all 20 SHALL appear in the queue with status "queued" and a count badge showing "20 / 20"

#### Scenario: Over-limit selection
- **WHEN** a user selects more files than the remaining queue space
- **THEN** the system SHALL queue only up to the limit and show a message naming the 20-file cap

### Requirement: Sequential Batch Processing
Each queue SHALL provide a "Process All" action that processes every queued item sequentially (one WebCodecs session at a time), updating per-item progress live, marking failures per item, and continuing the batch after a failure.

#### Scenario: Batch with one corrupt file
- **WHEN** Process All runs over 5 items where the third is corrupt
- **THEN** items 1, 2, 4, 5 SHALL finish as "done", item 3 SHALL show "failed" with its error, and the batch SHALL NOT stop at item 3

#### Scenario: Controls locked during batch
- **WHEN** a batch is running
- **THEN** file choosing, Process All, and queue clearing SHALL be disabled until the batch finishes

### Requirement: Per-Item and Batch Downloads
Every finished queue item SHALL be downloadable individually from the queue list, and each queue SHALL provide a "Download All" action that downloads every finished item.

#### Scenario: Download all finished items
- **WHEN** a user clicks Download All after a batch where 4 of 5 items finished
- **THEN** 4 cleaned files SHALL download, each named `<original>-cleaned` (or `-veoclean` on the Veo page) with the correct extension

### Requirement: Queue Visibility and Status
The queue list SHALL be visible from the first queued file, showing per item: name, status (queued / processing N% / done / failed) with distinct styling per status, and a remove control. A summary line SHALL show counts (done / failed / queued).

#### Scenario: Single file still shows queue
- **WHEN** exactly one file is queued
- **THEN** the queue list SHALL be visible with that item's status
