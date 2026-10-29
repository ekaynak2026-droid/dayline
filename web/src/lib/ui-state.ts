// Small things the screens remember while you switch tabs.
let calDay = '';
let noteFilter: 'all' | 'lists' | 'photos' | 'files' = 'all';
export const getCalDay = () => calDay;
export const setCalDay = (k: string) => { calDay = k; };
export const getNoteFilter = () => noteFilter;
export const setNoteFilter = (f: typeof noteFilter) => { noteFilter = f; };
