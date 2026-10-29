// Settings that are fixed when the app is built.
//
// TEST mode is used for the trial copy at /dayline/test/. It keeps its own data on the phone
// ("dayline-test") and its own online copy (collections starting with "test_"), so trying it
// can never change the data of the main Dayline app. On first start it copies the main app's
// data once, read-only, so you can try it with your real tasks and notes.

export const TEST = process.env.NEXT_PUBLIC_DAYLINE_TEST === '1';
export const VERSION = '2.0.0' + (TEST ? '-test' : '');

/** Folder the app is served from, e.g. "/dayline/test". Used for files in public/. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const asset = (p: string) => `${BASE}/${p}`;

/** Name of the database on the phone. */
export const DB_NAME = TEST ? 'dayline-test' : 'dayline';
/** Database to copy from on first start (test mode only). */
export const COPY_FROM_DB = TEST ? 'dayline' : null;
/** Prefix for the online collections (users/{you}/<prefix>items …). */
export const COLLECTION_PREFIX = TEST ? 'test_' : '';

// Firebase (Google's online database) settings for sync. These values are not secret:
// your data is protected by your sign-in and the security rules, not by hiding them.
export const FIREBASE = {
  apiKey: 'AIzaSyDTlUNa1U19I8YWWAyx8u6PMqgZy3slj98',
  authDomain: 'dayline-5187f.firebaseapp.com',
  projectId: 'dayline-5187f',
  storageBucket: 'dayline-5187f.firebasestorage.app',
  messagingSenderId: '567771075523',
  appId: '1:567771075523:web:6ad6d2399d86335d86a376',
};
