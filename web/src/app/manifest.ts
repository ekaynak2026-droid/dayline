import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const TEST = process.env.NEXT_PUBLIC_DAYLINE_TEST === '1';

// Lets phones install Dayline on the home screen like a normal app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TEST ? 'Dayline Planner (test)' : 'Dayline Planner',
    short_name: TEST ? 'Dayline test' : 'Dayline',
    description: "Personal planner: today's tasks, a monthly calendar and notes.",
    start_url: './#tasks',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EDF0F3',
    theme_color: '#EDF0F3',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
