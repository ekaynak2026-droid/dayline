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
  book?: 'copybook';
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
