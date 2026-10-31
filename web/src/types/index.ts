// The shapes of the things Dayline stores. These match the original Dayline app exactly,
// so the same data (and the same sync account) works in both.

/** An attached file or photo. The file itself is stored separately under "file:<id>". */
export interface FileRef {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface Task {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ""
  remind: string; // "" = no reminder, otherwise minutes before ("0", "10", "60", "1440")
  done: boolean;
  files?: FileRef[];
  rset?: number; // when the reminder was last set (so old times don't fire at once)
  updated?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string; // "" = all day
  remind: string;
  color: number; // 1 to 4
  files?: FileRef[];
  rset?: number;
  updated?: number;
}

export interface ChecklistItem {
  t: string;
  done: boolean;
}

export interface Note {
  id: string;
  type: 'text' | 'list';
  title: string;
  body: string;
  items: ChecklistItem[];
  photo: string | null;
  locked: boolean;
  updated: number;
  files?: FileRef[];
  /** Set on pages of the copybook (sketches saved from the sketch pad). They show in the copybook, not in the notes list. */
  book?: 'copybook' | 'workbook';
  /** Only on the AI task workbook note: what the assistant wrote last time (see lib/workbook.ts). */
  wb?: WorkbookMeta;
}

/** What the AI task workbook remembers between updates, so it can tell the user's edits from its own text. */
export interface WorkbookMeta {
  /** When the workbook was last brought up to date. */
  last: number;
  tasks: Record<string, WorkbookTaskMeta>;
}
export interface WorkbookTaskMeta {
  /** A fingerprint of the task (text, date, time, files) when the assistant last wrote its tab. */
  fp: string;
  /** A fingerprint of the user's own edits on that tab at that time. */
  user: string;
  /** Exactly what the assistant wrote. Anything in the workbook that differs from this is the user's. */
  // (No lists inside lists here: the online database cannot store them. Each row is its cells joined.)
  ai: { summary: string; files: { name: string; text: string }[]; rows: string[]; next: string };
  /** Items the user deleted from the list: never suggested again. */
  removed: string[];
}

/** Locked notes, encrypted with the PIN. Only the encrypted text is ever stored. */
export interface Vault {
  salt: string;
  iv?: string;
  data?: string;
  count?: number;
}

export interface SyncInfo {
  uid: string;
  email: string;
  last: Record<string, string | number>;
  primed: boolean;
}

/** Everything Dayline keeps, saved as one bundle under the key "state". */
export interface State {
  v: number;
  tasks: Task[];
  events: CalendarEvent[];
  notes: Note[];
  vault: Vault | null;
  fired: Record<string, number>;
  installDismissed: boolean;
  lastBackup: number | null;
  sync: SyncInfo | null;
}

/** A stored file: the bytes plus a few details. */
export interface FileRecord {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export type TabType = 'tasks' | 'calendar' | 'notes' | 'helper';
